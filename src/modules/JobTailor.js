/**
 * JobTailor.js — AI Job Tailoring Feature
 *
 * User pastes a job description → AI analyzes requirements →
 * suggests specific changes to summary, experience, skills.
 * User can apply changes with one click per section.
 */

"use strict"

import { escapeHtml, $id } from "./Utils.js"
import { currentLang, t }  from "./I18n.js"
import { showToast }       from "./Ui.js"
import { createFocusTrap }  from "./Ui.js"

// ─── DOM Elements ─────────────────────────────────────────────────────────────

const getEl = {
  modal:      () => $id("tailorModal"),
  overlay:    () => $id("tailorOverlay"),
  openBtn:    () => $id("tailorBtn"),
  closeBtn:   () => $id("tailorCloseBtn"),
  input:      () => $id("tailorInput"),
  loading:    () => $id("tailorLoading"),
  result:     () => $id("tailorResult"),
  analyzeBtn: () => $id("tailorAnalyzeBtn"),
  jobTitle:   () => $id("tailorJobTitle"),
  jobDesc:    () => $id("tailorJobDesc"),
}

let focusTrap = null

// ─── Open / Close ─────────────────────────────────────────────────────────────

export function openTailorModal() {
  const modal   = getEl.modal()
  const overlay = getEl.overlay()

  if (!modal || !overlay) return

  if (!focusTrap) focusTrap = createFocusTrap(modal)
  focusTrap.activate()

  modal.classList.remove("hidden")
  overlay.classList.remove("hidden")
  document.body.style.overflow = "hidden"

  // Apply translations
  applyTailorTranslations()

  requestAnimationFrame(() => getEl.jobDesc()?.focus())
}

export function closeTailorModal() {
  const modal   = getEl.modal()
  const overlay = getEl.overlay()

  focusTrap?.deactivate()
  modal?.classList.add("hidden")
  overlay?.classList.add("hidden")
  document.body.style.overflow = ""
  getEl.openBtn()?.focus()
}

function applyTailorTranslations() {
  const tr = t()
  const updates = {
    tailorModalTitle:  "tailorModalTitle",
    tailorDesc:        "tailorDesc",
    tailorJobTitleLabel: "tailorJobTitleLabel",
    tailorJobDescLabel: "tailorJobDescLabel",
    tailorLoadingText: "tailorLoadingText",
  }
  Object.entries(updates).forEach(([elId, trKey]) => {
    const el = $id(elId)
    if (el && tr[trKey]) el.textContent = tr[trKey]
  })

  const analyzeBtn = getEl.analyzeBtn()
  if (analyzeBtn) analyzeBtn.textContent = tr.tailorAnalyzeBtn

  const jobTitle = getEl.jobTitle()
  const jobDesc  = getEl.jobDesc()
  if (jobTitle) jobTitle.placeholder = tr.tailorJobTitlePlaceholder
  if (jobDesc)  jobDesc.placeholder  = tr.tailorJobDescPlaceholder
}

// ─── Tailor Request ───────────────────────────────────────────────────────────

/**
 * @param {object} resumeData — current resume state from getState()
 * @param {Function} onApply — callback when user applies a change: onApply(field, value)
 */
