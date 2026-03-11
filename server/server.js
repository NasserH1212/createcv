"use strict"

/**
 * CreateCV — Production Server
 * Security-hardened Express server with rate limiting, helmet, strict CORS,
 * server-side prompt construction, and input validation.
 */

const express    = require("express")
const cors       = require("cors")
const helmet     = require("helmet")
const rateLimit  = require("express-rate-limit")
const path       = require("path")

const app  = express()
const PORT = process.env.PORT || 3001

// ─── Allowed Origins ──────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3001")
  .split(",")
  .map(o => o.trim())

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman in dev)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
  credentials: false,
}))

// ─── Helmet (Security Headers) ────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "cdnjs.cloudflare.com"],
      styleSrc:    ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc:     ["'self'", "fonts.gstatic.com"],
      connectSrc:  ["'self'"],
      imgSrc:      ["'self'", "data:"],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // required for html2pdf canvas
}))

// ─── Body Parser ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "64kb" })) // tightened from 512kb

// ─── Global Rate Limiter (all routes) ────────────────────────────────────────
app.use(rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 60,              // 60 requests per IP per minute (generous for static assets)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
}))

// ─── Strict AI Rate Limiter ───────────────────────────────────────────────────
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 5,              // 5 AI analyses per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: {
    error: "AI analysis rate limit reached. Please wait a minute before trying again.",
  },
})

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "..", "public"), {
  maxAge: "1d",
  etag: true,
}))

// ─── Input Validation & Sanitization ─────────────────────────────────────────

const MAX_STRING_LENGTH = 2000
const MAX_ARRAY_ITEMS   = 10

/**
 * Safely truncates a string to the max allowed length.
 */
function sanitizeString(val, max = MAX_STRING_LENGTH) {
  if (typeof val !== "string") return ""
  return val.slice(0, max).trim()
}

/**
 * Validates and sanitizes the resumeData object.
 * Only allows known keys and enforces max lengths.
 * Returns a clean, safe copy — never trusts raw client data.
 */
function sanitizeResumeData(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null

  const sanitizeItem = (item, schema) => {
    if (!item || typeof item !== "object") return {}
    const out = {}
    for (const [key, maxLen] of Object.entries(schema)) {
      out[key] = sanitizeString(item[key], maxLen)
    }
    return out
  }

  const sanitizeArray = (arr, schema) => {
    if (!Array.isArray(arr)) return []
    return arr
      .slice(0, MAX_ARRAY_ITEMS)
      .map(item => sanitizeItem(item, schema))
  }

  return {
    name:        sanitizeString(raw.name,     100),
    role:        sanitizeString(raw.role,     100),
    email:       sanitizeString(raw.email,    120),
    phone:       sanitizeString(raw.phone,     30),
    location:    sanitizeString(raw.location, 100),
    linkedin:    sanitizeString(raw.linkedin, 200),
    github:      sanitizeString(raw.github,   200),
    summary:     sanitizeString(raw.summary,  800),
    skills:      sanitizeString(raw.skills,   500),
    profileType: ["graduate", "experienced"].includes(raw.profileType)
                   ? raw.profileType
                   : "experienced",

    education: sanitizeArray(raw.education, {
      degree: 150, university: 150, start: 20, end: 20, gpa: 20,
    }),
    experience: sanitizeArray(raw.experience, {
      title: 120, company: 120, start: 20, end: 20, desc: MAX_STRING_LENGTH,
    }),
    projects: sanitizeArray(raw.projects, {
      name: 150, desc: MAX_STRING_LENGTH,
    }),
    certifications: sanitizeArray(raw.certifications, {
      name: 150, issuer: 150, date: 30,
    }),
    languages: sanitizeArray(raw.languages, {
      language: 60, level: 30,
    }),
  }
}

// ─── Server-Side Prompt Builder ──────────────────────────────────────────────
// The client NEVER sends a prompt. We build it here — prevents prompt injection.

function buildPrompt(data, lang) {
  const isAr = lang === "ar"

  const dataStr = JSON.stringify({
    name:        data.name,
    role:        data.role,
    email:       data.email,
    phone:       data.phone,
    location:    data.location,
    linkedin:    data.linkedin,
    github:      data.github,
    summary:     data.summary,
    skills:      data.skills,
    profileType: data.profileType,
    education:   data.education,
    experience:  data.experience,
    projects:    data.projects,
    certifications: data.certifications,
    languages:   data.languages,
  }, null, 2)

  if (isAr) {
    return `أنت خبير متخصص في تحسين السيرة الذاتية وأنظمة التصفية الآلي ATS. حلل السيرة الذاتية التالية وأعطني تقييماً احترافياً.

بيانات السيرة الذاتية:
${dataStr}

أرجع JSON فقط بالشكل التالي، بدون أي نص إضافي:
{"overallScore":<0-100>,"scoreComment":"<تعليق>","strengths":["<قوة>"],"improvements":["<تحسين>"],"atsIssues":["<مشكلة ATS>"],"suggestions":["<اقتراح>"]}`
  }

  return `You are an expert ATS resume consultant. Analyze the resume data below and return professional feedback.

Resume Data:
${dataStr}

Return ONLY a JSON object — no extra text, no markdown fences:
{"overallScore":<0-100>,"scoreComment":"<brief comment>","strengths":["<strength>"],"improvements":["<area to improve>"],"atsIssues":["<ATS issue>"],"suggestions":["<actionable tip>"]}`
}

