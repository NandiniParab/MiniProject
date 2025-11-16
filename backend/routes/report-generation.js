import express from "express"
import { PythonShell } from "python-shell"
import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"
import pool from "../config/database.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

router.post("/generate-report", async (req, res) => {
  try {
    console.log("[v0] Report generation requested")
    
    // Fetch all invoices with their items
    const result = await pool.query(
      `SELECT i.*, c.name as customer_name, c.gstin as customer_gstin
       FROM invoices i 
       LEFT JOIN customers c ON i.customer_id = c.id 
       ORDER BY i.created_at DESC`,
    )

    // Fetch invoice items for each invoice
    const invoicesWithItems = await Promise.all(
      result.rows.map(async (inv) => {
        const itemsRes = await pool.query(
          "SELECT * FROM invoice_items WHERE invoice_id = $1",
          [inv.id]
        )
        return {
          'Invoice Number': inv.invoice_number,
          'Invoice Date': inv.issue_date,
          'Vendor Name': 'Your Business',
          'Vendor GSTIN': process.env.BUSINESS_GSTIN || '',
          'Customer Name': inv.customer_name,
          'Customer GSTIN': inv.customer_gstin || '',
          'Taxable Amount': parseFloat(inv.taxable_value) || 0,
          'CGST Amount': parseFloat(inv.cgst_amount) || 0,
          'SGST Amount': parseFloat(inv.sgst_amount) || 0,
          'IGST Amount': parseFloat(inv.igst_amount) || 0,
          'Total Amount': parseFloat(inv.net_amount) || 0,
          'Items': itemsRes.rows.map(item => ({
            'Item Name': item.description,
            'Quantity': item.quantity,
            'Unit Price': item.price,
            'Line Total': item.quantity * item.price,
            'GST Rate': item.gst_rate
          })),
          raw_text: ''
        }
      })
    )

    const invoicesJson = JSON.stringify(invoicesWithItems)
    const reportDir = "reports"

    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true })
    }

    const outputPath = path.join(reportDir, `invoice_report_${Date.now()}.xlsx`)

    console.log("[v0] Calling report generation script...")

    // Call Python report generation using the provided report_generation.py
    const scriptPath = path.resolve(__dirname, "../python-scripts")
    const scriptFile = path.resolve(scriptPath, "report_generation.py")
    
    await new Promise((resolve, reject) => {
      PythonShell.run(scriptFile, {
        args: [invoicesJson, outputPath],
        pythonPath: process.platform === 'win32' ? 'python' : 'python3',
        pythonOptions: ['-u']
      }, (err, results) => {
        if (err) {
          console.error("[v0] Report generation error:", err)
          reject(new Error(`Report generation failed: ${err.message}`))
        } else {
          console.log("[v0] Report generation completed")
          resolve(results)
        }
      })
    })

    // Send Excel file
    res.download(outputPath, `invoice_report_${Date.now()}.xlsx`)
  } catch (error) {
    console.error("[v0] Report Error:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
