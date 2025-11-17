import express from "express"
import pool from "../config/database.js"
import { authMiddleware, roleCheck } from "../middleware/auth.js"
import { Parser } from "json2csv"

const router = express.Router()
router.use(authMiddleware)

const toCSV = (rows, fields, filename, res) => {
  const parser = new Parser({ fields })
  const csv = parser.parse(rows)
  res.header("Content-Type", "text/csv")
  res.attachment(filename)
  res.send(csv)
}

// Utility to get invoices in period for organization
async function getInvoices(orgId, start, end) {
  let where = "organization_id = $1"
  const params = [orgId]
  if (start && end) {
    params.push(start, end)
    where += ` AND issue_date BETWEEN $${params.length - 1} AND $${params.length}`
  }
  const res = await pool.query(`SELECT * FROM invoices WHERE ${where} ORDER BY issue_date ASC`, params)
  return res.rows
}

// GSTR-1 JSON
router.get("/gstr1", roleCheck(["admin", "accountant"]), async (req, res) => {
  try {
    const { start, end } = req.query
    const invoices = await getInvoices(req.user.organizationId, start, end)
    const data = invoices.map((i) => ({
      invoiceNumber: i.invoice_number,
      invoiceDate: new Date(i.issue_date).toLocaleDateString("en-GB"),
      invoiceValue: Number(i.net_amount) || 0,
      placeOfSupply: i.place_of_supply_state || "",
      taxableValue: Number(i.taxable_value) || 0,
      igst: Number(i.igst_amount) || 0,
      cgst: Number(i.cgst_amount) || 0,
      sgst: Number(i.sgst_amount) || 0,
      cess: Number(i.cess_amount) || 0,
      ewaybillNo: i.ewaybill_no || "",
      documentType: "Regular",
    }))
    res.json({ period: { start, end }, count: data.length, data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GSTR-1 export
router.get("/gstr1/export", roleCheck(["admin", "accountant"]), async (req, res) => {
  try {
    const { start, end, format = "json" } = req.query
    const invoices = await pool.query(
      `SELECT i.*, c.gstin AS recipient_gstin FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id WHERE i.organization_id = $1 ${start && end ? "AND i.issue_date BETWEEN $2 AND $3" : ""} ORDER BY i.issue_date ASC`,
      start && end ? [req.user.organizationId, start, end] : [req.user.organizationId],
    )
    if (format === "csv") {
      const rows = invoices.rows.map((inv) => ({
        SupplierGSTIN: "",
        RecipientGSTIN: inv.recipient_gstin || "",
        InvoiceNo: inv.invoice_number,
        InvoiceDate: new Date(inv.issue_date).toLocaleDateString("en-GB"),
        InvoiceValue: inv.net_amount || 0,
        PlaceOfSupply: inv.place_of_supply_state || "",
        Rate: Number(inv.taxable_value) ? (((Number(inv.cgst_amount) + Number(inv.sgst_amount) + Number(inv.igst_amount)) / Number(inv.taxable_value)) * 100).toFixed(2) : "0",
        TaxableValue: inv.taxable_value || 0,
        IGST: inv.igst_amount || 0,
        CentralTax: inv.cgst_amount || 0,
        StateTax: inv.sgst_amount || 0,
        Cess: inv.cess_amount || 0,
        EWayBillNo: inv.ewaybill_no || "",
        DocumentType: "Regular",
      }))
      const fields = ["SupplierGSTIN","RecipientGSTIN","InvoiceNo","InvoiceDate","InvoiceValue","PlaceOfSupply","Rate","TaxableValue","IGST","CentralTax","StateTax","Cess","EWayBillNo","DocumentType"]
      return toCSV(rows, fields, "GSTR1_Data.csv", res)
    }
    res.json({ period: { start, end }, data: invoices.rows })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GSTR-3B JSON (summary)
router.get("/gstr3b", roleCheck(["admin", "accountant"]), async (req, res) => {
  try {
    const { start, end } = req.query
    const invoices = await getInvoices(req.user.organizationId, start, end)
    const summary = invoices.reduce((acc, i) => {
      acc.taxable += Number(i.taxable_value) || 0
      acc.cgst += Number(i.cgst_amount) || 0
      acc.sgst += Number(i.sgst_amount) || 0
      acc.igst += Number(i.igst_amount) || 0
      acc.cess += Number(i.cess_amount) || 0
      return acc
    }, { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 })
    res.json({ period: { start, end }, summary })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GSTR-3B export
router.get("/gstr3b/export", roleCheck(["admin", "accountant"]), async (req, res) => {
  try {
    const { start, end, format = "json" } = req.query
    const result = await pool.query(
      `SELECT SUM(taxable_value) as taxable, SUM(cgst_amount) as cgst, SUM(sgst_amount) as sgst, SUM(igst_amount) as igst, SUM(cess_amount) as cess FROM invoices WHERE organization_id = $1 ${start && end ? "AND issue_date BETWEEN $2 AND $3" : ""}`,
      start && end ? [req.user.organizationId, start, end] : [req.user.organizationId],
    )
    const row = result.rows[0]
    if (format === "csv") {
      const fields = ["Taxable","CGST","SGST","IGST","Cess"]
      const rows = [{ Taxable: row.taxable || 0, CGST: row.cgst || 0, SGST: row.sgst || 0, IGST: row.igst || 0, Cess: row.cess || 0 }]
      return toCSV(rows, fields, "GSTR3B_Summary.csv", res)
    }
    res.json({ period: { start, end }, summary: row })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router