import { useState } from "react"
import { Upload, Loader, AlertCircle } from 'lucide-react'

export default function InvoiceUploader({ onSuccess }) {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [extractedData, setExtractedData] = useState(null)
  const [error, setError] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [progress, setProgress] = useState("")

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0]
      if (validateFile(selectedFile)) {
        setFile(selectedFile)
        setError(null)
        setExtractedData(null)
      }
    }
  }

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (validateFile(selectedFile)) {
        setFile(selectedFile)
        setError(null)
        setExtractedData(null)
      }
    }
  }

  const validateFile = (file) => {
    const maxSize = 5 * 1024 * 1024 // 5MB
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
    
    if (!allowedTypes.includes(file.type)) {
      setError("Invalid file type. Please upload JPEG, PNG, or PDF files only.")
      return false
    }
    
    if (file.size > maxSize) {
      setError("File is too large. Maximum size is 5MB.")
      return false
    }
    
    return true
  }

  const handleUpload = async () => {
    if (!file) {
      setError("Please select an image")
      return
    }

    setLoading(true)
    setError(null)
    setProgress("Uploading file...")
    
    try {
      console.log("[v0] Uploading file:", file.name)
      
      const formData = new FormData()
      formData.append("invoice_image", file)

      setProgress("Processing with OCR...")
      const response = await fetch("http://localhost:5000/api/ocr/extract-invoice", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })

      console.log("[v0] Response status:", response.status)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      const result = await response.json()
      console.log("[v0] Response data:", result)
      console.log("[v0] Response success:", result.success)
      console.log("[v0] Response invoice_number:", result.invoice_number)
      console.log("[v0] Response total:", result.total)

      // Always show extracted data if success is true, even if some fields are missing
      if (result.success === true) {
        setExtractedData(result)
        setProgress("")
        setError(null) // Clear any previous errors
        console.log("[v0] Extraction successful, data set:", result)
        // Delay callback to show success state
        setTimeout(() => {
          console.log("[v0] Calling onSuccess with:", result)
          onSuccess(result)
        }, 1000)
      } else if (result.success === false) {
        setError(result.error || "Failed to extract invoice data")
        setProgress("")
        setExtractedData(null)
      } else {
        // If success is undefined but we have data, treat as success
        if (result.invoice_number || result.total || result.items) {
          setExtractedData(result)
          setProgress("")
          setError(null)
          console.log("[v0] Extraction completed (success field missing but data present)")
          setTimeout(() => {
            onSuccess(result)
          }, 1000)
        } else {
          setError("Unexpected response format from server")
          setProgress("")
          setExtractedData(null)
        }
      }
    } catch (error) {
      console.error("[v0] Upload error:", error)
      setError("Upload failed: " + error.message)
      setProgress("")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <Upload className="mx-auto mb-3 text-gray-400" size={32} />
        <p className="text-gray-600 mb-2">Drag and drop your invoice image here</p>
        <p className="text-sm text-gray-500 mb-4">or</p>
        <label className="inline-block">
          <input
            type="file"
            accept="image/jpeg,image/png,image/jpg,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
            disabled={loading}
          />
          <span className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer inline-block disabled:bg-gray-400">
            Choose File
          </span>
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-2">
          <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {progress && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-2 items-center">
          <Loader size={18} className="animate-spin text-blue-600" />
          <p className="text-blue-800 text-sm">{progress}</p>
        </div>
      )}

      {file && !extractedData && !loading && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm font-medium text-gray-700">Selected file: {file.name}</p>
          <p className="text-xs text-gray-500 mt-1">Size: {(file.size / 1024).toFixed(2)} KB</p>
          <button
            onClick={handleUpload}
            disabled={loading}
            className="mt-3 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
          >
            {loading && <Loader size={18} className="animate-spin" />}
            Upload & Extract
          </button>
        </div>
      )}

      {loading && (
        <div className="bg-blue-50 p-6 rounded-lg">
          <div className="flex items-center justify-center gap-3">
            <Loader size={24} className="animate-spin text-blue-600" />
            <p className="text-blue-800 font-medium">Processing invoice...</p>
          </div>
          <p className="text-center text-sm text-blue-600 mt-2">This may take a moment</p>
        </div>
      )}

      {extractedData && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-800 mb-3">Extracted Data:</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <label className="text-gray-600">Invoice #:</label>
              <p className="font-medium">{extractedData.invoice_number || "N/A"}</p>
            </div>
            <div>
              <label className="text-gray-600">Date:</label>
              <p className="font-medium">{extractedData.invoice_date || "N/A"}</p>
            </div>
            <div>
              <label className="text-gray-600">Vendor:</label>
              <p className="font-medium">{extractedData.vendor_name || "N/A"}</p>
            </div>
            <div>
              <label className="text-gray-600">Customer:</label>
              <p className="font-medium">{extractedData.customer_name || "N/A"}</p>
            </div>
            <div>
              <label className="text-gray-600">Subtotal:</label>
              <p className="font-medium">₹{extractedData.subtotal?.toFixed(2) || "0.00"}</p>
            </div>
            <div>
              <label className="text-gray-600">Tax:</label>
              <p className="font-medium">₹{extractedData.tax?.toFixed(2) || "0.00"}</p>
            </div>
            <div className="col-span-2">
              <label className="text-gray-600">Total:</label>
              <p className="font-medium text-lg">₹{extractedData.total?.toFixed(2) || "0.00"}</p>
            </div>
          </div>
          
          {extractedData.items && extractedData.items.length > 0 && (
            <div className="mt-4 pt-4 border-t border-green-200">
              <h5 className="font-semibold text-green-800 mb-2">Items:</h5>
              <div className="text-sm space-y-1">
                {extractedData.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-gray-700">
                    <span>{item['Item Name'] || item.name || 'Item'}</span>
                    <span>Qty: {item['Quantity'] || item.qty || 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
