import express from "express"
import { PythonShell } from "python-shell"
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

router.post("/:invoiceId/generate-pdf", async (req, res) => {
  try {
    const { invoiceId } = req.params
    console.log("[v0] PDF generation requested for invoice:", invoiceId)

    // Fetch invoice data from database
    const invoiceResult = await pool.query(
      `SELECT i.*, c.name as customer_name, c.gstin as customer_gstin 
       FROM invoices i 
       LEFT JOIN customers c ON i.customer_id = c.id 
       WHERE i.id = $1`,
      [invoiceId],
    )

    const itemsResult = await pool.query(
      `SELECT ii.* FROM invoice_items ii WHERE ii.invoice_id = $1`,
      [invoiceId],
    )

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Invoice not found" })
    }

    const invoice = invoiceResult.rows[0]
    const items = itemsResult.rows.map(item => {
      const qty = item.qty || item.quantity || 1
      const price = item.price || 0
      const lineTotal = (qty * price) - (item.line_discount || 0)
      const gstRate = item.applied_gst_rate || 0
      const gstAmount = (lineTotal * gstRate) / 100
      return {
        'Item Name': item.description || 'Item',
        'HSN/SAC Code': item.hsn_code || '',
        'Quantity': qty,
        'Unit Price': price,
        'Line Total': lineTotal,
        'GST Rate': gstRate,
        'GST Amount': gstAmount
      }
    })

    // Build OCR-like structure expected by pdf_creation.py normaliser
    const ocrData = {
      'Invoice Number': invoice.invoice_number,
      'Invoice Date': invoice.issue_date,
      'Vendor Name': process.env.BUSINESS_NAME || 'Business',
      'Vendor GSTIN': process.env.BUSINESS_GSTIN || '',
      'Customer Name': invoice.customer_name || '',
      'Customer GSTIN': invoice.customer_gstin || '',
      'Customer Address': invoice.place_of_supply_state ? `State (${invoice.place_of_supply_state})` : '',
      'Items': items,
      'Taxable Amount': parseFloat(invoice.taxable_value) || 0,
      'CGST Amount': parseFloat(invoice.cgst_amount) || 0,
      'SGST Amount': parseFloat(invoice.sgst_amount) || 0,
      'IGST Amount': parseFloat(invoice.igst_amount) || 0,
      'Total Tax': ((parseFloat(invoice.cgst_amount) || 0) + (parseFloat(invoice.sgst_amount) || 0) + (parseFloat(invoice.igst_amount) || 0)),
      'Total Amount': parseFloat(invoice.net_amount) || 0
    }

    const pdfDir = path.resolve(__dirname, "../pdfs")
    const tempDir = path.resolve(__dirname, "../temp")
    
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true })
    }
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const outputPath = path.join(pdfDir, `invoice_${invoiceId}.pdf`)
    const tempJsonPath = path.join(tempDir, `invoice_${invoiceId}_${Date.now()}.json`)

    // Write JSON to temp file (Python script expects file path)
    const invoiceJson = JSON.stringify(ocrData, null, 2)
    fs.writeFileSync(tempJsonPath, invoiceJson, 'utf8')

    console.log("[v0] Calling PDF generation script...")
    console.log("[v0] Temp JSON file:", tempJsonPath)
    console.log("[v0] Output PDF path:", outputPath)
    
    // Call Python PDF generation using the provided pdf_creation.py
    const scriptPath = path.resolve(__dirname, "../python-scripts")
    const scriptFile = path.resolve(scriptPath, "pdf_creation.py")
    
    await new Promise((resolve, reject) => {
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
      
      const pythonProcess = spawn(pythonCmd, ['-u', scriptFile, tempJsonPath, '--out', outputPath], {
        cwd: scriptPath,
        stdio: ['ignore', 'pipe', 'pipe']
      })
      
      let stdout = ''
      let stderr = ''
      
      const timeout = setTimeout(() => {
        pythonProcess.kill()
        reject(new Error("PDF generation timed out after 60 seconds"))
      }, 60000)
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString()
        console.log("[v0] PDF stdout:", data.toString().trim())
      })
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString()
        console.log("[v0] PDF stderr:", data.toString().trim())
      })
      
      pythonProcess.on('close', (code) => {
        clearTimeout(timeout)
        // Clean up temp JSON file
        if (fs.existsSync(tempJsonPath)) {
          fs.unlinkSync(tempJsonPath)
        }
        
        if (code !== 0) {
          console.error("[v0] PDF generation failed with exit code:", code)
          console.error("[v0] Stderr:", stderr)
          reject(new Error(`PDF generation failed: ${stderr || 'Unknown error'}`))
        } else {
          console.log("[v0] PDF generation completed successfully")
          if (!fs.existsSync(outputPath)) {
            reject(new Error("PDF file was not created"))
          } else {
            resolve()
          }
        }
      })
      
      pythonProcess.on('error', (err) => {
        clearTimeout(timeout)
        console.error("[v0] PDF process error:", err)
        reject(new Error(`Failed to start PDF generation: ${err.message}`))
      })
    })

    // Send PDF
    res.download(outputPath, `invoice_${invoiceId}.pdf`)
  } catch (error) {
    console.error("[v0] PDF Error:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
