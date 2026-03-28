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
    return `أنت خبير متخصص في تحسين السيرة الذاتية وأنظمة التصفية الآلي ATS ومعيد كتابة محترف للسير الذاتية. حلل السيرة الذاتية التالية وأعطني تقييماً احترافياً مع إعادة كتابة محددة يمكن للمستخدم نسخها مباشرة.

بيانات السيرة الذاتية:
${dataStr}

التعليمات:
- في "improvements": لا تقل أشياء عامة مثل "يمكن تحسينه". اقتبس النص الضعيف واشرح المشكلة بالتحديد.
- في "suggestions": قدم نصوصاً محددة جاهزة للنسخ (مثل ملخص أفضل، نقاط خبرة أقوى).
- في "rewrites": ابحث عن النصوص الضعيفة من السيرة (الملخص، نقاط الخبرة، وصف المشاريع) وأعد كتابتها بأسلوب احترافي متوافق مع ATS باستخدام أفعال إنجاز وأرقام. كل إعادة كتابة يجب أن تحتوي على "original" (النص الأصلي) و"improved" (النسخة المحسنة).
- استخدم أفعال إنجاز قوية: قاد، طوّر، صمّم، حسّن، نفّذ، قلّل، زاد، أنشأ.
- أضف أرقاماً ومقاييس حيث يكون ذلك منطقياً.

أرجع JSON فقط بالشكل التالي، بدون أي نص إضافي:
{"overallScore":<0-100>,"scoreComment":"<تعليق>","strengths":["<قوة>"],"improvements":["<مشكلة محددة مع اقتباس النص>"],"atsIssues":["<مشكلة ATS>"],"suggestions":["<اقتراح محدد وعملي>"],"rewrites":[{"original":"<النص الضعيف من السيرة>","improved":"<النسخة المحسنة المتوافقة مع ATS>"}]}`
  }

  return `You are an expert ATS resume consultant and professional resume rewriter. Analyze the resume data below and return specific, actionable feedback with concrete rewrites the user can copy directly into their resume.

Resume Data:
${dataStr}

Instructions:
- In "improvements": do NOT say vague things like "could be improved". Instead, quote the weak text and explain exactly what's wrong.
- In "suggestions": give specific, copy-ready text the user can paste (e.g. a better summary, better bullet point).
- In "rewrites": find weak lines from the resume (summary, experience bullets, project descriptions) and rewrite them into strong, ATS-friendly versions using action verbs and quantified achievements. Each rewrite must have "original" (the actual text from the resume) and "improved" (your rewritten version).
- Use strong action verbs: Led, Developed, Engineered, Optimized, Implemented, Delivered, Reduced, Increased, Streamlined, Architected.
- Add metrics/numbers where reasonable (e.g. "reducing load time by 40%", "serving 10K+ users").
- Keep rewrites concise and professional — one line each, ready to paste into a resume.

Return ONLY a JSON object — no extra text, no markdown fences:
{"overallScore":<0-100>,"scoreComment":"<brief comment>","strengths":["<strength>"],"improvements":["<specific issue with quoted text>"],"atsIssues":["<ATS issue>"],"suggestions":["<specific actionable tip>"],"rewrites":[{"original":"<weak text from resume>","improved":"<rewritten ATS-optimized version>"}]}`
}

// ─── Output Normalizer ────────────────────────────────────────────────────────

