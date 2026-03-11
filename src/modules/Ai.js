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

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initAIPanel() {
  getEl.openBtn()?.addEventListener("click",  openAIPanel)
  getEl.closeBtn()?.addEventListener("click", closeAIPanel)
  getEl.overlay()?.addEventListener("click",  closeAIPanel)
}