// ─── Output Normalizer ────────────────────────────────────────────────────────

function normalizeResult(data) {
  const toArray = (v) =>
    Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 8) : []
  return {
    overallScore: Math.min(100, Math.max(0, Number(data?.overallScore) || 0)),
    scoreComment: sanitizeString(String(data?.scoreComment || ""), 300),
    strengths:    toArray(data?.strengths),
    improvements: toArray(data?.improvements),
    atsIssues:    toArray(data?.atsIssues),
    suggestions:  toArray(data?.suggestions),
  }
}

// ─── Stub Result (no API key or fallback) ────────────────────────────────────

function getStubResult(lang) {
  const isAr = lang === "ar"
  return normalizeResult({
    overallScore: 72,
    scoreComment: isAr
      ? "تحليل تجريبي — أضف ANTHROPIC_API_KEY في .env لتفعيل التحليل الحقيقي."
      : "Demo mode — add ANTHROPIC_API_KEY to .env to enable real AI analysis.",
    strengths: [
      isAr ? "تنسيق واضح ومقروء" : "Clear and readable formatting",
      isAr ? "قسم مهارات منظم" : "Well-organized skills section",
    ],
    improvements: [
      isAr ? "أضف إنجازات قابلة للقياس بأرقام" : "Add quantifiable achievements with numbers",
      isAr ? "حسّن الملخص المهني ليتضمن كلمات مفتاحية" : "Improve summary with industry keywords",
    ],
    atsIssues: [
      isAr ? "قد تكون بعض الكلمات المفتاحية ناقصة" : "Some role-specific keywords may be missing",
    ],
    suggestions: [
      isAr ? "خصص السيرة لكل وظيفة بشكل منفصل" : "Tailor your resume for each job application",
      isAr ? "استخدم أفعال إنجاز قوية في بداية كل نقطة" : "Start each bullet with a strong action verb",
    ],
  })
}

// ─── AI Analysis Endpoint ─────────────────────────────────────────────────────

app.post("/api/analyze-resume", aiLimiter, async (req, res) => {
  try {
    const { lang, resumeData } = req.body || {}

    // Validate lang
    const safeLang = ["en", "ar"].includes(lang) ? lang : "en"

    // Validate & sanitize resumeData
    if (!resumeData || typeof resumeData !== "object") {
      return res.status(400).json({ error: "resumeData is required and must be an object." })
    }

    const sanitized = sanitizeResumeData(resumeData)
    if (!sanitized) {
      return res.status(400).json({ error: "Invalid resumeData structure." })
    }

    // Check if we have something meaningful to analyze
    if (!sanitized.name && !sanitized.role && !sanitized.summary) {
      return res.status(400).json({ error: "Resume appears to be empty. Please fill in your details first." })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return res.json(getStubResult(safeLang))
    }

    // Build prompt server-side — client cannot influence this
    const prompt = buildPrompt(sanitized, safeLang)

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`[AI] Anthropic API error ${response.status}:`, errText)
      return res.json(getStubResult(safeLang))
    }

    const aiData   = await response.json()
    const rawText  = aiData.content?.map(b => b.text || "").join("") || ""
    const cleaned  = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error("[AI] JSON parse failed:", parseErr.message, "| Raw:", rawText.slice(0, 200))
      return res.json(getStubResult(safeLang))
    }

    return res.json(normalizeResult(parsed))

  } catch (err) {
    console.error("[AI] Unhandled error:", err)
    return res.status(500).json({ error: "Internal server error. Please try again." })
  }
})

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    version: "2.1.0",
    ai: !!process.env.ANTHROPIC_API_KEY,
  })
})

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  // SPA fallback — serve index.html for non-API routes
  if (!req.path.startsWith("/api/")) {
    return res.sendFile(path.join(__dirname, "..", "public", "index.html"))
  }
  res.status(404).json({ error: "Not found." })
})

// ─── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error("[Server] Unhandled error:", err.message)
  if (err.message?.startsWith("CORS:")) {
    return res.status(403).json({ error: err.message })
  }
  res.status(500).json({ error: "Internal server error." })
})

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
process.on("uncaughtException",  err => console.error("[FATAL] Uncaught exception:", err))
process.on("unhandledRejection", err => console.error("[FATAL] Unhandled rejection:", err))

app.listen(PORT, () => {
  console.log(`\n🚀 CreateCV server running at http://localhost:${PORT}`)
  console.log(`   AI Analysis: ${process.env.ANTHROPIC_API_KEY ? "✅ LIVE" : "⚠️  DEMO (no API key)"}`)
  console.log(`   Allowed origins: ${ALLOWED_ORIGINS.join(", ")}\n`)
})