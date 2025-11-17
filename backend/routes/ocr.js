import express from "express"
import multer from "multer"
import { spawn } from "child_process"
import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"
import { authMiddleware } from "../middleware/auth.js"
import pool from "../config/database.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Apply authentication middleware to all OCR routes
router.use(authMiddleware)

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.resolve(__dirname, "../uploads/invoices")
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`)
  },
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error("Only JPEG, PNG images and PDFs are allowed"), false)
    }
  },
})

router.post("/extract-invoice", upload.single("invoice_image"), async (req, res) => {
  try {
    console.log("[v0] OCR request received, file:", req.file?.filename)
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      })
    }

    const imagePath = path.resolve(req.file.path)
    console.log("[v0] Processing file:", imagePath)
    
    const scriptPath = path.resolve(__dirname, "../python-scripts")
    const scriptFile = path.resolve(scriptPath, "ocr_extraction.py")
    
    console.log("[v0] Script path:", scriptFile)
    console.log("[v0] Script file exists:", fs.existsSync(scriptFile))
    console.log("[v0] Image file exists:", fs.existsSync(imagePath))
    
    if (!fs.existsSync(scriptFile)) {
      throw new Error(`Python script not found at: ${scriptFile}`)
    }
    
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found at: ${imagePath}`)
    }

    // --- Critical Fix: Use spawn with proper stdout/stderr separation ---
    let extractedDataStr = await new Promise((resolve, reject) => {
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
      
      console.log("[v0] Running Python script:", scriptFile)
      console.log("[v0] With args:", imagePath)
      console.log("[v0] Python command:", pythonCmd)

      const pythonProcess = spawn(pythonCmd, ['-u', scriptFile, imagePath], {
        cwd: path.dirname(scriptFile),
      })
      
      let stdout = ''
      let stderr = ''

      const timeout = setTimeout(() => {
        pythonProcess.kill()
        reject(new Error("OCR processing timed out after 120 seconds"))
      }, 120000)

      const startTime = Date.now()

      pythonProcess.stdout.on('data', (data) => {
        const chunk = data.toString()
        stdout += chunk
        // Do NOT log stdout here — it must be pure JSON
      })

      pythonProcess.stderr.on('data', (data) => {
        const line = data.toString().trim()
        if (line) console.log("[PY DEBUG]", line)
        stderr += data.toString()
      })

      pythonProcess.on('close', (code) => {
        clearTimeout(timeout)
        const duration = Date.now() - startTime
        console.log(`[v0] Python exited with code ${code} in ${duration}ms`)

        if (code !== 0) {
          console.error("[v0] Python stderr:", stderr)
          return reject(new Error(`OCR failed (exit ${code}): ${stderr || 'No error output'}`))
        }

        const output = stdout.trim()
        if (!output) {
          return reject(new Error("OCR script returned empty output"))
        }

        resolve(output)
      })

      pythonProcess.on('error', (err) => {
        clearTimeout(timeout)
        reject(new Error(`Failed to start Python: ${err.message}`))
      })
    })

    // --- Parse JSON safely ---
    let extractedData
    try {
      extractedData = JSON.parse(extractedDataStr)
    } catch (e) {
      console.error("[v0] Invalid JSON from Python:", extractedDataStr.substring(0, 500))
      throw new Error(`OCR output is not valid JSON: ${e.message}`)
    }

    // --- Check for Python-level error ---
    if (extractedData.error) {
      console.error("[v0] OCR script reported error:", extractedData.error)
      throw new Error(extractedData.error)
    }

    // --- Normalize data ---
    const normalizedData = {
      success: true,
      invoice_number: extractedData['Invoice Number'] || "N/A",
      invoice_date: extractedData['Invoice Date'] || new Date().toISOString().split('T')[0],
      vendor_name: extractedData['Vendor Name'] || "Unknown",
      vendor_gstin: extractedData['Vendor GSTIN'] || "",
      customer_name: extractedData['Customer Name'] || "N/A",
      customer_gstin: extractedData['Customer GSTIN'] || "",
      customer_email: extractedData['Customer Email'] || "",
      customer_phone: extractedData['Customer Phone'] || "",
      items: extractedData['Items'] || [],
      subtotal: parseFloat(extractedData['Taxable Amount'] || 0) || 0,
      cgst: parseFloat(extractedData['CGST Amount'] || 0) || 0,
      sgst: parseFloat(extractedData['SGST Amount'] || 0) || 0,
      igst: parseFloat(extractedData['IGST Amount'] || 0) || 0,
      tax: parseFloat(extractedData['Total Tax'] || 0) || 0,
      total: parseFloat(extractedData['Total Amount'] || 0) || 0,
      raw_extracted: extractedData
    }

    // --- Cleanup uploaded file ---
    fs.unlink(imagePath, (err) => {
      if (err) console.error("[v0] Failed to delete upload:", err)
    })

    console.log("[v0] OCR Success → Invoice:", normalizedData.invoice_number)
    res.status(200).json(normalizedData)

  } catch (error) {
    console.error("[v0] OCR Error:", error.message)
    if (req.file?.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("[v0] Failed to cleanup upload:", err)
      })
    }
    res.status(500).json({
      success: false,
      error: error.message || "OCR processing failed",
    })
  }
})