function normalizeResult(data) {
  const toArray = (v) =>
    Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 8) : []
  const toRewrites = (v) =>
    Array.isArray(v)
      ? v.filter(r => r && typeof r === "object" && r.original && r.improved)
          .map(r => ({ original: sanitizeString(String(r.original), 500), improved: sanitizeString(String(r.improved), 500) }))
          .slice(0, 8)
      : []
  return {
    overallScore: Math.min(100, Math.max(0, Number(data?.overallScore) || 0)),
    scoreComment: sanitizeString(String(data?.scoreComment || ""), 300),
    strengths:    toArray(data?.strengths),
    improvements: toArray(data?.improvements),
    atsIssues:    toArray(data?.atsIssues),
    suggestions:  toArray(data?.suggestions),
    rewrites:     toRewrites(data?.rewrites),
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
    rewrites: [
      {
        original: isAr ? "عملت على تطوير مواقع الويب" : "Worked on developing websites",
        improved: isAr
          ? "طوّر وأطلق 3 مواقع ويب متجاوبة باستخدام React و Node.js، مما زاد تفاعل المستخدمين بنسبة 45%"
          : "Developed and launched 3 responsive web applications using React and Node.js, increasing user engagement by 45%",
      },
      {
        original: isAr ? "مسؤول عن إدارة الفريق" : "Responsible for managing the team",
        improved: isAr
          ? "قاد فريقاً من 5 مطورين باستخدام منهجية Agile، وسلّم المشاريع قبل الموعد بأسبوعين"
          : "Led a cross-functional team of 5 developers using Agile methodology, delivering projects 2 weeks ahead of schedule",
      },
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
        max_tokens: 1500,
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

// ─── AI Onboarding Starter ───────────────────────────────────────────────

function buildOnboardingPrompt(data, lang) {
  const isAr = lang === "ar"
  const context = [
    `Target Role: ${data.role}`,
    `Profile Type: ${data.profileType === "graduate" ? "Fresh Graduate" : "Experienced Professional"}`,
    data.name ? `Name: ${data.name}` : "",
  ].filter(Boolean).join("\n")

  if (isAr) {
    return `أنت كاتب سير ذاتية محترف. أنشئ محتوى أولي لسيرة ذاتية بناءً على المعطيات التالية.

${context}

أنشئ JSON فقط بالشكل التالي بدون أي نص إضافي:
{
  "summary": "<ملخص مهني من 2-3 جمل>",
  "skills": "<مهارات مناسبة للوظيفة مفصولة بفواصل، 8-12 مهارة>",
  "experience": [{"title": "<المسمى الوظيفي>", "company": "<اسم شركة مناسب>", "desc": "<3 نقاط إنجاز مفصولة بسطر جديد>"}],
  "education": [{"degree": "<درجة مناسبة>", "university": "<جامعة>"}]
}`
  }

  return `You are a professional resume writer. Generate starter content for a resume based on:

${context}

Return ONLY JSON — no extra text, no markdown:
{
  "summary": "<2-3 sentence professional summary>",
  "skills": "<relevant skills comma-separated, 8-12 skills>",
  "experience": [{"title": "<job title>", "company": "<realistic company name>", "desc": "<3 achievement bullet points separated by newlines>"}],
  "education": [{"degree": "<appropriate degree>", "university": "<university name>"}]
}`
}

function getOnboardingStub(data, lang) {
  const isAr = lang === "ar"
  const isGrad = data.profileType === "graduate"
  const role = data.role || (isAr ? "مهندس برمجيات" : "Software Engineer")

  if (isAr) {
    return {
      summary: isGrad
        ? `خريج جديد متحمس في مجال ${role} يبحث عن فرصة لتطبيق المهارات الأكاديمية في بيئة عمل احترافية. يتميز بالقدرة على التعلم السريع والعمل ضمن فريق.`
        : `محترف ${role} ذو خبرة في تطوير وتنفيذ الحلول التقنية. يتميز بالقدرة على قيادة الفرق وتحقيق الأهداف بكفاءة عالية.`,
      skills: isGrad
        ? "Python, JavaScript, HTML, CSS, Git, SQL, Microsoft Office, التواصل, العمل الجماعي, حل المشكلات"
        : "إدارة المشاريع, التخطيط الاستراتيجي, القيادة, التحليل, Python, JavaScript, SQL, Docker, Git, Agile",
      experience: isGrad ? [] : [{
        title: role,
        company: "شركة التقنية المتقدمة",
        desc: "قاد تطوير أنظمة تقنية رفعت الكفاءة التشغيلية بنسبة 30%\nأشرف على فريق من 4 أعضاء وحقق تسليم المشاريع في الوقت المحدد\nحسّن العمليات الداخلية مما وفّر 20 ساعة عمل أسبوعياً"
      }],
      education: [{ degree: isGrad ? "بكالوريوس علوم الحاسب" : "بكالوريوس", university: "جامعة الملك سعود" }],
    }
  }

  return {
    summary: isGrad
      ? `Motivated ${role} graduate eager to apply academic knowledge in a professional environment. Strong analytical skills with a passion for continuous learning and collaborative problem-solving.`
      : `Results-driven ${role} with proven experience in delivering high-impact solutions. Skilled in leading cross-functional teams and driving projects from concept to completion.`,
    skills: isGrad
      ? "Python, JavaScript, HTML, CSS, Git, SQL, Microsoft Office, Communication, Teamwork, Problem Solving"
      : "Project Management, Strategic Planning, Leadership, Analysis, Python, JavaScript, SQL, Docker, Git, Agile",
    experience: isGrad ? [] : [{
      title: role,
      company: "Tech Solutions Inc.",
      desc: "Led development of technical systems improving operational efficiency by 30%\nManaged a team of 4, consistently delivering projects on time and within budget\nStreamlined internal processes, saving 20+ hours per week across the department"
    }],
    education: [{ degree: isGrad ? "Bachelor of Computer Science" : "Bachelor's Degree", university: "University" }],
  }
}

app.post("/api/generate-onboarding", aiLimiter, async (req, res) => {
  try {
    const { lang, onboardingData } = req.body || {}
    const safeLang = ["en", "ar"].includes(lang) ? lang : "en"

    if (!onboardingData || typeof onboardingData !== "object") {
      return res.status(400).json({ error: "onboardingData is required." })
    }

    const sanitized = {
      name: sanitizeString(onboardingData.name, 100),
      role: sanitizeString(onboardingData.role, 120),
      profileType: ["graduate", "experienced"].includes(onboardingData.profileType)
        ? onboardingData.profileType : "experienced",
    }

    if (!sanitized.role) {
      return res.json(getOnboardingStub(sanitized, safeLang))
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return res.json(getOnboardingStub(sanitized, safeLang))
    }

    const prompt = buildOnboardingPrompt(sanitized, safeLang)

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!response.ok) {
      console.error(`[AI-Onboard] Anthropic API error ${response.status}`)
      return res.json(getOnboardingStub(sanitized, safeLang))
    }

    const aiData  = await response.json()
    const rawText = aiData.content?.map(b => b.text || "").join("") || ""
    const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error("[AI-Onboard] JSON parse failed")
      return res.json(getOnboardingStub(sanitized, safeLang))
    }

    // Normalize
    const result = {
      summary: sanitizeString(String(parsed.summary || ""), 500),
      skills: sanitizeString(String(parsed.skills || ""), 500),
      experience: Array.isArray(parsed.experience)
        ? parsed.experience.slice(0, 3).map(e => ({
            title: sanitizeString(String(e.title || ""), 120),
            company: sanitizeString(String(e.company || ""), 120),
            desc: sanitizeString(String(e.desc || ""), 500),
          }))
        : [],
      education: Array.isArray(parsed.education)
        ? parsed.education.slice(0, 2).map(e => ({
            degree: sanitizeString(String(e.degree || ""), 120),
            university: sanitizeString(String(e.university || ""), 120),
          }))
        : [],
    }

    return res.json(result)

  } catch (err) {
    console.error("[AI-Onboard] Error:", err)
    return res.status(500).json({ error: "Internal server error." })
  }
})