export async function tailorResume(resumeData, onApply) {
  const input   = getEl.input()
  const loading = getEl.loading()
  const result  = getEl.result()
  const tr      = t()

  const jobDescription = getEl.jobDesc()?.value?.trim()
  const jobTitle       = getEl.jobTitle()?.value?.trim()

  if (!jobDescription || jobDescription.length < 20) {
    showToast(tr.tailorEmpty, "warn")
    return
  }

  // Show loading
  input?.classList.add("hidden")
  loading?.classList.remove("hidden")
  result?.classList.add("hidden")

  try {
    const response = await fetch("/api/tailor-resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lang: currentLang,
        resumeData,
        jobDescription,
        jobTitle,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${response.status}`)
    }

    const data = await response.json()
    renderTailorResult(data, onApply)

  } catch (err) {
    console.error("[Tailor]", err.message)
    loading?.classList.add("hidden")
    input?.classList.remove("hidden")
    showToast(tr.tailorError, "error")
  }
}

// ─── Result Renderer ──────────────────────────────────────────────────────────

function renderTailorResult(data, onApply) {
  const loading  = getEl.loading()
  const result   = getEl.result()
  const input    = getEl.input()
  const tr       = t()

  loading?.classList.add("hidden")
  input?.classList.add("hidden")

  if (!result) return

  const score = Math.min(100, Math.max(0, data.matchScore || 0))

  // Keywords HTML
  const missingKeywords = (data.missingKeywords || []).map(k =>
    `<span class="tailor-keyword tailor-keyword--missing">${escapeHtml(k)}</span>`
  ).join("")
  const presentKeywords = (data.presentKeywords || []).map(k =>
    `<span class="tailor-keyword tailor-keyword--present">✓ ${escapeHtml(k)}</span>`
  ).join("")

  // Build suggestion sections
  const suggestions = []

  if (data.suggestedSummary) {
    suggestions.push(buildSuggestion(
      tr.tailorSummaryTitle,
      "summary",
      data.currentSummary,
      data.suggestedSummary,
      onApply,
      tr
    ))
  }

  if (data.suggestedExperience) {
    suggestions.push(buildSuggestion(
      tr.tailorExperienceTitle,
      "experience",
      data.currentExperience,
      data.suggestedExperience,
      onApply,
      tr
    ))
  }

  if (data.suggestedSkills) {
    suggestions.push(buildSuggestion(
      tr.tailorSkillsTitle,
      "skills",
      data.currentSkills,
      data.suggestedSkills,
      onApply,
      tr
    ))
  }

  result.innerHTML = `
    <div class="tailor-match">
      <div class="tailor-match-circle" aria-label="Match: ${score}%">${score}%</div>
      <div class="tailor-match-text">
        <strong>${escapeHtml(tr.tailorMatchLabel)}</strong>
        <span>${escapeHtml(tr.tailorMatchComment)}</span>
      </div>
    </div>

    ${(missingKeywords || presentKeywords) ? `
    <div class="tailor-suggestion">
      <div class="tailor-suggestion-head">${escapeHtml(tr.tailorKeywordsTitle)}</div>
      <div class="tailor-suggestion-body">
        ${missingKeywords ? `<div style="margin-bottom:8px"><strong style="font-size:.82rem;color:var(--color-danger)">${escapeHtml(tr.tailorMissingLabel)}:</strong><div class="tailor-keywords">${missingKeywords}</div></div>` : ""}
        ${presentKeywords ? `<div><strong style="font-size:.82rem;color:var(--color-success)">${escapeHtml(tr.tailorPresentLabel)}:</strong><div class="tailor-keywords">${presentKeywords}</div></div>` : ""}
      </div>
    </div>` : ""}

    ${suggestions.join("")}

    <div class="tailor-actions">
      <button type="button" class="btn btn-ai-main" id="tailorRetryBtn">${escapeHtml(tr.tailorRetryBtn)}</button>
    </div>
  `

  result.classList.remove("hidden")

  // Wire apply buttons
  result.querySelectorAll("[data-tailor-apply]").forEach(btn => {
    btn.addEventListener("click", () => {
      const field = btn.dataset.tailorApply
      const value = btn.dataset.tailorValue
      if (field && value && onApply) {
        onApply(field, value)
        btn.textContent = tr.tailorApplied
        btn.classList.add("tailor-apply-btn--applied")
        showToast(tr.tailorToastSuccess, "success")
      }
    })
  })

  // Wire retry
  $id("tailorRetryBtn")?.addEventListener("click", () => {
    result.classList.add("hidden")
    input?.classList.remove("hidden")
  })
}

function buildSuggestion(title, field, current, suggested, onApply, tr) {
  const safeOld = escapeHtml(current || "—")
  const safeNew = escapeHtml(suggested || "")
  const escapedValue = escapeHtml(suggested).replace(/"/g, "&quot;")

  return `
    <div class="tailor-suggestion">
      <div class="tailor-suggestion-head">
        ${escapeHtml(title)}
        <button type="button" class="tailor-apply-btn" data-tailor-apply="${field}" data-tailor-value="${escapedValue}">
          ${escapeHtml(tr.tailorApplyBtn)}
        </button>
      </div>
      <div class="tailor-suggestion-body">
        <div class="tailor-old">${safeOld}</div>
        <div class="tailor-new">${safeNew}</div>
      </div>
    </div>
  `
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initJobTailor() {
  getEl.openBtn()?.addEventListener("click",  openTailorModal)
  getEl.closeBtn()?.addEventListener("click", closeTailorModal)
  getEl.overlay()?.addEventListener("click",  closeTailorModal)
}
