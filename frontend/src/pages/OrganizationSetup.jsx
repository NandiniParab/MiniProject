"use client"

import { useEffect, useRef, useState } from "react"
import Layout from "../components/Layout"
import apiClient from "../components/ApiClient"
import { useAuth } from "../context/AuthContext"

export default function OrganizationSetup() {
  const { user, login } = useAuth()
  const [orgData, setOrgData] = useState({
    name: "",
    gst_number: "",
    address: "",
    locale: "en-IN",
  })
  const [branchData, setBranchData] = useState({
    name: "",
    address: "",
    gst_number: "",
  })
  const [multiBranch, setMultiBranch] = useState(false)
  const [logoFile, setLogoFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [branches, setBranches] = useState([])
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "accountant",
    password: "",
    branchId: "",
  })
  const userSetupRef = useRef(null)

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const res = await apiClient.get("/branches")
        setBranches(res.data || [])
      } catch (e) {
        // silently ignore
      }
    }
    loadBranches()
  }, [])

  const handleRegisterOrg = async () => {
    setError("")
    setLoading(true)
    try {
      const res = await apiClient.post("/organizations", orgData)
      if (res.status !== 201) throw new Error("Failed to create organization")
      const org = res.data
      try {
        const linkRes = await apiClient.put("/auth/me/organization", { organizationId: org.id, branchId: null })
        if (linkRes?.data?.token && linkRes?.data?.user) {
          login(linkRes.data.user, linkRes.data.token)
        }
      } catch (e) {
        // non-blocking; user can still proceed to add users
      }
      alert("Organization created and linked to your account. Now add your users.")
      setTimeout(() => {
        userSetupRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 200)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async () => {
    setError("")
    if (!user?.organization_id) {
      setError("Missing organization context. Please login again.")
      return
    }
    try {
      const payload = {
        name: userForm.name,
        email: userForm.email,
        password: userForm.password,
        role: userForm.role,
        organizationId: user.organization_id,
        branchId: userForm.branchId || null,
        phone: userForm.phone,
        locale: "en-IN",
      }
      const res = await apiClient.post("/auth/register", payload)
      if (res.status !== 201) throw new Error("Failed to create user")
      alert(`User created: ${res.data.user?.email}`)
      setUserForm({ name: "", email: "", phone: "", role: "accountant", password: "", branchId: "" })
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-800">Organization Setup</h1>
        {user?.role === "admin" ? (
          <div className="bg-white p-6 rounded-lg shadow-lg space-y-6">
            {error && <div className="p-3 bg-red-100 text-red-700 rounded">{error}</div>}

            {!user?.organization_id && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Create Business Account</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="org-name" className="block text-sm font-medium mb-1">Business Name</label>
                  <input
                    id="org-name"
                    type="text"
                    value={orgData.name}
                    onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="org-gst" className="block text-sm font-medium mb-1">GSTIN</label>
                  <input
                    id="org-gst"
                    type="text"
                    value={orgData.gst_number}
                    onChange={(e) => setOrgData({ ...orgData, gst_number: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="org-address" className="block text-sm font-medium mb-1">Business Address</label>
                  <input
                    id="org-address"
                    type="text"
                    value={orgData.address}
                    onChange={(e) => setOrgData({ ...orgData, address: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
            )}

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Primary Branch</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="branch-name" className="block text-sm font-medium mb-1">Branch Name</label>
                  <input
                    id="branch-name"
                    type="text"
                    value={branchData.name}
                    onChange={(e) => setBranchData({ ...branchData, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="branch-gst" className="block text-sm font-medium mb-1">Branch GSTIN</label>
                  <input
                    id="branch-gst"
                    type="text"
                    value={branchData.gst_number}
                    onChange={(e) => setBranchData({ ...branchData, gst_number: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="branch-address" className="block text-sm font-medium mb-1">Branch Address</label>
                  <input
                    id="branch-address"
                    type="text"
                    value={branchData.address}
                    onChange={(e) => setBranchData({ ...branchData, address: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Branding & Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="org-logo" className="block text-sm font-medium mb-1">Upload Logo (optional)</label>
                  <input
                    id="org-logo"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  {logoFile && (
                    <p className="mt-1 text-xs text-gray-500">Selected: {logoFile.name}</p>
                  )}
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={multiBranch}
                      onChange={(e) => setMultiBranch(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm font-medium">Enable Multi-Branch</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleRegisterOrg}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Complete Setup"}
              </button>
            </div>

            <div ref={userSetupRef} className="space-y-4 pt-6 border-t">
              <h2 className="text-xl font-semibold">User Setup</h2>
              <p className="text-sm text-gray-600">Add accountants or sales staff. This option is always available here.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="user-name" className="block text-sm font-medium mb-1">Name</label>
                  <input
                    id="user-name"
                    type="text"
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="user-email" className="block text-sm font-medium mb-1">Email</label>
                  <input
                    id="user-email"
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="user-phone" className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    id="user-phone"
                    type="tel"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="user-role" className="block text-sm font-medium mb-1">Role</label>
                  <select
                    id="user-role"
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="accountant">Accountant</option>
                    <option value="sales">Sales Staff</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="user-branch" className="block text-sm font-medium mb-1">Branch</label>
                  <select
                    id="user-branch"
                    value={userForm.branchId}
                    onChange={(e) => setUserForm({ ...userForm, branchId: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select Branch (optional)</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="user-password" className="block text-sm font-medium mb-1">Password</label>
                  <input
                    id="user-password"
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateUser}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Add User
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
            <p className="text-sm text-yellow-800">Only admins can set up the organization.</p>
          </div>
        )}
      </div>
    </Layout>
  )
}