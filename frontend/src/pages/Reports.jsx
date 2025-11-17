"use client"

import { useState, useEffect } from "react"
import Layout from "../components/Layout"
import apiClient from "../components/ApiClient"
import { BarChart3, TrendingUp, Users } from 'lucide-react'

export default function Reports() {
  const [reports, setReports] = useState({
    sales: {},
    tax: {},
    topCustomers: [],
    expenses: [],
  })
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ start: "", end: "", branch: "" })

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const [sales, tax, customers, expenses] = await Promise.all([
          apiClient.get("/reports/sales/summary"),
          apiClient.get("/reports/tax/liability"),
          apiClient.get("/reports/customers/top"),
          apiClient.get("/reports/expenses/summary"),
        ])

        setReports({
          sales: sales.data,
          tax: tax.data,
          topCustomers: customers.data,
          expenses: expenses.data,
        })
      } catch (err) {
        console.error("Failed to fetch reports", err)
      } finally {
        setLoading(false)
      }
    }

    fetchReports()
  }, [])

  const exportCSV = async (type) => {
    const params = new URLSearchParams()
    if (filters.start) params.append("start", filters.start)
    if (filters.end) params.append("end", filters.end)
    if (filters.branch) params.append("branch", filters.branch)
    const url = `/reports/export/${type}?${params.toString()}`
    const resp = await apiClient.get(url, { responseType: "blob" })
    const blobUrl = window.URL.createObjectURL(new Blob([resp.data]))
    const a = document.createElement("a")
    a.href = blobUrl
    a.download = (
      type === "sales-register" ? "Sales_Register_2025.csv" :
      type === "gstr1" ? "GSTR1_Data.csv" :
      type === "payment-register" ? "Payment_Register.csv" :
      type === "customer-master" ? "Customer_Master.csv" :
      "Expense_Register.csv"
    )
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(blobUrl)
  }

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-800">Reports</h1>

        {loading ? (
          <div>Loading reports...</div>
        ) : (
          <>
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-bold mb-4">Analytics Filters</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium">Start Date</label>
                  <input type="date" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="text-sm font-medium">End Date</label>
                  <input type="date" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="text-sm font-medium">Branch ID (optional)</label>
                  <input type="number" value={filters.branch} onChange={(e) => setFilters({ ...filters, branch: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div className="flex items-end gap-2">
                  <button onClick={() => exportCSV("sales-register")} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Export Sales Register</button>
                  <button onClick={() => exportCSV("gstr1")} className="px-4 py-2 bg-green-600 text-white rounded-lg">Export GSTR-1</button>
                  <button onClick={() => exportCSV("payment-register")} className="px-4 py-2 bg-purple-600 text-white rounded-lg">Export Payments</button>
                  <button onClick={() => exportCSV("customer-master")} className="px-4 py-2 bg-orange-600 text-white rounded-lg">Export Customer Master</button>
                  <button onClick={() => exportCSV("expense-register")} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Export Expenses</button>
                </div>
              </div>
            </div>

            {/* Sales Summary */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <BarChart3 /> Sales Summary
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-gray-600 text-sm">Total Invoices</p>
                  <p className="text-2xl font-bold text-blue-600">{reports.sales.total_invoices}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-gray-600 text-sm">Total Sales</p>
                  <p className="text-2xl font-bold text-green-600">₹{(Number(reports.sales.total_sales) || 0).toFixed(2)}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-gray-600 text-sm">Avg Invoice</p>
                  <p className="text-2xl font-bold text-purple-600">₹{(Number(reports.sales.avg_invoice_value) || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Tax Liability */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <TrendingUp /> Tax Liability
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-orange-50 rounded-lg">
                  <p className="text-gray-600 text-sm">Total CGST</p>
                  <p className="text-2xl font-bold text-orange-600">₹{(Number(reports.tax.total_cgst) || 0).toFixed(2)}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-gray-600 text-sm">Total SGST</p>
                  <p className="text-2xl font-bold text-red-600">₹{(Number(reports.tax.total_sgst) || 0).toFixed(2)}</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <p className="text-gray-600 text-sm">Total IGST</p>
                  <p className="text-2xl font-bold text-yellow-600">₹{(Number(reports.tax.total_igst) || 0).toFixed(2)}</p>
                </div>
                <div className="p-4 bg-indigo-50 rounded-lg">
                  <p className="text-gray-600 text-sm">Total Tax</p>
                  <p className="text-2xl font-bold text-indigo-600">₹{(Number(reports.tax.total_tax) || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Top Customers */}
            {reports.topCustomers.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Users /> Top Customers
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left">Customer</th>
                        <th className="px-4 py-2 text-left">Invoices</th>
                        <th className="px-4 py-2 text-left">Total Spent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.topCustomers.map((customer) => (
                        <tr key={customer.id} className="border-t">
                          <td className="px-4 py-2">{customer.name}</td>
                          <td className="px-4 py-2">{customer.invoice_count}</td>
                          <td className="px-4 py-2 font-semibold">₹{(Number(customer.total_spent) || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Expenses Summary */}
            {reports.expenses.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-bold mb-4">Expenses by Category</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reports.expenses.map((expense, idx) => (
                    <div key={idx} className="p-4 border rounded-lg">
                      <p className="text-gray-600 text-sm font-medium">{expense.category}</p>
                      <p className="text-xl font-bold">₹{(Number(expense.total_amount) || 0).toFixed(2)}</p>
                      <p className="text-xs text-gray-500 mt-1">{expense.count} entries</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
