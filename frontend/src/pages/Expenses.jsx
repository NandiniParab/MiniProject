"use client"

import { useState, useEffect } from "react"
import Layout from "../components/Layout"
import InvoiceUploader from "../components/InvoiceUploader"
import apiClient from "../components/ApiClient"
import { Trash2 } from "lucide-react"
import { motion } from "framer-motion"
import { FaReceipt, FaPlus, FaFileInvoice } from "react-icons/fa"

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [purchaseBills, setPurchaseBills] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [showUploader, setShowUploader] = useState(false)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    category: "",
    vendor_id: "",
    vendor: "",
    amount: "",
    gst_percent: "",
    expense_date: new Date().toISOString().split("T")[0],
    purchase_bill_id: "",
    notes: "",
  })

  useEffect(() => {
    fetchExpenses()
    fetchPurchaseBills()
  }, [])

  const fetchExpenses = async () => {
    try {
      const res = await apiClient.get("/expenses")
      setExpenses(res.data)
    } catch (err) {
      console.error("Failed to fetch expenses", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchPurchaseBills = async () => {
    try {
      const res = await apiClient.get("/purchase-bills?limit=50")
      setPurchaseBills(res.data)
    } catch (err) {
      console.error("Failed to fetch purchase bills", err)
    }
  }

  const handleBillUploadSuccess = (result) => {
    if (result && result.purchase_bill_id && result.journal_entry_draft) {
      const d = result.journal_entry_draft
      const taxSum = (Number(d.cgst_input) || 0) + (Number(d.sgst_input) || 0) + (Number(d.igst_input) || 0)
      const baseAmt = Number(d.amount) || 0
      const gstPercent = baseAmt > 0 ? (taxSum / baseAmt) * 100 : 0
      setFormData({
        category: d.entry_type === "purchase" ? "Purchases" : "Office Expense",
        vendor_id: d.vendor_id ? String(d.vendor_id) : "",
        vendor: "",
        amount: String(d.total_amount || baseAmt),
        gst_percent: String(Number(gstPercent.toFixed(2))),
        expense_date: d.entry_date || new Date().toISOString().split("T")[0],
        purchase_bill_id: String(result.purchase_bill_id),
        notes: `Auto-filled from OCR bill #${d.reference_no || result.purchase_bill_id}`,
      })
      setShowForm(true)
      setShowUploader(false)
      fetchPurchaseBills()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await apiClient.post("/expenses", {
        ...formData,
        amount: Number.parseFloat(formData.amount),
        gst_percent: Number.parseFloat(formData.gst_percent),
      })
      setFormData({
        category: "",
        vendor_id: "",
        vendor: "",
        amount: "",
        gst_percent: "",
        expense_date: new Date().toISOString().split("T")[0],
        purchase_bill_id: "",
        notes: "",
      })
      setShowForm(false)
      fetchExpenses()
    } catch (err) {
      console.error("Failed to create expense", err)
    }
  }

  const handleDelete = async (id) => {
    if (confirm("Delete this expense?")) {
      try {
        await apiClient.delete(`/expenses/${id}`)
        fetchExpenses()
      } catch (err) {
        console.error("Failed to delete expense", err)
      }
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
              <FaReceipt className="text-[#FBF9E3]" size={32} />
            </div>
            Expenses
          </motion.h1>
        <div className="flex items-center gap-3 flex-wrap">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowUploader(!showUploader)}
              className="flex items-center gap-2 px-6 py-3 bg-[#5B88B2] text-white font-semibold rounded-xl hover:shadow-lg transition-all"
            >
              <FaFileInvoice size={18} /> Upload Bill
          </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#F0D637] to-[#e6c82f] text-[#122C4F] font-semibold rounded-xl hover:shadow-lg transition-all"
            >
              <FaPlus size={18} /> Add Expense
            </motion.button>
        </div>
      </div>

        {showUploader && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#FBF9E3] p-6 rounded-2xl shadow-md border border-slate-200"
          >
            <h2 className="text-lg font-semibold text-[#122C4F] mb-4 flex items-center gap-2">
              <FaFileInvoice className="text-[#5B88B2]" /> Upload Bill
            </h2>
            <div className="bg-white p-6 rounded-xl border-2 border-dashed border-[#5B88B2]/30 hover:border-[#5B88B2]/60 transition-colors">
              <InvoiceUploader
                onSuccess={handleBillUploadSuccess}
                uploadUrl={"http://localhost:5000/api/purchase-bills/upload"}
                fileFieldName={"bill_file"}
              />
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#FBF9E3] p-8 rounded-2xl border-2 border-[#5B88B2]/10 shadow-lg"
        >
          <h2 className="text-lg font-bold text-[#122C4F] mb-4 flex items-center gap-2">
            <FaFileInvoice className="text-[#5B88B2]" size={20} />
            Purchase Bills (OCR)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-[#122C4F]/10 to-[#5B88B2]/10">
                  <th className="px-4 py-3 text-left font-semibold text-[#122C4F]">Bill #</th>
                  <th className="px-4 py-3 text-left font-semibold text-[#122C4F]">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-[#122C4F]">Vendor</th>
                  <th className="px-4 py-3 text-right font-semibold text-[#122C4F]">Tax</th>
                  <th className="px-4 py-3 text-right font-semibold text-[#122C4F]">Subtotal</th>
                  <th className="px-4 py-3 text-right font-semibold text-[#122C4F]">Total</th>
                  <th className="px-4 py-3 text-left font-semibold text-[#122C4F]">Status</th>
                </tr>
              </thead>
              <tbody>
                {purchaseBills.map((pb, idx) => (
                  <motion.tr
                    key={pb.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="border-t border-gray-200 hover:bg-[#F0D637]/10 transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold text-[#122C4F]">{pb.bill_number || pb.id}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {pb.bill_date ? new Date(pb.bill_date).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{pb.vendor_name || "-"}</td>
                    <td className="px-4 py-3 text-right text-[#5B88B2] font-semibold">
                      ₹{(Number(pb.subtotal) || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-[#5B88B2] font-semibold">
                      ₹{(Number(pb.cgst_amount) + Number(pb.sgst_amount) + Number(pb.igst_amount)).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#122C4F]">
                      ₹{(Number(pb.net_amount) || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-3 py-1 rounded-lg font-semibold text-xs ${
                          pb.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {pb.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
                {purchaseBills.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                      No purchase bills found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {showForm && (
          <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="bg-[#FBF9E3] p-8 rounded-2xl border-2 border-[#5B88B2]/20 shadow-lg space-y-6"
          >
            <h3 className="text-lg font-bold text-[#122C4F] mb-4">Record New Expense</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ... existing inputs with enhanced styling ... */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                <label htmlFor="expense-category" className="block text-sm font-semibold text-[#122C4F] mb-2">
                  Category
                </label>
                <input
                  id="expense-category"
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F0D637] focus:border-[#F0D637] outline-none transition-all"
                  placeholder="e.g., Office Supplies"
                />
              </motion.div>
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                <label htmlFor="expense-amount" className="block text-sm font-semibold text-[#122C4F] mb-2">
                  Amount (₹)
                </label>
                <input
                  id="expense-amount"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5B88B2] focus:border-[#5B88B2] outline-none transition-all"
                  placeholder="0.00"
                />
              </motion.div>
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                <label htmlFor="expense-gst" className="block text-sm font-semibold text-[#122C4F] mb-2">
                  GST %
                </label>
                <input
                  id="expense-gst"
                  type="number"
                  value={formData.gst_percent}
                  onChange={(e) => setFormData({ ...formData, gst_percent: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F0D637] focus:border-[#F0D637] outline-none transition-all"
                  placeholder="5, 12, 18..."
                />
              </motion.div>
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                <label htmlFor="expense-date" className="block text-sm font-semibold text-[#122C4F] mb-2">
                  Date
                </label>
                <input
                  id="expense-date"
                  type="date"
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5B88B2] focus:border-[#5B88B2] outline-none transition-all"
                />
              </motion.div>
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
                <label htmlFor="expense-vendor" className="block text-sm font-semibold text-[#122C4F] mb-2">
                  Vendor Name
                </label>
                <input
                  id="expense-vendor"
                  type="text"
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F0D637] focus:border-[#F0D637] outline-none transition-all"
                  placeholder="Vendor name"
                />
              </motion.div>
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}>
                <label htmlFor="expense-vendor-id" className="block text-sm font-semibold text-[#122C4F] mb-2">
                  Vendor ID
                </label>
                <input
                  id="expense-vendor-id"
                  type="number"
                  value={formData.vendor_id}
                  onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5B88B2] focus:border-[#5B88B2] outline-none transition-all"
                  placeholder="Optional"
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
                className="md:col-span-2"
              >
                <label htmlFor="expense-purchase-bill-id" className="block text-sm font-semibold text-[#122C4F] mb-2">
                  Purchase Bill ID
                </label>
                <input
                  id="expense-purchase-bill-id"
                  type="number"
                  value={formData.purchase_bill_id}
                  onChange={(e) => setFormData({ ...formData, purchase_bill_id: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F0D637] focus:border-[#F0D637] outline-none transition-all"
                  placeholder="Optional"
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 }}
                className="md:col-span-2"
              >
                <label htmlFor="expense-notes" className="block text-sm font-semibold text-[#122C4F] mb-2">
                  Notes
                </label>
                <textarea
                  id="expense-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5B88B2] focus:border-[#5B88B2] outline-none transition-all"
                  placeholder="Additional notes..."
                  rows="3"
                />
              </motion.div>
            </div>
            <div className="flex gap-3 pt-2">
              <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-2.5 bg-gradient-to-r from-[#F0D637] to-[#e6c82f] text-[#122C4F] font-bold rounded-xl hover:shadow-lg transition-all"
              >
                Save Expense
              </motion.button>
              <motion.button
                type="button"
                onClick={() => setShowForm(false)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-2.5 bg-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-400 transition-all"
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
                    <th className="px-6 py-4 text-left font-semibold">Category</th>
                    <th className="px-6 py-4 text-left font-semibold">Amount</th>
                    <th className="px-6 py-4 text-left font-semibold">GST %</th>
                    <th className="px-6 py-4 text-left font-semibold">Date</th>
                    <th className="px-6 py-4 text-left font-semibold">Vendor</th>
                    <th className="px-6 py-4 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense, idx) => (
                    <motion.tr
                      key={expense.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="border-t border-gray-200 hover:bg-[#F0D637]/10 transition-colors"
                    >
                      <td className="px-6 py-4 font-semibold text-[#122C4F]">{expense.category}</td>
                      <td className="px-6 py-4 font-bold text-[#5B88B2]">
                        ₹{(Number(expense.amount) || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-gray-700">{expense.gst_percent}%</td>
                      <td className="px-6 py-4 text-gray-700">{new Date(expense.expense_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{expense.vendor || "-"}</td>
                      <td className="px-6 py-4">
                        <motion.button
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDelete(expense.id)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                        >
                          <Trash2 size={18} />
                        </motion.button>
                      </td>
                    </motion.tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        No expenses recorded yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  )
}