// ─── AI Optimize for Job ─────────────────────────────────────────────────────

function buildOptimizePrompt(resumeData, jobDescription, lang) {
  const isAr = lang === "ar"

  const resumeStr = JSON.stringify({
    name: resumeData.name,
    role: resumeData.role,
    summary: resumeData.summary,
    skills: resumeData.skills,
    experience: resumeData.experience,
    projects: resumeData.projects,
  }, null, 2)

  if (isAr) {
    return `أنت خبير في تحسين السير الذاتية لتتوافق مع وظائف محددة وأنظمة ATS.

وصف الوظيفة:
${jobDescription}

بيانات السيرة الذاتية الحالية:
${resumeStr}

التعليمات:
- استخرج الكلمات المفتاحية والمهارات المطلوبة من وصف الوظيفة.
- حدد المهارات الناقصة من السيرة الذاتية.
- أعد كتابة النقاط الضعيفة من الخبرات والمشاريع لتتوافق مع الوظيفة، باستخدام أفعال إنجاز وأرقام.
- اكتب ملخصاً مهنياً محسناً يتوافق مع الوظيفة.
- لا تخترع خبرات وهمية — حسّن ما هو موجود فقط.

أرجع JSON فقط بالشكل التالي، بدون أي نص إضافي:
{"keywords":["كلمة مفتاحية من الوظيفة"],"rewrites":[{"original":"النص الأصلي من السيرة","improved":"النسخة المحسنة المتوافقة مع الوظيفة"}],"missingSkills":["مهارة ناقصة"],"summary":"ملخص مهني محسّن يتوافق مع الوظيفة"}`
  }

  return `You are an expert ATS resume optimizer. Your job is to optimize a resume to match a specific job posting.

Job Description:
${jobDescription}

Current Resume Data:
${resumeStr}

Instructions:
- Extract the key skills, technologies, and keywords the job requires.
- Identify skills the resume is missing for this job.
- Find weak bullet points in experience/projects and rewrite them to align with the job requirements. Use strong action verbs and quantified results. Each rewrite must have "original" (exact text from resume) and "improved" (optimized version targeting this job).
- Write an optimized professional summary tailored to this specific job.
- Do NOT invent fake experience — only improve what exists.
- Focus rewrites on the most impactful changes for this job.

Return ONLY a JSON object — no extra text, no markdown fences:
{"keywords":["key skill from job"],"rewrites":[{"original":"weak text from resume","improved":"optimized version for this job"}],"missingSkills":["skill not in resume"],"summary":"optimized professional summary tailored to this job"}`
}

