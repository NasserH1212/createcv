/**
 * ai.js — AI Resume Analysis Client
 *
 * Handles communication with the /api/analyze-resume endpoint.
 * Note: The prompt is built SERVER-SIDE — this module only sends resumeData + lang.
 * Renders results into the AI panel using escapeHtml for safety.
 */

"use strict"

import { escapeHtml, $id }      from "./Utils.js"
import { currentLang, t }       from "./I18n.js"
import { showToast }            from "./Ui.js"
import { openModal, closeModal, createFocusTrap } from "./Ui.js"

// ─── DOM Elements ─────────────────────────────────────────────────────────────

const getEl = {
  panel:      () => $id("aiPanel"),
  overlay:    () => $id("aiOverlay"),
  openBtn:    () => $id("aiBtn"),
  closeBtn:   () => $id("aiCloseBtn"),
  loading:    () => $id("aiLoading"),
  result:     () => $id("aiResult"),
  empty:      () => $id("aiEmpty"),
  analyzeBtn: () => $id("aiAnalyzeBtn"),
  titleEl:    () => $id("aiPanelTitle"),
  loadingTxt: () => $id("aiLoadingText"),
  emptyTxt:   () => $id("aiEmptyText"),
}

let focusTrap = null

// ─── Panel Open / Close ───────────────────────────────────────────────────────

export function openAIPanel() {
  const panel   = getEl.panel()
  const overlay = getEl.overlay()
  const closeBtn = getEl.closeBtn()

  if (!focusTrap) focusTrap = createFocusTrap(panel)
  focusTrap.activate()
  openModal(panel, overlay, closeBtn)
}

export function closeAIPanel() {
  const panel   = getEl.panel()
  const overlay = getEl.overlay()

  focusTrap?.deactivate()
  closeModal(panel, overlay, getEl.openBtn())
}

// ─── Analyze ──────────────────────────────────────────────────────────────────

/**
 * Sends resumeData to the server and renders the analysis result.
 * The server constructs the AI prompt — we never send a prompt from the client.
 *
 * @param {object} resumeData — the current collected form data
 */
