import express from "express"
import bcrypt from "bcryptjs"
import pool from "../config/database.js"
import { generateToken } from "../config/jwt.js"
import { authMiddleware, roleCheck } from "../middleware/auth.js"

const router = express.Router()

// Register User - Updated to match new schema with proper field names
router.post("/register", async (req, res) => {
  const { name, email, password, role, organizationId, branchId } = req.body

  try {
    if (!organizationId) {
      return res.status(400).json({ error: "organization_id is required" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, organization_id, branch_id, locale) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, name, email, role, organization_id, branch_id`,
      [name, email, hashedPassword, role || "accountant", organizationId, branchId || null, "en-IN"],
    )

    const userData = result.rows[0]
    const token = generateToken(userData.id, userData.organization_id, userData.role, userData.branch_id)
    res.status(201).json({ user: userData, token })
  } catch (error) {
    console.error("[v0] Register error:", error.message)
    res.status(500).json({ error: error.message })
  }
})

// Login User - Updated error handling and response format
router.post("/login", async (req, res) => {
  const { email, password } = req.body

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email])
    const user = result.rows[0]

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" })
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash)
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" })
    }

    const token = generateToken(user.id, user.organization_id, user.role, user.branch_id)
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization_id: user.organization_id,
        branch_id: user.branch_id,
      },
      token,
    })
  } catch (error) {
    console.error("[v0] Login error:", error.message)
    res.status(500).json({ error: error.message })
  }
})

// Update current user's organization/branch (admin only)
router.put("/me/organization", authMiddleware, roleCheck(["admin"]), async (req, res) => {
  const { organizationId, branchId } = req.body

  try {
    const updated = await pool.query(
      `UPDATE users SET organization_id = $1, branch_id = $2 WHERE id = $3 RETURNING id, name, email, role, organization_id, branch_id`,
      [organizationId, branchId || null, req.user.userId],
    )

    const userData = updated.rows[0]
    const token = generateToken(userData.id, userData.organization_id, userData.role, userData.branch_id)
    res.json({ user: userData, token })
  } catch (error) {
    console.error("[v0] Update org error:", error.message)
    res.status(500).json({ error: error.message })
  }
})

export default router
