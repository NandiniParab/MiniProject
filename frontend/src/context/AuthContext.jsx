"use client"

import { createContext, useContext, useState, useEffect } from "react"

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem("token"))
  const [sessionRole, setSessionRole] = useState(localStorage.getItem("sessionRole") || null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedToken = localStorage.getItem("token")
    if (savedToken) {
      setToken(savedToken)
      try {
        const payload = JSON.parse(atob(savedToken.split(".")[1]))
        setUser(payload)
      } catch (err) {
        console.error("[v0] Invalid token")
        localStorage.removeItem("token")
      }
    }
    const savedSessionRole = localStorage.getItem("sessionRole")
    if (savedSessionRole) setSessionRole(savedSessionRole)
    setLoading(false)
  }, [])

  const login = (userData, newToken) => {
    setUser(userData)
    setToken(newToken)
    localStorage.setItem("token", newToken)
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    setSessionRole(null)
    localStorage.removeItem("token")
    localStorage.removeItem("sessionRole")
  }

  const effectiveRole = sessionRole || user?.role || null

  const setRole = (role) => {
    setSessionRole(role)
    if (role) localStorage.setItem("sessionRole", role)
    else localStorage.removeItem("sessionRole")
  }

  return <AuthContext.Provider value={{ user, token, loading, login, logout, sessionRole, setRole, effectiveRole }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