export async function analyzeResume(resumeData) {
  const loading    = getEl.loading()
  const result     = getEl.result()
  const empty      = getEl.empty()

  // Show loading state
  loading?.classList.remove("hidden")
  result?.classList.add("hidden")
  empty?.classList.add("hidden")

  try {
    const response = await fetch("/api/analyze-resume", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lang: currentLang,
        resumeData,
        // NOTE: NO prompt field — server builds it
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${response.status}`)
    }

    const data = await response.json()
    renderAIResult(data)

  } catch (err) {
    console.error("[AI]", err.message)
    loading?.classList.add("hidden")
    empty?.classList.remove("hidden")
    showToast(t().toastAnalysisError, "error")
  }
}

// ─── Result Renderer ──────────────────────────────────────────────────────────

function renderAIResult(result) {
  const loading = getEl.loading()
  const resultEl = getEl.result()
  const empty   = getEl.empty()

  loading?.classList.add("hidden")
  empty?.classList.add("hidden")

  if (!resultEl) return

  const isAr = currentLang === "ar"
  const score = result.overallScore ?? 0

  // Build score color based on value
  let scoreClass = "ai-score-circle--poor"
  if (score >= 80)      scoreClass = "ai-score-circle--great"
  else if (score >= 60) scoreClass = "ai-score-circle--good"

  /**
   * Builds an HTML list from an array, escaping all items.
   */
  const makeList = (items) =>
    items?.length
      ? `<ul>${items.map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`
      : ""

  /**
   * Builds the rewrites section with before/after blocks and copy buttons.
   */
  const makeRewrites = (rewrites) => {
    if (!rewrites?.length) return ""
    return rewrites.map((r, i) => `
      <div class="ai-rewrite-card">
        <div class="ai-rewrite-before">
          <span class="ai-rewrite-label">${isAr ? "الأصلي:" : "Before:"}</span>
          <span class="ai-rewrite-text ai-rewrite-text--old">${escapeHtml(r.original)}</span>
        </div>
        <div class="ai-rewrite-after">
          <span class="ai-rewrite-label">${isAr ? "المحسّن:" : "After:"}</span>
          <span class="ai-rewrite-text ai-rewrite-text--new">${escapeHtml(r.improved)}</span>
        </div>
        <button type="button" class="btn btn-copy-rewrite" data-copy-idx="${i}" title="${isAr ? "نسخ" : "Copy"}">
          ${isAr ? "📋 نسخ النص المحسّن" : "📋 Copy improved text"}
        </button>
      </div>
    `).join("")
  }

  resultEl.innerHTML = `
    <div class="ai-score-display">
      <div class="ai-score-circle ${scoreClass}" aria-label="Score: ${score}%">
        ${score}%
      </div>
      <div class="ai-score-text">
        <strong>${isAr ? "النقاط الإجمالية" : "Overall Score"}</strong>
        <span>${escapeHtml(result.scoreComment || "")}</span>
      </div>
    </div>

    ${result.rewrites?.length ? `
    <div class="ai-section">
      <div class="ai-section-head ai-section-head--green">
        ✏️ ${isAr ? "إعادة كتابة مقترحة — انسخ مباشرة" : "Suggested Rewrites — Copy & Paste"}
      </div>
      <div class="ai-section-body ai-rewrites-body">${makeRewrites(result.rewrites)}</div>
    </div>` : ""}

    ${result.strengths?.length ? `
    <div class="ai-section">
      <div class="ai-section-head ai-section-head--green">
        ✅ ${isAr ? "نقاط القوة" : "Strengths"}
      </div>
      <div class="ai-section-body">${makeList(result.strengths)}</div>
    </div>` : ""}

    ${result.improvements?.length ? `
    <div class="ai-section">
      <div class="ai-section-head ai-section-head--yellow">
        ⚠️ ${isAr ? "نقاط تحتاج تحسين" : "Needs Improvement"}
      </div>
      <div class="ai-section-body">${makeList(result.improvements)}</div>
    </div>` : ""}

    ${result.atsIssues?.length ? `
    <div class="ai-section">
      <div class="ai-section-head ai-section-head--blue">
        🔍 ${isAr ? "مشاكل ATS" : "ATS Issues"}
      </div>
      <div class="ai-section-body">${makeList(result.atsIssues)}</div>
    </div>` : ""}

    ${result.suggestions?.length ? `
    <div class="ai-section">
      <div class="ai-section-head ai-section-head--purple">
        ✦ ${isAr ? "اقتراحات عملية" : "Actionable Suggestions"}
      </div>
      <div class="ai-section-body">${makeList(result.suggestions)}</div>
    </div>` : ""}

    <button type="button" class="btn btn-ai-main ai-reanalyze" id="reanalyzeBtn">
      ${isAr ? "✦ إعادة التحليل" : "✦ Re-analyze"}
    </button>
  `

  // Wire up copy buttons for rewrites
  resultEl.querySelectorAll(".btn-copy-rewrite").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.copyIdx)
      const text = result.rewrites?.[idx]?.improved
      if (!text) return
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = isAr ? "✅ تم النسخ!" : "✅ Copied!"
        setTimeout(() => { btn.textContent = isAr ? "📋 نسخ النص المحسّن" : "📋 Copy improved text" }, 2000)
      })
    })
  })

  resultEl.classList.remove("hidden")

  // Wire up re-analyze button (result is re-rendered, so must re-bind)
  $id("reanalyzeBtn")?.addEventListener("click", () => {
    // The main app re-collects data and calls analyzeResume()
    // We emit a custom event so main.js handles data collection
    resultEl.dispatchEvent(new CustomEvent("reanalyze", { bubbles: true }))
  })

  // Announce result to screen readers
  resultEl.setAttribute("aria-live", "polite")
}

// ─── Optimize for Job ─────────────────────────────────────────────────────────

/**
 * Sends resumeData + jobDescription to the server for job-specific optimization.
 * Renders results into the same AI result panel.
 *
 * @param {object} resumeData — the current collected form data
 */
export async function optimizeResume(resumeData) {
  const loading = getEl.loading()
  const result  = getEl.result()
  const empty   = getEl.empty()
  const jobDesc = $id("aiJobDesc")?.value?.trim()

  if (!jobDesc || jobDesc.length < 20) {
    showToast(
      currentLang === "ar"
        ? "الرجاء لصق وصف وظيفي (20 حرف على الأقل)"
        : "Please paste a job description (at least 20 characters)",
      "warn"
    )
    return
  }

  loading?.classList.remove("hidden")
  result?.classList.add("hidden")
  empty?.classList.add("hidden")

  const loadingTxt = getEl.loadingTxt()
  if (loadingTxt) loadingTxt.textContent = currentLang === "ar"
    ? "جاري تحسين سيرتك الذاتية..."
    : "Optimizing your CV for this job..."

  try {
    const response = await fetch("/api/optimize-resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lang: currentLang,
        resumeData,
        jobDescription: jobDesc,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${response.status}`)
    }

    const data = await response.json()
    renderOptimizeResult(data)

  } catch (err) {
    console.error("[AI-Optimize]", err.message)
    loading?.classList.add("hidden")
    empty?.classList.remove("hidden")
    showToast(
      currentLang === "ar" ? "حدث خطأ أثناء التحسين" : "Optimization failed, please try again",
      "error"
    )
  }
}

