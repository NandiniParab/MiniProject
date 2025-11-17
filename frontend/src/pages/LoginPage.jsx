"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import apiClient from "../components/ApiClient"
import { Link } from "react-router-dom"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login, setRole, effectiveRole } = useAuth()
  const [selectedRole, setSelectedRole] = useState("accountant")

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await apiClient.post("/auth/login", { email, password })
      login(res.data.user, res.data.token)
      setRole(selectedRole)
      if (selectedRole === "admin") navigate("/setup")
      else navigate("/dashboard")
    } catch (err) {
      setError(err.response?.data?.error || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-600 to-slate-900">
      <div className="bg-white p-8 rounded-lg shadow-lg w-96">
        <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">Login</h2>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Login As</label>
            <div className="flex gap-3">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="login-role"
                  value="admin"
                  checked={selectedRole === "admin"}
                  onChange={(e) => setSelectedRole(e.target.value)}
                />
                Admin
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="login-role"
                  value="accountant"
                  checked={selectedRole === "accountant"}
                  onChange={(e) => setSelectedRole(e.target.value)}
                />
                Accountant
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="login-role"
                  value="sales"
                  checked={selectedRole === "sales"}
                  onChange={(e) => setSelectedRole(e.target.value)}
                />
                Sales
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Don't have an account?{" "}
          <Link to="/signup" className="text-blue-600 hover:text-blue-700 font-semibold">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  )
}
