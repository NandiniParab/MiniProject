import express from "express"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { authMiddleware, roleCheck } from "../middleware/auth.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const router = express.Router()

router.use(authMiddleware)
router.use(roleCheck(["admin"]))

const dir = path.resolve(__dirname, "../backups")
const historyFile = path.join(dir, "history.json")
const scheduleFile = path.join(dir, "schedule.json")

const ensureDir = () => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }) }

router.get("/history", (req, res) => {
  ensureDir()
  try {
    const hist = fs.existsSync(historyFile) ? JSON.parse(fs.readFileSync(historyFile, "utf-8")) : []
    res.json(hist)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put("/schedule", (req, res) => {
  ensureDir()
  const { frequency } = req.body // "daily" or "weekly"
  const schedule = { frequency, time: frequency === "daily" ? "00:00" : "Sunday" }
  fs.writeFileSync(scheduleFile, JSON.stringify(schedule, null, 2))
  res.json(schedule)
})

router.post("/run", (req, res) => {
  ensureDir()
  const ts = new Date().toISOString()
  const entry = { id: Date.now(), timestamp: ts, provider: "AWS S3 / Google Drive", status: "success" }
  const hist = fs.existsSync(historyFile) ? JSON.parse(fs.readFileSync(historyFile, "utf-8")) : []
  hist.push(entry)
  fs.writeFileSync(historyFile, JSON.stringify(hist, null, 2))
  res.json(entry)
})

export default router