function renderOptimizeResult(data) {
  const loading  = getEl.loading()
  const resultEl = getEl.result()
  const empty    = getEl.empty()

  loading?.classList.add("hidden")
  empty?.classList.add("hidden")

  if (!resultEl) return

  const isAr = currentLang === "ar"

  const makeRewrites = (rewrites) => {
    if (!rewrites?.length) return ""
    return rewrites.map((r, i) => `
      <div class="ai-rewrite-card">
        <div class="ai-rewrite-before">
          <span class="ai-rewrite-label">${isAr ? "الأصلي:" : "Before:"}</span>
          <span class="ai-rewrite-text ai-rewrite-text--old">${escapeHtml(r.original)}</span>
        </div>
        <div class="ai-rewrite-after">
          <span class="ai-rewrite-label">${isAr ? "المحسّن:" : "After:"}</span>
          <span class="ai-rewrite-text ai-rewrite-text--new">${escapeHtml(r.improved)}</span>
        </div>
        <button type="button" class="btn btn-copy-rewrite" data-copy-idx="${i}" title="${isAr ? "نسخ" : "Copy"}">
          ${isAr ? "📋 نسخ النص المحسّن" : "📋 Copy improved text"}
        </button>
      </div>
    `).join("")
  }

  const makeKeywords = (keywords) => {
    if (!keywords?.length) return ""
    return keywords.map(k =>
      `<span class="tailor-keyword tailor-keyword--present">${escapeHtml(k)}</span>`
    ).join("")
  }

  const makeMissing = (skills) => {
    if (!skills?.length) return ""
    return skills.map(s =>
      `<span class="tailor-keyword tailor-keyword--missing">${escapeHtml(s)}</span>`
    ).join("")
  }

  resultEl.innerHTML = `
    ${data.summary ? `
    <div class="ai-section">
      <div class="ai-section-head ai-section-head--green">
        ✏️ ${isAr ? "ملخص مهني محسّن — انسخه مباشرة" : "Optimized Summary — Copy & Paste"}
      </div>
      <div class="ai-section-body">
        <div class="ai-rewrite-card">
          <div class="ai-rewrite-text ai-rewrite-text--new" style="text-decoration:none">${escapeHtml(data.summary)}</div>
          <button type="button" class="btn btn-copy-rewrite" id="copySummaryBtn" title="${isAr ? "نسخ" : "Copy"}">
            ${isAr ? "📋 نسخ الملخص" : "📋 Copy summary"}
          </button>
        </div>
      </div>
    </div>` : ""}

    ${data.rewrites?.length ? `
    <div class="ai-section">
      <div class="ai-section-head ai-section-head--purple">
        🎯 ${isAr ? "إعادة كتابة للوظيفة المستهدفة" : "Rewrites Targeting this Job"}
      </div>
      <div class="ai-section-body ai-rewrites-body">${makeRewrites(data.rewrites)}</div>
    </div>` : ""}

    ${data.keywords?.length ? `
    <div class="ai-section">
      <div class="ai-section-head ai-section-head--blue">
        🔑 ${isAr ? "كلمات مفتاحية من الوظيفة" : "Keywords from Job Posting"}
      </div>
      <div class="ai-section-body"><div class="tailor-keywords">${makeKeywords(data.keywords)}</div></div>
    </div>` : ""}

    ${data.missingSkills?.length ? `
    <div class="ai-section">
      <div class="ai-section-head ai-section-head--yellow">
        ⚠️ ${isAr ? "مهارات ناقصة من سيرتك" : "Skills Missing from your CV"}
      </div>
      <div class="ai-section-body"><div class="tailor-keywords">${makeMissing(data.missingSkills)}</div></div>
    </div>` : ""}

    <button type="button" class="btn btn-ai-main ai-reanalyze" id="reanalyzeBtn">
      ${isAr ? "✦ إعادة التحليل" : "✦ Back to Analyzer"}
    </button>
  `

  resultEl.classList.remove("hidden")

  // Wire copy buttons for rewrites
  resultEl.querySelectorAll(".btn-copy-rewrite").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = btn.dataset.copyIdx
      const text = idx !== undefined ? data.rewrites?.[Number(idx)]?.improved : data.summary
      if (!text) return
      navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent
        btn.textContent = isAr ? "✅ تم النسخ!" : "✅ Copied!"
        setTimeout(() => { btn.textContent = orig }, 2000)
      })
    })
  })

  // Wire copy summary button separately
  $id("copySummaryBtn")?.addEventListener("click", () => {
    if (!data.summary) return
    const btn = $id("copySummaryBtn")
    navigator.clipboard.writeText(data.summary).then(() => {
      const orig = btn.textContent
      btn.textContent = isAr ? "✅ تم النسخ!" : "✅ Copied!"
      setTimeout(() => { btn.textContent = orig }, 2000)
    })
  })

  // Wire back button
  $id("reanalyzeBtn")?.addEventListener("click", () => {
    resultEl.dispatchEvent(new CustomEvent("reanalyze", { bubbles: true }))
  })

  resultEl.setAttribute("aria-live", "polite")
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initAIPanel() {
  getEl.openBtn()?.addEventListener("click",  openAIPanel)
  getEl.closeBtn()?.addEventListener("click", closeAIPanel)
  getEl.overlay()?.addEventListener("click",  closeAIPanel)
}