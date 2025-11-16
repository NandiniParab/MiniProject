"use client"

import { useState, useEffect } from "react"
import Layout from "../components/Layout"
import apiClient from "../components/ApiClient"
import { Plus, Eye, Download, FileText } from 'lucide-react'
import InvoiceUploader from '../components/InvoiceUploader'

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [showUploader, setShowUploader] = useState(false)
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    customer_id: "",
    invoice_type: "GST",
    issue_date: new Date().toISOString().split("T")[0],
    due_date: new Date().toISOString().split("T")[0],
    invoice_number: "",
    discount_amount: 0,
    rounding: 0,
    place_of_supply_state: "",
    payment_status: "pending",
    items: [],
  })
  const [currentItem, setCurrentItem] = useState({
    product_id: "",
    description: "",
    qty: 1,
    price: 0,
    applied_gst_rate: 0,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [inv, cust, prod] = await Promise.all([
          apiClient.get("/invoices"),
          apiClient.get("/customers"),
          apiClient.get("/products"),
        ])
        setInvoices(inv.data)
        setCustomers(cust.data)
        setProducts(prod.data)
      } catch (err) {
        console.error("Failed to fetch data", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleAddItem = () => {
    if (currentItem.description && currentItem.qty > 0 && currentItem.price > 0) {
      setFormData({
        ...formData,
        items: [...formData.items, { ...currentItem, product_id: Number.parseInt(currentItem.product_id) || null }],
      })
      setCurrentItem({ product_id: "", description: "", qty: 1, price: 0, applied_gst_rate: 0 })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.customer_id || formData.items.length === 0) {
      alert("Please select customer and add items")
      return
    }
    try {
      await apiClient.post("/invoices", {
        ...formData,
        customer_id: Number.parseInt(formData.customer_id),
        items: formData.items.map((item) => ({
          ...item,
          applied_gst_rate: Number.parseFloat(item.applied_gst_rate),
          qty: Number.parseFloat(item.qty),
          price: Number.parseFloat(item.price),
        })),
      })
      setFormData({
        customer_id: "",
        invoice_type: "GST",
        issue_date: new Date().toISOString().split("T")[0],
        due_date: new Date().toISOString().split("T")[0],
        invoice_number: "",
        discount_amount: 0,
        rounding: 0,
        place_of_supply_state: "",
        payment_status: "pending",
        items: [],
      })
      setShowForm(false)
      const res = await apiClient.get("/invoices")
      setInvoices(res.data)
    } catch (err) {
      console.error("Failed to create invoice", err)
      alert("Failed to create invoice: " + (err.response?.data?.error || err.message))
    }
  }

  const handleViewInvoice = async (invoiceId) => {
    try {
      const response = await apiClient.get(`/invoices/${invoiceId}`)
      setSelectedInvoice(response.data)
      setShowInvoiceDetails(true)
    } catch (error) {
      console.error("Error fetching invoice:", error)
      alert("Failed to load invoice details: " + (error.response?.data?.error || error.message))
    }
  }

  const handleGeneratePDF = async (invoiceId) => {
    try {
      setLoading(true)
      const response = await fetch(`http://localhost:5000/api/pdf/${invoiceId}/generate-pdf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `invoice_${invoiceId}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to generate PDF" }))
        alert("Failed to generate PDF: " + (errorData.error || "Unknown error"))
      }
    } catch (error) {
      console.error("PDF generation error:", error)
      alert("Error generating PDF: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateReport = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/report-gen/generate-report", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `invoice_report_${new Date().getTime()}.xlsx`
        a.click()
      } else {
        alert("Failed to generate report")
      }
    } catch (error) {
      alert("Error: " + error.message)
    }
  }

  const handleOCRSuccess = async (extractedData) => {
    console.log("[v0] OCR Success - Extracted data:", extractedData)
    
    try {
      // Automatically create invoice from extracted data
      const response = await fetch("http://localhost:5000/api/ocr/create-invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          customer_name: extractedData.customer_name,
          customer_gstin: extractedData.customer_gstin,
          customer_email: extractedData.customer_email,
          customer_phone: extractedData.customer_phone,
          invoice_date: extractedData.invoice_date,
          invoice_number: extractedData.invoice_number,
          items: extractedData.items && extractedData.items.length > 0
            ? extractedData.items.map((item) => ({
                description: item['Item Name'] || item.name || item.description || "Item",
                qty: parseFloat(item['Quantity'] || item.qty || 1),
                price: parseFloat(item['Unit Price'] || item.price || 0),
                applied_gst_rate: parseFloat(item['GST Rate'] || item.gst_rate || 0),
                product_id: item.product_id || null,
              }))
            : extractedData.total && extractedData.total > 0
            ? [{
                description: extractedData.vendor_name || "Invoice Item",
                qty: 1,
                price: extractedData.total || 0,
                applied_gst_rate: extractedData.tax > 0 ? ((extractedData.tax / extractedData.subtotal) * 100) : 0,
                product_id: null,
              }]
            : [],
          subtotal: extractedData.subtotal,
          cgst: extractedData.cgst,
          sgst: extractedData.sgst,
          igst: extractedData.igst,
          total: extractedData.total,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create invoice")
      }

      const result = await response.json()
      console.log("[v0] Invoice created:", result)

      // Refresh invoice list
      const invRes = await apiClient.get("/invoices")
      setInvoices(invRes.data)

      setShowUploader(false)
      setShowForm(false)

      // Show success message
      const netAmount = typeof result.invoice.net_amount === 'number' 
        ? result.invoice.net_amount 
        : parseFloat(result.invoice.net_amount) || 0
      alert(`Invoice created successfully!\nInvoice #: ${result.invoice.invoice_number}\nTotal: ₹${netAmount.toFixed(2)}`)
    } catch (error) {
      console.error("[v0] Error creating invoice:", error)
      alert(`Failed to create invoice: ${error.message}\n\nYou can still create it manually using the form.`)
      
      // Fallback: Pre-fill form with extracted data for manual creation
      const newFormData = {
        ...formData,
        issue_date: extractedData.invoice_date || formData.issue_date,
      }
      
      if (extractedData.items && extractedData.items.length > 0) {
        newFormData.items = extractedData.items.map((item) => ({
          description: item['Item Name'] || item.name || item.description || "Item",
          qty: parseFloat(item['Quantity'] || item.qty || 1),
          price: parseFloat(item['Unit Price'] || item.price || 0),
          applied_gst_rate: parseFloat(item['GST Rate'] || item.gst_rate || 0),
          product_id: item.product_id || "",
        }))
      } else if (extractedData.total && extractedData.total > 0) {
        newFormData.items = [
          {
            description: extractedData.vendor_name || "Invoice Item",
            qty: 1,
            price: extractedData.total || 0,
            applied_gst_rate: extractedData.tax > 0 ? ((extractedData.tax / extractedData.subtotal) * 100) : 0,
            product_id: "",
          },
        ]
      }
      
      setFormData(newFormData)
      setShowUploader(false)
      setShowForm(true)
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">Invoices</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowUploader(!showUploader)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Download size={20} /> Upload Invoice
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={20} /> Create Invoice
            </button>
            <button
              onClick={handleGenerateReport}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <FileText size={20} /> Export Report
            </button>
          </div>
        </div>

        {showUploader && (
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Upload Invoice Image</h3>
            <InvoiceUploader onSuccess={handleOCRSuccess} />
            <button
              onClick={() => setShowUploader(false)}
              className="mt-4 px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500"
            >
              Close
            </button>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="invoice-customer" className="block text-sm font-medium mb-1">Customer</label>
                <select
                  id="invoice-customer"
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="invoice-type" className="block text-sm font-medium mb-1">Type</label>
                <select
                  id="invoice-type"
                  value={formData.invoice_type}
                  onChange={(e) => setFormData({ ...formData, invoice_type: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option>GST</option>
                  <option>Non-GST</option>
                </select>
              </div>
              <div>
                <label htmlFor="invoice-date" className="block text-sm font-medium mb-1">Issue Date</label>
                <input
                  id="invoice-date"
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label htmlFor="invoice-number" className="block text-sm font-medium mb-1">Invoice Number</label>
                <input
                  id="invoice-number"
                  type="text"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label htmlFor="invoice-due-date" className="block text-sm font-medium mb-1">Due Date</label>
                <input
                  id="invoice-due-date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label htmlFor="invoice-place-of-supply" className="block text-sm font-medium mb-1">Place of Supply (State)</label>
                <input
                  id="invoice-place-of-supply"
                  type="text"
                  value={formData.place_of_supply_state}
                  onChange={(e) => setFormData({ ...formData, place_of_supply_state: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label htmlFor="invoice-discount" className="block text-sm font-medium mb-1">Discount Amount</label>
                <input
                  id="invoice-discount"
                  type="number"
                  value={formData.discount_amount}
                  onChange={(e) => setFormData({ ...formData, discount_amount: Number.parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label htmlFor="invoice-rounding" className="block text-sm font-medium mb-1">Rounding</label>
                <input
                  id="invoice-rounding"
                  type="number"
                  value={formData.rounding}
                  onChange={(e) => setFormData({ ...formData, rounding: Number.parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Add Items</h3>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3">
                <div>
                  <label htmlFor="item-product" className="block text-xs font-medium mb-1">Product</label>
                  <select
                    id="item-product"
                    value={currentItem.product_id}
                    onChange={(e) => setCurrentItem({ ...currentItem, product_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Select Product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="item-description" className="block text-xs font-medium mb-1">Description</label>
                  <input
                    id="item-description"
                    type="text"
                    value={currentItem.description}
                    onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="item-qty" className="block text-xs font-medium mb-1">Qty</label>
                  <input
                    id="item-qty"
                    type="number"
                    value={currentItem.qty}
                    onChange={(e) => setCurrentItem({ ...currentItem, qty: Number.parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="item-price" className="block text-xs font-medium mb-1">Price</label>
                  <input
                    id="item-price"
                    type="number"
                    value={currentItem.price}
                    onChange={(e) => setCurrentItem({ ...currentItem, price: Number.parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="item-gst" className="block text-xs font-medium mb-1">GST %</label>
                  <input
                    id="item-gst"
                    type="number"
                    value={currentItem.applied_gst_rate}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, applied_gst_rate: Number.parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                  >
                    Add
                  </button>
                </div>
              </div>

              {formData.items.length > 0 && (
                <div className="bg-gray-50 p-3 rounded-lg text-sm max-h-48 overflow-y-auto">
                  {formData.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between py-1">
                      <span>{item.description || "Item"}</span>
                      <span>₹{(item.qty * item.price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                Create Invoice
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">Invoice</th>
                  <th className="px-6 py-3 text-left font-semibold">Customer</th>
                  <th className="px-6 py-3 text-left font-semibold">Amount</th>
                  <th className="px-6 py-3 text-left font-semibold">Status</th>
                  <th className="px-6 py-3 text-left font-semibold">Date</th>
                  <th className="px-6 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t hover:bg-gray-50">
                    <td className="px-6 py-3 font-mono text-sm">{inv.invoice_number}</td>
                    <td className="px-6 py-3">{inv.customer_name}</td>
                    <td className="px-6 py-3 font-semibold">₹{(Number(inv.net_amount) || 0).toFixed(2)}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          inv.payment_status === "paid"
                            ? "bg-green-100 text-green-800"
                            : inv.payment_status === "partial"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {inv.payment_status}
                      </span>
                    </td>
                    <td className="px-6 py-3">{new Date(inv.issue_date).toLocaleDateString()}</td>
                    <td className="px-6 py-3">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleViewInvoice(inv.id)}
                          className="text-blue-600 hover:text-blue-800"
                          title="View Invoice"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleGeneratePDF(inv.id)}
                          className="text-green-600 hover:text-green-800"
                          title="Download PDF"
                        >
                          <Download size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Invoice Details Modal */}
        {showInvoiceDetails && selectedInvoice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">Invoice Details</h2>
                  <button
                    onClick={() => {
                      setShowInvoiceDetails(false)
                      setSelectedInvoice(null)
                    }}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Invoice Number</label>
                    <p className="text-lg font-semibold">{selectedInvoice.invoice_number}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Date</label>
                    <p className="text-lg">{new Date(selectedInvoice.issue_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Customer</label>
                    <p className="text-lg">{selectedInvoice.customer_name || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Status</label>
                    <p className="text-lg">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          selectedInvoice.payment_status === "paid"
                            ? "bg-green-100 text-green-800"
                            : selectedInvoice.payment_status === "partial"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {selectedInvoice.payment_status}
                      </span>
                    </p>
                  </div>
                </div>

                {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3">Items</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-2 text-left">Description</th>
                            <th className="px-4 py-2 text-right">Qty</th>
                            <th className="px-4 py-2 text-right">Price</th>
                            <th className="px-4 py-2 text-right">GST %</th>
                            <th className="px-4 py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInvoice.items.map((item, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="px-4 py-2">{item.description || "Item"}</td>
                              <td className="px-4 py-2 text-right">{item.qty || item.quantity || 1}</td>
                              <td className="px-4 py-2 text-right">₹{(item.price || 0).toFixed(2)}</td>
                              <td className="px-4 py-2 text-right">{item.applied_gst_rate || 0}%</td>
                              <td className="px-4 py-2 text-right">₹{((item.qty || item.quantity || 1) * (item.price || 0)).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="border-t pt-4">
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Taxable Value:</span>
                        <span className="font-semibold">₹{(Number(selectedInvoice.taxable_value) || 0).toFixed(2)}</span>
                      </div>
                      {selectedInvoice.cgst_amount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">CGST:</span>
                          <span>₹{(Number(selectedInvoice.cgst_amount) || 0).toFixed(2)}</span>
                        </div>
                      )}
                      {selectedInvoice.sgst_amount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">SGST:</span>
                          <span>₹{(Number(selectedInvoice.sgst_amount) || 0).toFixed(2)}</span>
                        </div>
                      )}
                      {selectedInvoice.igst_amount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">IGST:</span>
                          <span>₹{(Number(selectedInvoice.igst_amount) || 0).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold border-t pt-2">
                        <span>Total:</span>
                        <span>₹{(Number(selectedInvoice.net_amount) || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-2 justify-end">
                  <button
                    onClick={() => handleGeneratePDF(selectedInvoice.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <Download size={18} />
                    Download PDF
                  </button>
                  <button
                    onClick={() => {
                      setShowInvoiceDetails(false)
                      setSelectedInvoice(null)
                    }}
                    className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
