"use client"

import { Link, useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { LogOut, Menu, X } from "lucide-react"
import { useState } from "react"

export default function Layout({ children }) {
  const { logout, user, effectiveRole } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const role = effectiveRole || user?.role || "accountant"
  const baseItems = [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/customers", label: "Customers" },
    { path: "/products", label: "Products" },
    { path: "/invoices", label: "Invoices" },
  ]
  const accountantExtras = [{ path: "/payments", label: "Payments" }, { path: "/expenses", label: "Expenses" }, { path: "/tax", label: "Tax" }, { path: "/reports", label: "Reports" }, { path: "/profile", label: "Profile" }]
  const adminExtras = [{ path: "/payments", label: "Payments" }, { path: "/expenses", label: "Expenses" }, { path: "/tax", label: "Tax" }, { path: "/reports", label: "Reports" }, { path: "/settings/backup", label: "Settings" }, { path: "/setup", label: "Organization Setup" }, { path: "/profile", label: "Profile" }]
  const salesExtras = [{ path: "/payments", label: "Payments" }, { path: "/customers", label: "Customers" }, { path: "/profile", label: "Profile" }]
  const menuItems = role === "admin" ? [...baseItems, ...adminExtras] : role === "sales" ? [...baseItems, ...salesExtras] : [...baseItems, ...accountantExtras]

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <nav className="hidden md:flex flex-col w-64 bg-slate-900 text-white p-6 space-y-6">
        <h1 className="text-2xl font-bold">Billing App</h1>
        <div className="space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-4 py-2 rounded-lg transition ${
                location.pathname === item.path ? "bg-blue-600" : "hover:bg-slate-800"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <button
          onClick={handleLogout}
          className="mt-auto flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg"
        >
          <LogOut size={18} /> Logout
        </button>
      </nav>

      {/* Mobile Header */}
      <div className="md:hidden w-full flex flex-col">
        <header className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Billing App</h1>
          <button onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={24} /> : <Menu size={24} />}</button>
        </header>

        {menuOpen && (
          <nav className="bg-slate-800 text-white p-4 space-y-2 md:hidden">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="block px-4 py-2 rounded-lg hover:bg-slate-700"
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg"
            >
              <LogOut size={18} /> Logout
            </button>
          </nav>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 md:p-8">{children}</div>
      </div>
    </div>
  )
}
