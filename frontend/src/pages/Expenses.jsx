"use client"

import { useState, useEffect } from "react"
import Layout from "../components/Layout"
import apiClient from "../components/ApiClient"
import { Plus, Trash2 } from 'lucide-react'

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [showForm, setShowForm] = useState(false)
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
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">Expenses</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} /> Add Expense
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="expense-category" className="block text-sm font-medium mb-1">Category</label>
                <input
                  id="expense-category"
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label htmlFor="expense-amount" className="block text-sm font-medium mb-1">Amount</label>
                <input
                  id="expense-amount"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label htmlFor="expense-gst" className="block text-sm font-medium mb-1">GST %</label>
                <input
                  id="expense-gst"
                  type="number"
                  value={formData.gst_percent}
                  onChange={(e) => setFormData({ ...formData, gst_percent: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label htmlFor="expense-date" className="block text-sm font-medium mb-1">Date</label>
                <input
                  id="expense-date"
                  type="date"
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label htmlFor="expense-vendor" className="block text-sm font-medium mb-1">Vendor</label>
                <input
                  id="expense-vendor"
                  type="text"
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label htmlFor="expense-vendor-id" className="block text-sm font-medium mb-1">Vendor ID</label>
                <input
                  id="expense-vendor-id"
                  type="number"
                  value={formData.vendor_id}
                  onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="expense-purchase-bill-id" className="block text-sm font-medium mb-1">Purchase Bill ID</label>
                <input
                  id="expense-purchase-bill-id"
                  type="number"
                  value={formData.purchase_bill_id}
                  onChange={(e) => setFormData({ ...formData, purchase_bill_id: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="expense-notes" className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  id="expense-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                Save
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
                  <th className="px-6 py-3 text-left font-semibold">Category</th>
                  <th className="px-6 py-3 text-left font-semibold">Amount</th>
                  <th className="px-6 py-3 text-left font-semibold">GST %</th>
                  <th className="px-6 py-3 text-left font-semibold">Date</th>
                  <th className="px-6 py-3 text-left font-semibold">Notes</th>
                  <th className="px-6 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-t hover:bg-gray-50">
                    <td className="px-6 py-3">{expense.category}</td>
                    <td className="px-6 py-3 font-semibold">₹{(Number(expense.amount) || 0).toFixed(2)}</td>
                    <td className="px-6 py-3">{expense.gst_percent}%</td>
                    <td className="px-6 py-3">{new Date(expense.expense_date).toLocaleDateString()}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{expense.notes}</td>
                    <td className="px-6 py-3">
                      <button onClick={() => handleDelete(expense.id)} className="text-red-600 hover:text-red-800">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
