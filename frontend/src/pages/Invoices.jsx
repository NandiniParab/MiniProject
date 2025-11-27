"use client"

import { useState, useEffect } from "react"
import Layout from "../components/Layout"
import apiClient from "../components/ApiClient"
import { Eye, Download, Trash2 } from "lucide-react"
import { motion } from "framer-motion"
import { FaFileInvoiceDollar, FaPlus, FaFileAlt, FaBoxOpen } from "react-icons/fa"
import InvoiceUploader from "../components/InvoiceUploader"

// Animation variants for staggered entrance
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
}

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
    if (currentItem.description && currentItem.qty > 0 && currentItem.price >= 0) {
      // Allow price 0
      setFormData({
        ...formData,
        items: [...formData.items, { ...currentItem, product_id: Number.parseInt(currentItem.product_id) || null }],
      })
      setCurrentItem({ product_id: "", description: "", qty: 1, price: 0, applied_gst_rate: 0 })
    } else {
      alert("Please provide description, quantity (must be > 0), and price.")
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.customer_id || formData.items.length === 0) {
      alert("Please select customer and add items to the invoice.")
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
          product_id: item.product_id ? Number.parseInt(item.product_id) : null,
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
      setCurrentItem({ product_id: "", description: "", qty: 1, price: 0, applied_gst_rate: 0 }) // Reset current item as well
      setShowForm(false)
      const res = await apiClient.get("/invoices")
      setInvoices(res.data)
      alert("Invoice created successfully!")
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
      console.error("Failed to fetch invoice details", error)
      alert("Could not load invoice details.")
    }
  }

  const handleDelete = async (invoiceId) => {
    if (!window.confirm("Are you sure you want to delete this invoice?")) return
    try {
      await apiClient.delete(`/invoices/${invoiceId}`)
      setInvoices(invoices.filter((inv) => inv.id !== invoiceId))
      alert("Invoice deleted successfully!")
      // If the deleted invoice was the one being viewed, close the modal
      if (selectedInvoice && selectedInvoice.id === invoiceId) {
        setShowInvoiceDetails(false)
        setSelectedInvoice(null)
      }
    } catch (error) {
      console.error("Failed to delete invoice", error)
      alert("Failed to delete invoice. Please try again.")
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
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to generate report" }))
        alert("Failed to generate report: " + (errorData.error || "Unknown error"))
      }
    } catch (error) {
      console.error("Report generation error:", error)
      alert("Error generating report: " + error.message)
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
          items:
            extractedData.items && extractedData.items.length > 0
              ? extractedData.items.map((item) => ({
                  description: item["Item Name"] || item.name || item.description || "Item",
                  qty: Number.parseFloat(item["Quantity"] || item.qty || 1),
                  price: Number.parseFloat(item["Unit Price"] || item.price || 0),
                  applied_gst_rate: Number.parseFloat(item["GST Rate"] || item.gst_rate || 0),
                  product_id: item.product_id || null,
                }))
              : extractedData.total && extractedData.total > 0
                ? [
                    {
                      description: extractedData.vendor_name || "Invoice Item",
                      qty: 1,
                      price: extractedData.total || 0,
                      applied_gst_rate: extractedData.tax > 0 ? (extractedData.tax / extractedData.subtotal) * 100 : 0,
                      product_id: null,
                    },
                  ]
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
      const netAmount =
        typeof result.invoice.net_amount === "number"
          ? result.invoice.net_amount
          : Number.parseFloat(result.invoice.net_amount) || 0
      alert(
        `Invoice created successfully!\nInvoice #: ${result.invoice.invoice_number}\nTotal: ₹${netAmount.toFixed(2)}`,
      )
    } catch (error) {
      console.error("[v0] Error creating invoice:", error)
      alert(`Failed to create invoice: ${error.message}\n\nYou can still create it manually using the form.`)

      // Fallback: Pre-fill form with extracted data for manual creation
      const newFormData = {
        ...formData,
        invoice_number: extractedData.invoice_number || formData.invoice_number,
        issue_date: extractedData.invoice_date || formData.issue_date,
      }

      if (extractedData.customer_name) {
        // Try to find customer by name, otherwise leave blank
        const matchingCustomer = customers.find(
          (cust) => cust.name.toLowerCase() === extractedData.customer_name.toLowerCase(),
        )
        if (matchingCustomer) {
          newFormData.customer_id = matchingCustomer.id.toString()
        }
      }

      if (extractedData.items && extractedData.items.length > 0) {
        newFormData.items = extractedData.items.map((item) => ({
          description: item["Item Name"] || item.name || item.description || "Item",
          qty: Number.parseFloat(item["Quantity"] || item.qty || 1),
          price: Number.parseFloat(item["Unit Price"] || item.price || 0),
          applied_gst_rate: Number.parseFloat(item["GST Rate"] || item.gst_rate || 0),
          product_id: item.product_id ? item.product_id.toString() : "", // ensure it's string for select
        }))
      } else if (extractedData.total && extractedData.total > 0) {
        newFormData.items = [
          {
            description: extractedData.vendor_name || "Invoice Item",
            qty: 1,
            price: extractedData.total || 0,
            applied_gst_rate: extractedData.tax > 0 ? (extractedData.tax / extractedData.subtotal) * 100 : 0,
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
        <div className="flex justify-between items-center flex-wrap gap-4">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-[#122C4F] flex items-center gap-3"
          >
            <div className="p-2 bg-gradient-to-br from-[#5B88B2] to-[#122C4F] rounded-xl">
              <FaFileInvoiceDollar className="text-[#FBF9E3]" size={32} />
            </div>
            Invoices
          </motion.h1>
          <div className="flex gap-2 flex-wrap">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowUploader(!showUploader)}
              className="flex items-center gap-2 px-6 py-3 bg-[#5B88B2] text-white font-semibold rounded-xl hover:shadow-lg transition-all"
            >
              <Download size={18} /> Upload Invoice
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#F0D637] to-[#e6c82f] text-[#122C4F] font-semibold rounded-xl hover:shadow-lg transition-all"
            >
              <FaPlus size={18} /> Create Invoice
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleGenerateReport}
              className="flex items-center gap-2 px-6 py-3 bg-[#122C4F] text-white font-semibold rounded-xl hover:shadow-lg transition-all"
            >
              <FaFileAlt size={18} /> Export Report
            </motion.button>
          </div>
        </div>

        {showUploader && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#FBF9E3] p-8 rounded-2xl border-2 border-[#5B88B2]/20 shadow-lg"
          >
            <h3 className="text-lg font-bold text-[#122C4F] mb-4 flex items-center gap-2">
              <Download className="text-[#5B88B2]" size={20} />
              Upload Invoice Image
            </h3>
            <InvoiceUploader onSuccess={handleOCRSuccess} />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowUploader(false)}
              className="mt-4 px-6 py-2.5 bg-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-400 transition-all"
            >
              Close
            </motion.button>
          </motion.div>
        )}

        {showForm && (
          <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="bg-[#FBF9E3] p-8 rounded-2xl border-2 border-[#5B88B2]/20 shadow-lg space-y-6"
          >
            <h3 className="text-lg font-bold text-[#122C4F] mb-4">Create New Invoice</h3>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <motion.div variants={itemVariants}>
                <label htmlFor="invoice-customer" className="block text-sm font-semibold text-[#122C4F] mb-2">
                  Customer *
                </label>
                <select
                  id="invoice-customer"
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F0D637] focus:border-[#F0D637] outline-none transition-all"
                  required
                >
                  <option value="">Select Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </motion.div>
              <motion.div variants={itemVariants}>
                <label htmlFor="invoice-type" className="block text-sm font-semibold text-[#122C4F] mb-2">
                  Type
                </label>
                <select
                  id="invoice-type"
                  value={formData.invoice_type}
                  onChange={(e) => setFormData({ ...formData, invoice_type: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5B88B2] focus:border-[#5B88B2] outline-none transition-all"
                >
                  <option>GST</option>
                  <option>Non-GST</option>
                </select>
              </motion.div>
              <motion.div variants={itemVariants}>
                <label htmlFor="invoice-date" className="block text-sm font-semibold text-[#122C4F] mb-2">
                  Issue Date
                </label>
                <input
                  id="invoice-date"
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F0D637] focus:border-[#F0D637] outline-none transition-all"
                />
              </motion.div>
              <motion.div variants={itemVariants}>
                <label htmlFor="invoice-number" className="block text-sm font-semibold text-[#122C4F] mb-2">
                  Invoice Number
                </label>
                <input
                  id="invoice-number"
                  type="text"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5B88B2] focus:border-[#5B88B2] outline-none transition-all"
                  placeholder="INV-001"
                />
              </motion.div>
              <motion.div variants={itemVariants}>
                <label htmlFor="invoice-due-date" className="block text-sm font-semibold text-[#122C4F] mb-2">
                  Due Date
                </label>
                <input
                  id="invoice-due-date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F0D637] focus:border-[#F0D637] outline-none transition-all"
                />
              </motion.div>
              <motion.div variants={itemVariants}>
                <label htmlFor="invoice-place-of-supply" className="block text-sm font-semibold text-[#122C4F] mb-2">
                  Place of Supply (State)
                </label>
                <input
                  id="invoice-place-of-supply"
                  type="text"
                  value={formData.place_of_supply_state}
                  onChange={(e) => setFormData({ ...formData, place_of_supply_state: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5B88B2] focus:border-[#5B88B2] outline-none transition-all"
                  placeholder="State code"
                />
              </motion.div>
              <motion.div variants={itemVariants}>
                <label htmlFor="invoice-discount" className="block text-sm font-semibold text-[#122C4F] mb-2">
                  Discount Amount (₹)
                </label>
                <input
                  id="invoice-discount"
                  type="number"
                  value={formData.discount_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, discount_amount: Number.parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F0D637] focus:border-[#F0D637] outline-none transition-all"
                  placeholder="0.00"
                />
              </motion.div>
              <motion.div variants={itemVariants}>
                <label htmlFor="invoice-rounding" className="block text-sm font-semibold text-[#122C4F] mb-2">
                  Rounding (₹)
                </label>
                <input
                  id="invoice-rounding"
                  type="number"
                  value={formData.rounding}
                  onChange={(e) => setFormData({ ...formData, rounding: Number.parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5B88B2] focus:border-[#5B88B2] outline-none transition-all"
                  placeholder="0.00"
                />
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="border-t-2 border-[#5B88B2]/20 pt-6"
            >
              <h4 className="font-bold text-[#122C4F] mb-4 flex items-center gap-2">
                <FaBoxOpen className="text-[#F0D637]" size={18} />
                Add Items
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3">
                <div>
                  <label htmlFor="item-product" className="block text-xs font-semibold text-[#122C4F] mb-1">
                    Product
                  </label>
                  <select
                    id="item-product"
                    value={currentItem.product_id}
                    onChange={(e) => setCurrentItem({ ...currentItem, product_id: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#F0D637] focus:border-[#F0D637] outline-none transition-all"
                  >
                    <option value="">Select</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="item-description" className="block text-xs font-semibold text-[#122C4F] mb-1">
                    Description
                  </label>
                  <input
                    id="item-description"
                    type="text"
                    value={currentItem.description}
                    onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#5B88B2] focus:border-[#5B88B2] outline-none transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="item-qty" className="block text-xs font-semibold text-[#122C4F] mb-1">
                    Qty
                  </label>
                  <input
                    id="item-qty"
                    type="number"
                    value={currentItem.qty}
                    onChange={(e) => setCurrentItem({ ...currentItem, qty: Number.parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#F0D637] focus:border-[#F0D637] outline-none transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="item-price" className="block text-xs font-semibold text-[#122C4F] mb-1">
                    Price
                  </label>
                  <input
                    id="item-price"
                    type="number"
                    value={currentItem.price}
                    onChange={(e) => setCurrentItem({ ...currentItem, price: Number.parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#5B88B2] focus:border-[#5B88B2] outline-none transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="item-gst" className="block text-xs font-semibold text-[#122C4F] mb-1">
                    GST %
                  </label>
                  <input
                    id="item-gst"
                    type="number"
                    value={currentItem.applied_gst_rate}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, applied_gst_rate: Number.parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#F0D637] focus:border-[#F0D637] outline-none transition-all"
                  />
                </div>
                <div className="flex items-end">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAddItem}
                    className="w-full px-3 py-2 bg-gradient-to-r from-[#5B88B2] to-[#122C4F] text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all"
                  >
                    Add
                  </motion.button>
                </div>
              </div>

              {formData.items.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-r from-[#F0D637]/20 to-[#5B88B2]/20 p-4 rounded-xl text-sm max-h-48 overflow-y-auto border-2 border-[#5B88B2]/10"
                >
                  <h5 className="font-bold text-[#122C4F] mb-3">Items in Invoice ({formData.items.length})</h5>
                  {formData.items.map((item, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex justify-between items-center py-2 px-2 bg-white rounded-lg mb-2 border border-[#5B88B2]/20"
                    >
                      <span className="font-semibold text-[#122C4F]">
                        {idx + 1}. {item.description || "Item"}
                      </span>
                      <span className="font-bold text-[#5B88B2]">₹{(item.qty * item.price).toFixed(2)}</span>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>

            <div className="flex gap-3 pt-4">
              <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-3 bg-gradient-to-r from-[#F0D637] to-[#e6c82f] text-[#122C4F] font-bold rounded-xl hover:shadow-lg transition-all"
              >
                Create Invoice
              </motion.button>
              <motion.button
                type="button"
                onClick={() => setShowForm(false)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-3 bg-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-400 transition-all"
              >
                Cancel
              </motion.button>
            </div>
          </motion.form>
        )}

        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-12"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              className="w-8 h-8 border-4 border-[#5B88B2]/20 border-t-[#5B88B2] rounded-full"
            />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#FBF9E3] rounded-2xl border-2 border-[#5B88B2]/10 shadow-lg overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-[#122C4F] to-[#5B88B2] text-white">
                    <th className="px-6 py-4 text-left font-semibold">Invoice</th>
                    <th className="px-6 py-4 text-left font-semibold">Customer</th>
                    <th className="px-6 py-4 text-left font-semibold">Amount</th>
                    <th className="px-6 py-4 text-left font-semibold">Status</th>
                    <th className="px-6 py-4 text-left font-semibold">Date</th>
                    <th className="px-6 py-4 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv, idx) => (
                    <motion.tr
                      key={inv.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="border-t border-gray-200 hover:bg-[#F0D637]/10 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono font-semibold text-[#122C4F]">{inv.invoice_number}</td>
                      <td className="px-6 py-4 text-gray-700">{inv.customer_name}</td>
                      <td className="px-6 py-4 font-bold text-[#5B88B2]">
                        ₹{(Number(inv.net_amount) || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-lg font-semibold text-xs ${
                            inv.payment_status === "paid"
                              ? "bg-green-100 text-green-700"
                              : inv.payment_status === "partial"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {inv.payment_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{new Date(inv.issue_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-3">
                          <motion.button
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleViewInvoice(inv.id)}
                            className="text-[#5B88B2] hover:text-[#122C4F] transition-colors"
                            title="View Invoice"
                          >
                            <Eye size={18} />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleGeneratePDF(inv.id)}
                            className="text-[#122C4F] hover:text-[#5B88B2] transition-colors"
                            title="Download PDF"
                          >
                            <Download size={18} />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDelete(inv.id)}
                            className="text-red-500 hover:text-red-700 transition-colors"
                            title="Delete Invoice"
                          >
                            <Trash2 size={18} />
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        No invoices created yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {showInvoiceDetails && selectedInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-[#FBF9E3] max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-[#5B88B2]/20">
                  <h2 className="text-2xl font-bold text-[#122C4F] flex items-center gap-2">
                    <FaFileInvoiceDollar className="text-[#5B88B2]" size={28} />
                    Invoice Details
                  </h2>
                  <motion.button
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setShowInvoiceDetails(false)
                      setSelectedInvoice(null)
                    }}
                    className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                  >
                    ✕
                  </motion.button>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6 p-4 bg-gradient-to-r from-[#122C4F]/5 to-[#5B88B2]/5 rounded-xl">
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Invoice Number</label>
                    <p className="text-lg font-bold text-[#122C4F]">{selectedInvoice.invoice_number}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Date</label>
                    <p className="text-lg font-bold text-[#5B88B2]">
                      {new Date(selectedInvoice.issue_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Customer</label>
                    <p className="text-lg font-bold text-[#122C4F]">{selectedInvoice.customer_name || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Status</label>
                    <span
                      className={`inline-block px-3 py-1 rounded-lg font-semibold text-xs ${
                        selectedInvoice.payment_status === "paid"
                          ? "bg-green-100 text-green-700"
                          : selectedInvoice.payment_status === "partial"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {selectedInvoice.payment_status}
                    </span>
                  </div>
                </div>

                {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-[#122C4F] mb-3">Items</h3>
                    <div className="border-2 border-[#5B88B2]/20 rounded-xl overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gradient-to-r from-[#122C4F] to-[#5B88B2] text-white">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold">Description</th>
                            <th className="px-4 py-3 text-right font-semibold">Qty</th>
                            <th className="px-4 py-3 text-right font-semibold">Price</th>
                            <th className="px-4 py-3 text-right font-semibold">GST %</th>
                            <th className="px-4 py-3 text-right font-semibold">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInvoice.items.map((item, idx) => (
                            <motion.tr
                              key={idx}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className="border-t border-[#5B88B2]/10 hover:bg-[#F0D637]/10 transition-colors"
                            >
                              <td className="px-4 py-3 font-semibold text-[#122C4F]">{item.description || "Item"}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{item.qty || item.quantity || 1}</td>
                              <td className="px-4 py-3 text-right text-[#5B88B2] font-semibold">
                                ₹{(item.price || 0).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-700">{item.applied_gst_rate || 0}%</td>
                              <td className="px-4 py-3 text-right font-bold text-[#122C4F]">
                                ₹{((item.qty || item.quantity || 1) * (item.price || 0)).toFixed(2)}
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="border-t-2 border-[#5B88B2]/20 pt-6">
                  <div className="flex justify-end">
                    <div className="w-80 space-y-2 p-4 bg-gradient-to-br from-[#F0D637]/10 to-[#5B88B2]/10 rounded-xl border-2 border-[#5B88B2]/20">
                      <div className="flex justify-between">
                        <span className="text-gray-700 font-semibold">Taxable Value:</span>
                        <span className="font-bold text-[#122C4F]">
                          ₹{(Number(selectedInvoice.taxable_value) || 0).toFixed(2)}
                        </span>
                      </div>
                      {selectedInvoice.cgst_amount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700">CGST:</span>
                          <span className="text-[#5B88B2] font-semibold">
                            ₹{(Number(selectedInvoice.cgst_amount) || 0).toFixed(2)}
                          </span>
                        </div>
                      )}
                      {selectedInvoice.sgst_amount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700">SGST:</span>
                          <span className="text-[#5B88B2] font-semibold">
                            ₹{(Number(selectedInvoice.sgst_amount) || 0).toFixed(2)}
                          </span>
                        </div>
                      )}
                      {selectedInvoice.igst_amount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700">IGST:</span>
                          <span className="text-[#5B88B2] font-semibold">
                            ₹{(Number(selectedInvoice.igst_amount) || 0).toFixed(2)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold border-t-2 border-[#5B88B2]/20 pt-3">
                        <span className="text-[#122C4F]">Total:</span>
                        <span className="text-transparent bg-gradient-to-r from-[#F0D637] to-[#122C4F] bg-clip-text">
                          ₹{(Number(selectedInvoice.net_amount) || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowInvoiceDetails(false)
                    setSelectedInvoice(null)
                  }}
                  className="mt-6 w-full px-6 py-3 bg-gradient-to-r from-[#122C4F] to-[#5B88B2] text-white font-bold rounded-xl hover:shadow-lg transition-all"
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </Layout>
  )
}
