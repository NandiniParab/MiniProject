"use client"

import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import Layout from "../components/Layout"
import apiClient from "../components/ApiClient"

export default function InvoicePreview() {
  const { id } = useParams()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient.get(`/invoices/${id}`)
        setInvoice(res.data)
      } catch (e) {
        setInvoice(null)
      } finally { setLoading(false) }
    }
    load()
  }, [id])

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-800">Invoice Preview</h1>
        {loading ? (
          <div>Loading...</div>
        ) : invoice ? (
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <label className="text-sm font-medium text-gray-600">Invoice Number</label>
                <p className="text-lg font-semibold">{invoice.invoice_number}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Date</label>
                <p className="text-lg">{new Date(invoice.issue_date).toLocaleDateString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Customer</label>
                <p className="text-lg">{invoice.customer_name || "N/A"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Status</label>
                <p className="text-lg">{invoice.payment_status}</p>
              </div>
            </div>

            {invoice.items && invoice.items.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Items</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left">Description</th>
                        <th className="px-4 py-2 text-right">Qty</th>
                        <th className="px-4 py-2 text-right">Price</th>
                        <th className="px-4 py-2 text-right">GST %</th>
                        <th className="px-4 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-4 py-2">{item.description || "Item"}</td>
                          <td className="px-4 py-2 text-right">{item.qty || item.quantity || 1}</td>
                          <td className="px-4 py-2 text-right">₹{(item.price || 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">{item.applied_gst_rate || 0}%</td>
                          <td className="px-4 py-2 text-right">₹{((item.qty || item.quantity || 1) * (item.price || 0)).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Taxable Value:</span>
                  <span className="font-semibold">₹{(Number(invoice.taxable_value) || 0).toFixed(2)}</span>
                </div>
                {invoice.cgst_amount > 0 && (
                  <div className="flex justify-between"><span className="text-gray-600">CGST:</span><span>₹{(Number(invoice.cgst_amount) || 0).toFixed(2)}</span></div>
                )}
                {invoice.sgst_amount > 0 && (
                  <div className="flex justify-between"><span className="text-gray-600">SGST:</span><span>₹{(Number(invoice.sgst_amount) || 0).toFixed(2)}</span></div>
                )}
                {invoice.igst_amount > 0 && (
                  <div className="flex justify-between"><span className="text-gray-600">IGST:</span><span>₹{(Number(invoice.igst_amount) || 0).toFixed(2)}</span></div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>₹{(Number(invoice.net_amount) || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-red-50 border border-red-200 rounded">Invoice not found</div>
        )}
      </div>
    </Layout>
  )
}