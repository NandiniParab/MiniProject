import express from "express"
import pool from "../config/database.js"
import { authMiddleware } from "../middleware/auth.js"

const router = express.Router()

router.use(authMiddleware)

// All payments for organization
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, i.invoice_number, i.due_date, i.net_amount, i.payment_status, c.name AS customer_name
       FROM payments p
       JOIN invoices i ON p.invoice_id = i.id
       LEFT JOIN customers c ON i.customer_id = c.id
       WHERE i.organization_id = $1
       ORDER BY p.received_at DESC`,
      [req.user.organizationId],
    )

    const now = new Date()
    const rows = result.rows.map((r) => {
      const overdue = r.due_date && new Date(r.due_date) < now && r.payment_status !== "paid"
      const display_status = overdue ? "Overdue" : r.status === "success" ? (r.payment_status === "paid" ? "Paid" : "Partial") : r.status
      return { ...r, display_status }
    })

    res.json(rows)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Record payment
router.post("/", async (req, res) => {
  const { invoice_id, method, provider, txn_id, status, amount } = req.body

  try {
    const result = await pool.query(
      `INSERT INTO payments (invoice_id, method, provider, txn_id, status, amount, received_at) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
       RETURNING *`,
      [invoice_id, method, provider, txn_id, status || "success", amount],
    )

    // Update invoice payment status if full payment received
    const invoiceResult = await pool.query("SELECT net_amount, payment_status, due_date FROM invoices WHERE id = $1", [
      invoice_id,
    ])
    const invoice = invoiceResult.rows[0]

    // Sum existing successful payments
    const paidResult = await pool.query("SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id = $1 AND status = 'success'", [invoice_id])
    const totalPaid = Number(paidResult.rows[0].paid) + Number(amount)

    if (totalPaid >= Number(invoice.net_amount)) {
      await pool.query("UPDATE invoices SET payment_status = $1 WHERE id = $2", ["paid", invoice_id])
    } else {
      await pool.query("UPDATE invoices SET payment_status = $1 WHERE id = $2", ["partial", invoice_id])
    }

    res.status(201).json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get payments for invoice
router.get("/invoice/:invoiceId", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM payments WHERE invoice_id = $1 ORDER BY received_at DESC", [
      req.params.invoiceId,
    ])
    res.json(result.rows)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
