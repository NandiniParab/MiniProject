"use client"

import { useEffect, useState } from "react"
import Layout from "../components/Layout"
import apiClient from "../components/ApiClient"

export default function Payments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [recordOpen, setRecordOpen] = useState(false)
  const [form, setForm] = useState({ invoice_id: "", method: "UPI", provider: "Razorpay", txn_id: "", amount: "" })
  const [error, setError] = useState("")

  const load = async () => {
    try {
      const res = await apiClient.get("/payments")
      setPayments(res.data || [])
    } catch (e) {
      setPayments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const recordPayment = async (e) => {
    e.preventDefault()
    setError("")
    try {
      const payload = {
        invoice_id: Number(form.invoice_id),
        method: form.method,
        provider: form.provider,
        txn_id: form.txn_id || undefined,
        status: "success",
        amount: parseFloat(form.amount),
      }
      await apiClient.post("/payments", payload)
      setForm({ invoice_id: "", method: "UPI", provider: "Razorpay", txn_id: "", amount: "" })
      setRecordOpen(false)
      load()
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">Payments</h1>
          <button onClick={() => setRecordOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Record Payment</button>
        </div>

        {recordOpen && (
          <form onSubmit={recordPayment} className="bg-white p-6 rounded-lg shadow-lg space-y-4">
            {error && <div className="p-3 bg-red-100 text-red-700 rounded">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Invoice ID</label>
                <input type="number" value={form.invoice_id} onChange={(e) => setForm({ ...form, invoice_id: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Method</label>
                <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="w-full px-4 py-2 border rounded-lg">
                  <option>UPI</option>
                  <option>Bank Transfer</option>
                  <option>Cash</option>
                  <option>Wallet</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Provider</label>
                <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="w-full px-4 py-2 border rounded-lg">
                  <option>Razorpay</option>
                  <option>HDFC Bank</option>
                  <option>ICICI Bank</option>
                  <option>Paytm</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reference / Txn ID</label>
                <input type="text" value={form.txn_id} onChange={(e) => setForm({ ...form, txn_id: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-lg">Save</button>
              <button type="button" onClick={() => setRecordOpen(false)} className="px-6 py-2 bg-gray-400 text-white rounded-lg">Cancel</button>
            </div>
          </form>
        )}

        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">Invoice #</th>
                  <th className="px-4 py-2 text-left">Customer</th>
                  <th className="px-4 py-2 text-left">Amount</th>
                  <th className="px-4 py-2 text-left">Due Date</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2 font-mono">{p.invoice_number}</td>
                    <td className="px-4 py-2">{p.customer_name || "-"}</td>
                    <td className="px-4 py-2 font-semibold">₹{(Number(p.amount) || 0).toFixed(2)}</td>
                    <td className="px-4 py-2">{p.due_date ? new Date(p.due_date).toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-2">{p.display_status || p.status}</td>
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