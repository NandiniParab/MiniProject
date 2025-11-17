import express from "express"
import pool from "../config/database.js"
import { authMiddleware } from "../middleware/auth.js"
import { PythonShell } from "python-shell"
import fs from "fs"

const router = express.Router()

router.use(authMiddleware)

// ---------------------------
// Generate Invoice PDF
// ---------------------------
router.post("/:id/generate-pdf", async (req, res) => {
  try {
    const invoiceResult = await pool.query(
      `SELECT i.*, c.name AS customer_name, c.gstin 
       FROM invoices i 
       LEFT JOIN customers c ON i.customer_id = c.id 
       WHERE i.id = $1 AND i.organization_id = $2`,
      [req.params.id, req.user.organizationId],
    )

    const itemsResult = await pool.query(
      `SELECT ii.*, p.name AS product_name 
       FROM invoice_items ii 
       LEFT JOIN products p ON ii.product_id = p.id 
       WHERE ii.invoice_id = $1`,
      [req.params.id],
    )

    const invoice = { ...invoiceResult.rows[0], items: itemsResult.rows }
    const invoiceJson = JSON.stringify(invoice)

    const outputPath = `pdfs/invoice_${req.params.id}.pdf`

    await new Promise((resolve, reject) => {
      PythonShell.run(
        "python_scripts/pdf_creation.py",
        {
          args: [invoiceJson, outputPath],
          scriptPath: "backend",
        },
        (err, results) => {
          if (err) reject(err)
          resolve(results)
        },
      )
    })

    res.download(outputPath)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ---------------------------
// Get All Invoices
// ---------------------------
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, c.name AS customer_name 
       FROM invoices i 
       LEFT JOIN customers c ON i.customer_id = c.id 
       WHERE i.organization_id = $1 
       ORDER BY i.created_at DESC`,
      [req.user.organizationId],
    )

    res.json(result.rows)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ---------------------------
// Create Invoice
// ---------------------------
router.post("/", async (req, res) => {
  const { customer_id, invoice_type, issue_date, items, payment_status } = req.body

  try {
    const client = await pool.connect()
    await client.query("BEGIN")

    let taxable_value = 0
    let cgst_amount = 0
    let sgst_amount = 0
    const igst_amount = 0

    items.forEach((item) => {
      const lineTotal = item.qty * item.price - (item.line_discount || 0)
      taxable_value += lineTotal

      const gstAmount = lineTotal * (item.applied_gst_rate / 100)
      if (item.applied_gst_rate) {
        cgst_amount += gstAmount / 2
        sgst_amount += gstAmount / 2
      }
    })

    const net_amount = taxable_value + cgst_amount + sgst_amount + igst_amount

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
        customer_id,
        req.user.userId,
        invoice_type,
        issue_date,
        taxable_value,
        cgst_amount,
        sgst_amount,
        igst_amount,
        net_amount,
        payment_status || "pending",
        `INV-${Date.now()}`,
      ],
    )

    const invoiceId = invoiceResult.rows[0].id

    for (const item of items) {
      const lineTotal = item.qty * item.price - (item.line_discount || 0)

      await client.query(
        `INSERT INTO invoice_items (
          invoice_id, product_id, description,
          qty, price, applied_gst_rate, line_discount, line_total
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          invoiceId,
          item.product_id || null,
          item.description,
          item.qty,
          item.price,
          item.applied_gst_rate || 0,
          item.line_discount || 0,
          lineTotal,
        ],
      )
    }

    await client.query("COMMIT")
    client.release()

    res.status(201).json(invoiceResult.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ---------------------------
// Get Invoice Details
// ---------------------------
router.get("/:id", async (req, res) => {
  try {
    const invoiceResult = await pool.query(
      `SELECT i.*, c.name AS customer_name, c.gstin
       FROM invoices i 
       LEFT JOIN customers c ON i.customer_id = c.id 
       WHERE i.id = $1 AND i.organization_id = $2`,
      [req.params.id, req.user.organizationId],
    )

    const itemsResult = await pool.query(
      `SELECT ii.*, p.name AS product_name
       FROM invoice_items ii 
       LEFT JOIN products p ON ii.product_id = p.id 
       WHERE ii.invoice_id = $1`,
      [req.params.id],
    )

    res.json({ ...invoiceResult.rows[0], items: itemsResult.rows })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ---------------------------
// Update Payment Status
// ---------------------------
router.put("/:id/payment", async (req, res) => {
  const { payment_status } = req.body

  try {
    const result = await pool.query(
      `UPDATE invoices 
       SET payment_status = $1 
       WHERE id = $2 AND organization_id = $3 
       RETURNING *`,
      [payment_status, req.params.id, req.user.organizationId],
    )

    res.json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
