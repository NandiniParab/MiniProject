import express from "express"
import multer from "multer"
import { spawn } from "child_process"
import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"
import pool from "../config/database.js"
import { authMiddleware } from "../middleware/auth.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

router.use(authMiddleware)

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.resolve(__dirname, "../uploads/purchase-bills")
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`)
  },
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error("Only JPEG, PNG and PDF allowed"))
  },
})

router.post("/upload", upload.single("bill_file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" })

    const imagePath = path.resolve(req.file.path)
    const scriptPath = path.resolve(__dirname, "../python-scripts/ocr_purchase_bill.py")

    if (!fs.existsSync(scriptPath)) throw new Error("OCR script missing")

    const pythonCmd = process.platform === "win32" ? "python" : "python3"

    const extractedStr = await new Promise((resolve, reject) => {
      const p = spawn(pythonCmd, ["-u", scriptPath, imagePath], { cwd: path.dirname(scriptPath) })
      let out = ""
      let err = ""
      const t = setTimeout(() => {
        p.kill()
        reject(new Error("OCR timeout"))
      }, 120000)
      p.stdout.on("data", (d) => (out += d.toString()))
      p.stderr.on("data", (d) => (err += d.toString()))
      p.on("close", (code) => {
        clearTimeout(t)
        if (code !== 0) {
          const trimmed = out.trim()
          if (trimmed) {
            try {
              const j = JSON.parse(trimmed)
              if (j && j.error) return reject(new Error(j.error))
            } catch {}
          }
          return reject(new Error(err || `Exit ${code}`))
        }
        resolve(out.trim())
      })
      p.on("error", (e) => {
        clearTimeout(t)
        reject(e)
      })
    })

    let extracted
    try {
      extracted = JSON.parse(extractedStr)
    } catch (e) {
      throw new Error("Invalid OCR JSON")
    }

    if (extracted.error) throw new Error(extracted.error)

    const invoiceNumber = extracted["Invoice Number"] || null
    const invoiceDateStr = extracted["Invoice Date"] || null
    const vendorName = extracted["Vendor Name"] || null
    const vendorGstin = extracted["Vendor GSTIN"] || null
    const items = Array.isArray(extracted["Items"]) ? extracted["Items"] : []
    const taxable = parseFloat(extracted["Taxable Amount"] || 0) || 0
    const cgstAmt = parseFloat(extracted["CGST Amount"] || 0) || 0
    const sgstAmt = parseFloat(extracted["SGST Amount"] || 0) || 0
    const igstAmt = parseFloat(extracted["IGST Amount"] || 0) || 0
    const totalAmt = parseFloat(extracted["Total Amount"] || 0) || 0

    let billDate = null
    if (invoiceDateStr) {
      const d = new Date(invoiceDateStr)
      if (!isNaN(d.getTime())) billDate = d.toISOString().split("T")[0]
    }

    const client = await pool.connect()
    await client.query("BEGIN")
    try {
      let vendorId = null
      if (vendorName || vendorGstin) {
        const vres = await client.query(
          `SELECT id FROM vendors WHERE organization_id = $1 AND (LOWER(name) = LOWER($2) OR gstin = $3) LIMIT 1`,
          [req.user.organizationId, vendorName || "", vendorGstin || null]
        )
        if (vres.rows.length) {
          vendorId = vres.rows[0].id
        } else if (vendorName) {
          const vins = await client.query(
            `INSERT INTO vendors (organization_id, branch_id, name, gstin) VALUES ($1, $2, $3, $4) RETURNING id`,
            [req.user.organizationId, req.user.branchId || 1, vendorName, vendorGstin || null]
          )
          vendorId = vins.rows[0].id
        }
      }

      let subtotal = taxable
      if (subtotal === 0 && items.length) {
        subtotal = items.reduce((s, it) => {
          const q = parseFloat(it["Quantity"] || it.qty || 1) || 1
          const p = parseFloat(it["Unit Price"] || it.price || 0) || 0
          return s + q * p
        }, 0)
      }

      let netAmount = totalAmt || subtotal + cgstAmt + sgstAmt + igstAmt

      const pbRes = await client.query(
        `INSERT INTO purchase_bills (
          organization_id, branch_id, vendor_id, uploaded_by,
          bill_number, bill_date, raw_text, structured_json, file_url, status,
          subtotal, cgst_amount, sgst_amount, igst_amount, net_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
        [
          req.user.organizationId,
          req.user.branchId || 1,
          vendorId,
          req.user.userId,
          invoiceNumber,
          billDate,
          extracted["raw_text"] || "",
          JSON.stringify(extracted),
          req.file.filename,
          "parsed",
          subtotal,
          cgstAmt,
          sgstAmt,
          igstAmt,
          netAmount,
        ]
      )

      const pbId = pbRes.rows[0].id

      for (const it of items) {
        const desc = it.description || it["Item Name"] || it["Description"] || "Item"
        let qty = parseFloat(it.qty || it["Quantity"] || it["Qty"] || 1) || 1
        let price = parseFloat(it.price || it["Unit Price"] || it["Rate"] || 0) || 0
        let rate = parseFloat(it.applied_gst_rate || it["GST Rate"] || 0) || 0
        const lineTotal = qty * price
        await client.query(
          `INSERT INTO purchase_bill_items (purchase_bill_id, product_id, description, qty, price, applied_gst_rate, line_discount, line_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [pbId, it.product_id || null, desc, qty, price, rate, 0, lineTotal]
        )
      }

      const debitAccount = items.length ? "Purchases" : "Office Expense"
      const creditAccount = vendorId ? "Creditors" : "Cash"

      const journalDraft = {
        organization_id: req.user.organizationId,
        branch_id: req.user.branchId || 1,
        entry_date: billDate || new Date().toISOString().split("T")[0],
        reference_no: invoiceNumber || null,
        vendor_id: vendorId || null,
        description: `Auto entry for Purchase Bill #${invoiceNumber || pbId}`,
        debit_account: debitAccount,
        credit_account: creditAccount,
        amount: Number(subtotal.toFixed(2)),
        cgst_input: Number(cgstAmt.toFixed(2)),
        sgst_input: Number(sgstAmt.toFixed(2)),
        igst_input: Number(igstAmt.toFixed(2)),
        total_amount: Number(netAmount.toFixed(2)),
        entry_type: "purchase",
        ocr_json_path: `uploads/purchase-bills/json/${pbId}.json`,
        purchase_bill_id: pbId,
      }

      const jsonDir = path.resolve(__dirname, `../uploads/purchase-bills/json`)
      if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir, { recursive: true })
      fs.writeFileSync(path.join(jsonDir, `${pbId}.json`), JSON.stringify(extracted))

      await client.query("COMMIT")
      client.release()

      fs.unlink(imagePath, () => {})

      return res.status(200).json({ success: true, purchase_bill_id: pbId, journal_entry_draft: journalDraft })
    } catch (e) {
      await client.query("ROLLBACK")
      client.release()
      throw e
    }
  } catch (error) {
    if (req.file?.path) fs.unlink(req.file.path, () => {})
    res.status(500).json({ success: false, error: error.message })
  }
})

// List recent purchase bills
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const rows = await pool.query(
      `SELECT pb.id, pb.bill_number, pb.bill_date, pb.vendor_id, pb.subtotal, pb.cgst_amount, pb.sgst_amount, pb.igst_amount, pb.net_amount, pb.status,
              v.name AS vendor_name
       FROM purchase_bills pb
       LEFT JOIN vendors v ON v.id = pb.vendor_id
       WHERE pb.organization_id = $1
       ORDER BY pb.id DESC
       LIMIT $2`,
      [req.user.organizationId, limit]
    )
    res.json(rows.rows)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