function normalizeOptimizeResult(data) {
  const toArray = (v) =>
    Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 12) : []
  const toRewrites = (v) =>
    Array.isArray(v)
      ? v.filter(r => r && typeof r === "object" && r.original && r.improved)
          .map(r => ({ original: sanitizeString(String(r.original), 500), improved: sanitizeString(String(r.improved), 500) }))
          .slice(0, 8)
      : []
  return {
    keywords:      toArray(data?.keywords),
    rewrites:      toRewrites(data?.rewrites),
    missingSkills: toArray(data?.missingSkills),
    summary:       sanitizeString(String(data?.summary || ""), 600),
  }
}

function getOptimizeStub(resumeData, lang) {
  const isAr = lang === "ar"
  return normalizeOptimizeResult({
    keywords: isAr
      ? ["JavaScript", "React", "Node.js", "API", "Git", "Agile"]
      : ["JavaScript", "React", "Node.js", "REST API", "Git", "Agile", "CI/CD"],
    rewrites: [
      {
        original: isAr ? "عملت على تطوير تطبيقات الويب" : "Worked on web application development",
        improved: isAr
          ? "طوّر تطبيقات ويب متجاوبة باستخدام React و Node.js، مما حسّن تجربة المستخدم وقلّل وقت التحميل بنسبة 35%"
          : "Developed responsive web applications using React and Node.js, improving user experience and reducing load time by 35%",
      },
      {
        original: isAr ? "مسؤول عن كتابة الكود واختبار البرامج" : "Responsible for writing code and testing software",
        improved: isAr
          ? "صمّم ونفّذ REST APIs وكتب اختبارات وحدة شاملة، مما رفع تغطية الاختبارات إلى 90% وقلّل الأخطاء الإنتاجية بنسبة 50%"
          : "Engineered REST APIs and implemented comprehensive unit tests, achieving 90% code coverage and reducing production bugs by 50%",
      },
    ],
    missingSkills: isAr
      ? ["CI/CD", "Docker", "اختبارات الوحدة", "TypeScript"]
      : ["CI/CD", "Docker", "Unit Testing", "TypeScript"],
    summary: isAr
      ? "مطور ويب متمرّس متخصص في React و Node.js مع خبرة في بناء تطبيقات ويب قابلة للتوسع. ملتزم بأفضل ممارسات البرمجة وتقديم حلول عالية الجودة. (تجريبي — أضف ANTHROPIC_API_KEY لتفعيل التحسين الحقيقي)"
      : "Results-driven Full-Stack Developer specializing in React and Node.js with a track record of building scalable web applications. Committed to clean code practices, CI/CD pipelines, and delivering high-quality solutions in Agile environments. (Demo — add ANTHROPIC_API_KEY for real optimization)",
  })
}

