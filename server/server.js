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

// Trust the first proxy (Render, Vercel, etc.) for correct IP and protocol
app.set("trust proxy", 1)

// ─── Allowed Origins ──────────────────────────────────────────────────────────
const IS_DEV = process.env.NODE_ENV !== "production"
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  "https://createcvpro.com,https://www.createcvpro.com,http://localhost:3001"
)
  .split(",")
  .map(o => o.trim())

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman in dev)
    if (!origin) return cb(null, true)
    // In development, allow any localhost origin (port may vary)
    if (IS_DEV && origin.startsWith("http://localhost:")) return cb(null, true)
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
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
      scriptSrc:   ["'self'", "https://cdnjs.cloudflare.com", "https://www.googletagmanager.com", "'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:     ["'self'", "https://fonts.gstatic.com"],
      connectSrc:  ["'self'", "https://cdnjs.cloudflare.com", "https://www.google-analytics.com", "https://*.google-analytics.com", "https://*.analytics.google.com", "https://*.googletagmanager.com"],
      imgSrc:      ["'self'", "data:", "blob:", "https://www.googletagmanager.com"],
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

// ─── Resolve static directories once at startup ─────────────────────────────
const PUBLIC_DIR = path.join(__dirname, "..", "public")
const SRC_DIR    = path.join(__dirname, "..", "src")

// ─── Startup Diagnostics ─────────────────────────────────────────────────────
const fs = require("fs")
;(function checkPaths() {
  const critical = [
    [PUBLIC_DIR, "public/"],
    [path.join(PUBLIC_DIR, "index.html"), "public/index.html"],
    [SRC_DIR, "src/"],
    [path.join(SRC_DIR, "main.js"), "src/main.js"],
    [path.join(SRC_DIR, "modules", "Utils.js"), "src/modules/Utils.js"],
  ]
  console.log("\n📁 Static file check:")
  critical.forEach(([abs, label]) => {
    const ok = fs.existsSync(abs)
    console.log(`   ${ok ? "✅" : "❌"} ${label} → ${abs}`)
    if (!ok) console.error(`   ⚠️  MISSING: ${label} — this will break the app!`)
  })
})()

// ─── Static Files ─────────────────────────────────────────────────────────────
// Use short cache so redeployments take effect quickly
const staticMaxAge = IS_DEV ? 0 : "2h"

app.use(express.static(PUBLIC_DIR, {
  maxAge: staticMaxAge,
  etag: true,
}))

// Serve src/ directory for ES module imports (referenced by index.html)
app.use("/src", express.static(SRC_DIR, {
  maxAge: staticMaxAge,
  etag: true,
  // Ensure .js files get the correct MIME type for ES modules
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".js")) {
      res.setHeader("Content-Type", "application/javascript; charset=UTF-8")
    }
  },
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
      name: 150, url: 200, desc: MAX_STRING_LENGTH,
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
        model: "claude-sonnet-4-20250514",
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

// ─── AI Description Writer ───────────────────────────────────────────────────

/**
 * Sanitizes the description-generation input.
 * Only allows known keys with strict max lengths.
 */
function sanitizeDescInput(raw) {
  if (!raw || typeof raw !== "object") return null
  const jobTitle    = sanitizeString(raw.jobTitle,    120)
  const achievement = sanitizeString(raw.achievement, 300)
  const years       = sanitizeString(raw.years,        10)
  if (!jobTitle) return null
  return { jobTitle, achievement, years }
}

/**
 * Builds the prompt for generating experience bullet points.
 * Server-side only — client never sends a prompt.
 */
function buildDescriptionPrompt(data, lang) {
  const isAr = lang === "ar"

  const context = [
    `Job Title: ${data.jobTitle}`,
    data.achievement ? `Key Achievement: ${data.achievement}` : "",
    data.years ? `Years in Role: ${data.years}` : "",
  ].filter(Boolean).join("\n")

  if (isAr) {
    return `أنت كاتب سير ذاتية محترف ومتخصص في أنظمة ATS.

المعطيات:
${context}

اكتب 3-4 نقاط إنجازات للسيرة الذاتية بالعربية.

القواعد:
- ابدأ كل نقطة بفعل إنجاز قوي
- أضف أرقام وإحصائيات واقعية حيث أمكن
- اجعل النقاط متوافقة مع أنظمة ATS
- كل نقطة سطر واحد فقط
- أرجع JSON فقط بالشكل: {"bullets":["نقطة 1","نقطة 2","نقطة 3"]}`
  }

  return `You are a professional ATS resume writer.

Context:
${context}

Write 3-4 achievement bullet points for a resume.

Rules:
- Start each bullet with a strong action verb (Led, Developed, Increased, etc.)
- Include realistic metrics and numbers where possible
- Make bullets ATS-friendly with industry keywords
- Each bullet is one concise line
- Return ONLY JSON: {"bullets":["bullet 1","bullet 2","bullet 3"]}`
}

/**
 * Normalizes the AI description output to a consistent shape.
 */
function normalizeDescResult(data) {
  const bullets = Array.isArray(data?.bullets)
    ? data.bullets.map(String).filter(Boolean).slice(0, 5).map(b => b.slice(0, 300))
    : []
  return { bullets }
}

function getDescStub(lang) {
  const isAr = lang === "ar"
  return normalizeDescResult({
    bullets: isAr
      ? [
          "قاد تطوير نظام إدارة المحتوى مما أدى لزيادة الإنتاجية بنسبة 35%",
          "أشرف على فريق من 5 مطورين وحقق تسليم المشاريع قبل الموعد بأسبوعين",
          "حسّن أداء النظام وقلّل وقت الاستجابة بنسبة 40%",
        ]
      : [
          "Led development of a content management system, increasing team productivity by 35%",
          "Managed a team of 5 developers, delivering projects 2 weeks ahead of schedule",
          "Optimized system performance, reducing response time by 40%",
        ],
  })
}

app.post("/api/generate-description", aiLimiter, async (req, res) => {
  try {
    const { lang, descInput } = req.body || {}
    const safeLang = ["en", "ar"].includes(lang) ? lang : "en"

    if (!descInput || typeof descInput !== "object") {
      return res.status(400).json({ error: "descInput is required." })
    }

    const sanitized = sanitizeDescInput(descInput)
    if (!sanitized) {
      return res.status(400).json({ error: "Job title is required." })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return res.json(getDescStub(safeLang))
    }

    const prompt = buildDescriptionPrompt(sanitized, safeLang)

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`[AI-Desc] Anthropic API error ${response.status}:`, errText)
      return res.json(getDescStub(safeLang))
    }

    const aiData  = await response.json()
    const rawText = aiData.content?.map(b => b.text || "").join("") || ""
    const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error("[AI-Desc] JSON parse failed:", parseErr.message, "| Raw:", rawText.slice(0, 200))
      return res.json(getDescStub(safeLang))
    }

    return res.json(normalizeDescResult(parsed))

  } catch (err) {
    console.error("[AI-Desc] Unhandled error:", err)
    return res.status(500).json({ error: "Internal server error." })
  }
})

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    version: "3.0.0",
    ai: !!process.env.ANTHROPIC_API_KEY,
  })
})

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  // API routes → JSON 404
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found." })
  }

  // Static asset requests that weren't matched by express.static → real 404
  // This prevents serving index.html (HTML) for missing .js/.css files,
  // which would break ES module loading (browser refuses HTML as JavaScript)
  const ext = path.extname(req.path).toLowerCase()
  if (ext && ext !== ".html" && ext !== ".htm") {
    console.warn(`[404] Static asset not found: ${req.path}`)
    return res.status(404).type("text").send("Not found")
  }

  // SPA fallback — serve index.html for client-side routes
  res.sendFile(path.join(PUBLIC_DIR, "index.html"))
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