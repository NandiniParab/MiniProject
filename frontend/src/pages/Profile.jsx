"use client"

import Layout from "../components/Layout"
import { useAuth } from "../context/AuthContext"

export default function Profile() {
  const { user } = useAuth()
  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-800">My Profile</h1>
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <p className="px-4 py-2 border rounded-lg">{user?.name || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <p className="px-4 py-2 border rounded-lg">{user?.email || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <p className="px-4 py-2 border rounded-lg">{user?.role || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Organization ID</label>
              <p className="px-4 py-2 border rounded-lg">{user?.organization_id || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Branch ID</label>
              <p className="px-4 py-2 border rounded-lg">{user?.branch_id || '-'}</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}