app.post("/api/optimize-resume", aiLimiter, async (req, res) => {
  try {
    const { lang, resumeData, jobDescription } = req.body || {}
    const safeLang = ["en", "ar"].includes(lang) ? lang : "en"

    if (!resumeData || typeof resumeData !== "object") {
      return res.status(400).json({ error: "resumeData is required." })
    }
    if (!jobDescription || typeof jobDescription !== "string" || jobDescription.trim().length < 20) {
      return res.status(400).json({ error: "Job description is required (min 20 characters)." })
    }

    const sanitized = sanitizeResumeData(resumeData)
    if (!sanitized) {
      return res.status(400).json({ error: "Invalid resumeData." })
    }

    const safeJobDesc = sanitizeString(jobDescription, 3000)

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return res.json(getOptimizeStub(sanitized, safeLang))
    }

    const prompt = buildOptimizePrompt(sanitized, safeJobDesc, safeLang)

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`[AI-Optimize] Anthropic API error ${response.status}:`, errText)
      return res.json(getOptimizeStub(sanitized, safeLang))
    }

    const aiData  = await response.json()
    const rawText = aiData.content?.map(b => b.text || "").join("") || ""
    const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error("[AI-Optimize] JSON parse failed:", parseErr.message)
      return res.json(getOptimizeStub(sanitized, safeLang))
    }

    return res.json(normalizeOptimizeResult(parsed))

  } catch (err) {
    console.error("[AI-Optimize] Error:", err)
    return res.status(500).json({ error: "Internal server error." })
  }
})

// ─── AI Job Tailor ───────────────────────────────────────────────────────────

function buildTailorPrompt(resumeData, jobDescription, jobTitle, lang) {
  const isAr = lang === "ar"

  const resumeStr = JSON.stringify({
    name: resumeData.name,
    role: resumeData.role,
    summary: resumeData.summary,
    skills: resumeData.skills,
    experience: resumeData.experience,
  }, null, 2)

  if (isAr) {
    return `أنت خبير في تخصيص السير الذاتية لأنظمة ATS.

الوظيفة المستهدفة: ${jobTitle || "غير محدد"}
وصف الوظيفة:
${jobDescription}

بيانات السيرة الذاتية الحالية:
${resumeStr}

حلل متطلبات الوظيفة وقدّم اقتراحات لتخصيص السيرة الذاتية. أرجع JSON فقط بالشكل التالي:
{
  "matchScore": <0-100 نسبة التوافق الحالي>,
  "missingKeywords": ["كلمة مفتاحية ناقصة 1", "كلمة 2"],
  "presentKeywords": ["كلمة موجودة 1", "كلمة 2"],
  "suggestedSummary": "<ملخص مهني معدّل يتوافق مع الوظيفة>",
  "currentSummary": "<الملخص الحالي>",
  "suggestedSkills": "<مهارات معدّلة مفصولة بفواصل تتوافق مع الوظيفة>",
  "currentSkills": "<المهارات الحالية>",
  "suggestedExperience": "<وصف خبرة معدّل يتوافق مع الوظيفة>",
  "currentExperience": "<وصف الخبرة الحالي>"
}`
  }

  return `You are an expert ATS resume tailoring consultant.

Target Job: ${jobTitle || "Not specified"}
Job Description:
${jobDescription}

Current Resume Data:
${resumeStr}

Analyze the job requirements and suggest specific changes to tailor the resume. Return ONLY JSON — no extra text:
{
  "matchScore": <0-100 current match percentage>,
  "missingKeywords": ["missing keyword 1", "keyword 2"],
  "presentKeywords": ["present keyword 1", "keyword 2"],
  "suggestedSummary": "<rewritten professional summary tailored to this job>",
  "currentSummary": "<current summary>",
  "suggestedSkills": "<rewritten skills comma-separated, tailored to this job>",
  "currentSkills": "<current skills>",
  "suggestedExperience": "<rewritten first experience description tailored to this job>",
  "currentExperience": "<current first experience description>"
}`
}

