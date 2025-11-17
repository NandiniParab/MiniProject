import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import ProtectedRoute from "./components/ProtectedRoute"
import LoginPage from "./pages/LoginPage"
import SignupPage from "./pages/SignupPage"
import Dashboard from "./pages/Dashboard"
import OrganizationSetup from "./pages/OrganizationSetup"
import Customers from "./pages/Customers"
import Products from "./pages/Products"
import Invoices from "./pages/Invoices"
import Expenses from "./pages/Expenses"
import Payments from "./pages/Payments"
import Reports from "./pages/Reports"
import TaxReturns from "./pages/TaxReturns"
import BackupRestore from "./pages/BackupRestore"
import Profile from "./pages/Profile"
import InvoicePreview from "./pages/InvoicePreview"

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/setup"
            element={
              <ProtectedRoute>
                <OrganizationSetup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute>
                <Customers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/products"
            element={
              <ProtectedRoute>
                <Products />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices"
            element={
              <ProtectedRoute>
                <Invoices />
              </ProtectedRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <ProtectedRoute>
                <Expenses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payments"
            element={
              <ProtectedRoute>
                <Payments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tax"
            element={
              <ProtectedRoute>
                <TaxReturns />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/backup"
            element={
              <ProtectedRoute>
                <BackupRestore />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices/:id/preview"
            element={
              <ProtectedRoute>
                <InvoicePreview />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