// --- /create-invoice route (unchanged) ---
router.post("/create-invoice", authMiddleware, async (req, res) => {
  try {
    const { 
      customer_name, 
      customer_gstin, 
      customer_email, 
      customer_phone,
      invoice_date,
      items,
      subtotal,
      cgst,
      sgst,
      igst,
      total,
      invoice_number
    } = req.body

    console.log("[v0] Creating invoice from OCR data")
    console.log("[v0] Customer:", customer_name)
    console.log("[v0] Items count:", items?.length || 0)

    if (!customer_name || customer_name === "N/A") {
      return res.status(400).json({ 
        success: false, 
        error: "Customer name is required to create invoice" 
      })
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "At least one item is required to create invoice" 
      })
    }

    const client = await pool.connect()
    await client.query("BEGIN")

    try {
      let customerResult = await client.query(
        `SELECT id FROM customers 
         WHERE name = $1 AND organization_id = $2 
         LIMIT 1`,
        [customer_name.trim(), req.user.organizationId]
      )

      let customerId
      if (customerResult.rows.length > 0) {
        customerId = customerResult.rows[0].id
      } else {
        const newCustomerResult = await client.query(
          `INSERT INTO customers 
           (organization_id, branch_id, name, phone, email, gstin)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            req.user.organizationId,
            req.user.branchId || 1,
            customer_name.trim(),
            customer_phone || null,
            customer_email || null,
            customer_gstin || null
          ]
        )
        customerId = newCustomerResult.rows[0].id
      }

      let taxable_value = subtotal || 0
      let cgst_amount = cgst || 0
      let sgst_amount = sgst || 0
      let igst_amount = igst || 0

      if (taxable_value === 0 && items.length > 0) {
        taxable_value = items.reduce((sum, item) => {
          const qty = parseFloat(item.qty || item['Quantity'] || 1)
          const price = parseFloat(item.price || item['Unit Price'] || 0)
          return sum + (qty * price)
        }, 0)
      }

      const net_amount = total || (taxable_value + cgst_amount + sgst_amount + igst_amount)

      let parsedDate = new Date().toISOString().split('T')[0]
      if (invoice_date) {
        const dateObj = new Date(invoice_date)
        if (!isNaN(dateObj.getTime())) {
          parsedDate = dateObj.toISOString().split('T')[0]
        }
      }

      // Sanitize invoice number: drop generic terms, avoid duplicates per organization
      let sanitizedInv = (invoice_number || "").toString().trim()
      if (!sanitizedInv || /^(original|duplicate|copy|tax\s*invoice)$/i.test(sanitizedInv) || sanitizedInv.length < 3) {
        sanitizedInv = null
      } else {
        const dupCheck = await client.query(
          `SELECT 1 FROM invoices WHERE organization_id = $1 AND invoice_number = $2 LIMIT 1`,
          [req.user.organizationId, sanitizedInv]
        )
        if (dupCheck.rows.length > 0) {
          sanitizedInv = `${sanitizedInv}-${Date.now()}`
        }
      }

      const invoiceResult = await client.query(
        `INSERT INTO invoices (
          organization_id, customer_id, created_by, invoice_type, issue_date,
          taxable_value, cgst_amount, sgst_amount, igst_amount,
          net_amount, payment_status, invoice_number
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          req.user.organizationId,
          customerId,
          req.user.userId,
          "GST",
          parsedDate,
          taxable_value,
          cgst_amount,
          sgst_amount,
          igst_amount,
          net_amount,
          "pending",
          sanitizedInv || `INV-${Date.now()}`
        ]
      )

      const invoiceId = invoiceResult.rows[0].id

      for (const item of items) {
        const description = item.description || item['Item Name'] || "Item"
        let qty = parseFloat(item.qty || item['Quantity'] || 1)
        let price = parseFloat(item.price || item['Unit Price'] || 0)
        const gstRate = parseFloat(item.applied_gst_rate || item['GST Rate'] || 0)
        
        if (isNaN(qty) || qty <= 0) qty = 1
        if (isNaN(price) || price < 0) price = 0
        
        const lineTotal = qty * price

        await client.query(
          `INSERT INTO invoice_items (
            invoice_id, product_id, description,
            qty, price, applied_gst_rate, line_discount, line_total
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            invoiceId,
            item.product_id || null,
            description,
            qty,
            price,
            gstRate,
            0,
            lineTotal
          ]
        )
      }

      await client.query("COMMIT")
      client.release()

      const finalInvoiceResult = await pool.query(
        `SELECT i.*, c.name AS customer_name 
         FROM invoices i 
         LEFT JOIN customers c ON i.customer_id = c.id 
         WHERE i.id = $1`,
        [invoiceId]
      )

      res.status(201).json({
        success: true,
        invoice: finalInvoiceResult.rows[0],
        message: "Invoice created successfully from OCR data"
      })
    } catch (error) {
      await client.query("ROLLBACK")
      client.release()
      throw error
    }
  } catch (error) {
    console.error("[v0] Error creating invoice from OCR:", error)
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create invoice from OCR data"
    })
  }
})

export default router