function getTailorStub(resumeData, lang) {
  const isAr = lang === "ar"
  const currentSummary = resumeData.summary || ""
  const currentSkills  = resumeData.skills || ""
  const firstExp = resumeData.experience?.[0]?.desc || ""

  if (isAr) {
    return {
      matchScore: 58,
      missingKeywords: ["القيادة", "إدارة المشاريع", "Agile", "Scrum"],
      presentKeywords: ["Python", "JavaScript", "Git"],
      suggestedSummary: currentSummary
        ? currentSummary + " متخصص في منهجيات Agile وإدارة المشاريع التقنية."
        : "محترف تقني ذو خبرة في تطوير البرمجيات وإدارة المشاريع بمنهجيات Agile.",
      currentSummary,
      suggestedSkills: currentSkills
        ? currentSkills + ", Agile, Scrum, إدارة المشاريع, القيادة"
        : "Python, JavaScript, Git, Agile, Scrum, إدارة المشاريع, القيادة",
      currentSkills,
      suggestedExperience: firstExp
        ? firstExp + "\nقاد فريق تطوير باستخدام منهجية Agile/Scrum"
        : "قاد تطوير أنظمة تقنية باستخدام منهجية Agile مع فريق من 5 أعضاء",
      currentExperience: firstExp,
    }
  }

  return {
    matchScore: 58,
    missingKeywords: ["Leadership", "Project Management", "Agile", "Scrum"],
    presentKeywords: ["Python", "JavaScript", "Git"],
    suggestedSummary: currentSummary
      ? currentSummary + " Experienced in Agile methodologies and technical project management."
      : "Results-driven professional with expertise in software development and Agile project management.",
    currentSummary,
    suggestedSkills: currentSkills
      ? currentSkills + ", Agile, Scrum, Project Management, Leadership"
      : "Python, JavaScript, Git, Agile, Scrum, Project Management, Leadership",
    currentSkills,
    suggestedExperience: firstExp
      ? firstExp + "\nLed development team using Agile/Scrum methodology"
      : "Led development of technical systems using Agile methodology with a team of 5",
    currentExperience: firstExp,
  }
}

app.post("/api/tailor-resume", aiLimiter, async (req, res) => {
  try {
    const { lang, resumeData, jobDescription, jobTitle } = req.body || {}
    const safeLang = ["en", "ar"].includes(lang) ? lang : "en"

    if (!resumeData || typeof resumeData !== "object") {
      return res.status(400).json({ error: "resumeData is required." })
    }
    if (!jobDescription || typeof jobDescription !== "string" || jobDescription.trim().length < 20) {
      return res.status(400).json({ error: "Job description is required (min 20 characters)." })
    }

    const sanitized = sanitizeResumeData(resumeData)
    if (!sanitized) {
      return res.status(400).json({ error: "Invalid resumeData." })
    }

    const safeJobDesc  = sanitizeString(jobDescription, 3000)
    const safeJobTitle = sanitizeString(jobTitle || "", 150)

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return res.json(getTailorStub(sanitized, safeLang))
    }

    const prompt = buildTailorPrompt(sanitized, safeJobDesc, safeJobTitle, safeLang)

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!response.ok) {
      console.error(`[AI-Tailor] Anthropic API error ${response.status}`)
      return res.json(getTailorStub(sanitized, safeLang))
    }

    const aiData  = await response.json()
    const rawText = aiData.content?.map(b => b.text || "").join("") || ""
    const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error("[AI-Tailor] JSON parse failed")
      return res.json(getTailorStub(sanitized, safeLang))
    }

    // Normalize
    const result = {
      matchScore: Math.min(100, Math.max(0, Number(parsed.matchScore) || 0)),
      missingKeywords: Array.isArray(parsed.missingKeywords)
        ? parsed.missingKeywords.map(String).filter(Boolean).slice(0, 10) : [],
      presentKeywords: Array.isArray(parsed.presentKeywords)
        ? parsed.presentKeywords.map(String).filter(Boolean).slice(0, 10) : [],
      suggestedSummary: sanitizeString(String(parsed.suggestedSummary || ""), 800),
      currentSummary: sanitizeString(String(parsed.currentSummary || ""), 800),
      suggestedSkills: sanitizeString(String(parsed.suggestedSkills || ""), 500),
      currentSkills: sanitizeString(String(parsed.currentSkills || ""), 500),
      suggestedExperience: sanitizeString(String(parsed.suggestedExperience || ""), 800),
      currentExperience: sanitizeString(String(parsed.currentExperience || ""), 800),
    }

    return res.json(result)

  } catch (err) {
    console.error("[AI-Tailor] Error:", err)
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