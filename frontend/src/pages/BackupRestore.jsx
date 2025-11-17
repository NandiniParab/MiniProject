"use client"

import { useEffect, useState } from "react"
import Layout from "../components/Layout"
import apiClient from "../components/ApiClient"
import { useAuth } from "../context/AuthContext"

export default function BackupRestore() {
  const { effectiveRole } = useAuth()
  const [history, setHistory] = useState([])
  const [frequency, setFrequency] = useState("daily")
  const [error, setError] = useState("")

  const loadHistory = async () => {
    try {
      const res = await apiClient.get("/backup/history")
      setHistory(res.data || [])
    } catch (e) {
      setHistory([])
    }
  }
  useEffect(() => { loadHistory() }, [])

  const saveSchedule = async () => {
    try {
      await apiClient.put("/backup/schedule", { frequency })
      alert("Schedule saved")
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    }
  }

  const runBackup = async () => {
    try {
      const res = await apiClient.post("/backup/run")
      alert("Backup executed: " + res.data.timestamp)
      loadHistory()
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-800">Backup & Restore</h1>
        {effectiveRole !== "admin" ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">Only the owner (Admin) can manage backups.</div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold mb-4">Schedule</h2>
              {error && <div className="p-3 bg-red-100 text-red-700 rounded mb-3">{error}</div>}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Frequency</label>
                  <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full px-4 py-2 border rounded-lg">
                    <option value="daily">Daily (12 AM)</option>
                    <option value="weekly">Weekly (Sunday)</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <button onClick={saveSchedule} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Save</button>
                  <button onClick={runBackup} className="px-4 py-2 bg-green-600 text-white rounded-lg">Run Backup</button>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold mb-4">Backup History</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Time</th>
                      <th className="px-4 py-2 text-left">Provider</th>
                      <th className="px-4 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} className="border-t">
                        <td className="px-4 py-2">{new Date(h.timestamp).toLocaleString()}</td>
                        <td className="px-4 py-2">{h.provider}</td>
                        <td className="px-4 py-2">{h.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}