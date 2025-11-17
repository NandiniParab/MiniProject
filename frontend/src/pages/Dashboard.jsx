"use client"

import { useState, useEffect } from "react"
import Layout from "../components/Layout"
import { useAuth } from "../context/AuthContext"
import apiClient from "../components/ApiClient"
import { BarChart3, Users, Package, FileText } from 'lucide-react'

export default function Dashboard() {
  const { user, effectiveRole } = useAuth()
  const [stats, setStats] = useState({
    invoices: 0,
    customers: 0,
    products: 0,
    sales: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const invoices = await apiClient.get("/invoices").catch(() => ({ data: [] }))
        const customers = await apiClient.get("/customers").catch(() => ({ data: [] }))
        const products = await apiClient.get("/products").catch(() => ({ data: [] }))
        const sales = await apiClient.get("/reports/sales/summary").catch(() => ({ data: { total_sales: 0 } }))

        setStats({
          invoices: invoices.data.length,
          customers: customers.data.length,
          products: products.data.length,
          sales: parseFloat(sales.data.total_sales) || 0,
        })
      } catch (err) {
        console.error("[v0] Failed to fetch stats", err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className={`p-6 rounded-lg shadow-lg text-white ${color} flex items-center gap-4`}>
      <Icon size={40} />
      <div>
        <p className="text-sm opacity-90">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  )

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>

        {loading ? (
          <div className="text-center py-12">Loading stats...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={FileText} label="Total Invoices" value={stats.invoices} color="bg-blue-600" />
            <StatCard icon={Users} label="Customers" value={stats.customers} color="bg-green-600" />
            <StatCard icon={Package} label="Products" value={stats.products} color="bg-purple-600" />
            <StatCard icon={BarChart3} label="Total Sales" value={`₹${Number(stats.sales).toFixed(2)}`} color="bg-orange-600" />
          </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <a href="/invoices" className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-center font-semibold text-blue-600">Create Invoice</a>
            {(effectiveRole || user?.role) !== "sales" && (
              <a href="/customers" className="p-4 bg-green-50 hover:bg-green-100 rounded-lg text-center font-semibold text-green-600">Add Customer</a>
            )}
            {(effectiveRole || user?.role) !== "sales" && (
              <a href="/products" className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg text-center font-semibold text-purple-600">Add Product</a>
            )}
            {(effectiveRole || user?.role) !== "sales" && (
              <a href="/reports" className="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg text-center font-semibold text-orange-600">View Reports</a>
            )}
            {(effectiveRole || user?.role) === "admin" && (
              <a href="/setup" className="p-4 bg-slate-50 hover:bg-slate-100 rounded-lg text-center font-semibold text-slate-600">Organization Setup</a>
            )}
          </div>
        </div>

        
      </div>
    </Layout>
  )
}
