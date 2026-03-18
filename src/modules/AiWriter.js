/**
 * AiWriter.js — AI Experience Description Generator
 *
 * Adds an inline "✦ Write with AI" button below each Experience description textarea.
 * Generates professional ATS-friendly bullet points using the server-side AI endpoint.
 * Usage is limited to 3 generations per day (stored in localStorage).
 */

"use strict"

import { escapeHtml } from "./Utils.js"
import { currentLang, t } from "./I18n.js"
import { showToast } from "./Ui.js"

// ─── Daily Usage Limit ──────────────────────────────────────────────────────

const MAX_DAILY = 3
const STORAGE_KEY = "cv_ai_writes"

function getUsageToday() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return 0
    const { date, count } = JSON.parse(raw)
    if (date !== new Date().toISOString().slice(0, 10)) return 0
    return count || 0
  } catch { return 0 }
}

function incrementUsage() {
  const today = new Date().toISOString().slice(0, 10)
  const count = getUsageToday() + 1
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count }))
  return count
}

function getRemainingUses() {
  return Math.max(0, MAX_DAILY - getUsageToday())
}

// ─── Create AI Write Button + Inline Form ────────────────────────────────────

/**
 * Creates the AI write button and inline form for an Experience card.
 * @param {HTMLTextAreaElement} descTextarea — the description textarea element
 * @param {Function} onUpdate — callback to trigger preview/autosave update
 * @returns {HTMLElement} — container element to append after the textarea field
 */
export function createAiWriteButton(descTextarea, onUpdate) {
  const container = document.createElement("div")
  container.className = "ai-write-container"

  const tr = t()
  const remaining = getRemainingUses()

  // ── Main Button ──
  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = "btn btn-ai btn-sm ai-write-btn"
  btn.textContent = tr.aiWriteBtn
  container.appendChild(btn)

  // ── Remaining counter ──
  const counter = document.createElement("span")
  counter.className = "ai-write-counter"
  updateCounter(counter, remaining)
  container.appendChild(counter)

  // ── Inline Form (hidden initially) ──
  const form = document.createElement("div")
  form.className = "ai-write-form hidden"

  // Try to auto-fill job title from the card's title input
  const cardEl = descTextarea.closest(".item-card")
  const titleInput = cardEl?.querySelector('[data-field="title"]')

  form.innerHTML = `
    <div class="ai-write-fields">
      <div class="field">
        <label>${escapeHtml(tr.aiWriteJobTitle)}</label>
        <input type="text" class="ai-write-input" data-ai="jobTitle" maxlength="120"
               value="${escapeHtml(titleInput?.value || "")}"
               placeholder="${currentLang === "ar" ? "مثال: مهندس برمجيات" : "e.g. Software Engineer"}" />
      </div>
      <div class="field">
        <label>${escapeHtml(tr.aiWriteAchievement)}</label>
        <input type="text" class="ai-write-input" data-ai="achievement" maxlength="300"
               placeholder="${currentLang === "ar" ? "مثال: بنيت نظام إدارة محتوى" : "e.g. Built a CMS from scratch"}" />
      </div>
      <div class="field">
        <label>${escapeHtml(tr.aiWriteYears)}</label>
        <input type="text" class="ai-write-input" data-ai="years" maxlength="10"
               placeholder="${currentLang === "ar" ? "مثال: 3" : "e.g. 3"}" />
      </div>
    </div>
    <div class="ai-write-actions">
      <button type="button" class="btn btn-ai btn-sm ai-write-generate">${escapeHtml(tr.aiWriteGenerate)}</button>
      <button type="button" class="btn btn-soft btn-sm ai-write-cancel">${escapeHtml(tr.aiWriteCancel)}</button>
    </div>
    <div class="ai-write-loading hidden">
      <div class="ai-spinner" role="status"></div>
      <span>${escapeHtml(tr.aiWriteLoading)}</span>
    </div>
    <div class="ai-write-result hidden"></div>
  `
  container.appendChild(form)

  // ─── Event Handlers ──────────────────────────────────────

  // Open form
  btn.addEventListener("click", () => {
    if (getRemainingUses() <= 0) {
      showToast(tr.aiWriteLimitReached, "warn")
      return
    }
    // Sync job title from card if user typed it after page load
    const jtInput = form.querySelector('[data-ai="jobTitle"]')
    if (jtInput && titleInput?.value && !jtInput.value) {
      jtInput.value = titleInput.value
    }
    form.classList.remove("hidden")
    btn.classList.add("hidden")
    form.querySelector('[data-ai="jobTitle"]')?.focus()
  })

  // Cancel
  form.querySelector(".ai-write-cancel")?.addEventListener("click", () => {
    form.classList.add("hidden")
    btn.classList.remove("hidden")
  })

  // Generate
  form.querySelector(".ai-write-generate")?.addEventListener("click", () => {
    handleGenerate(form, descTextarea, counter, btn, onUpdate)
  })

  return container
}

// ─── Generate Handler ────────────────────────────────────────────────────────

async function handleGenerate(form, descTextarea, counter, mainBtn, onUpdate) {
  const tr = t()
  const jobTitle    = form.querySelector('[data-ai="jobTitle"]')?.value?.trim()
  const achievement = form.querySelector('[data-ai="achievement"]')?.value?.trim()
  const years       = form.querySelector('[data-ai="years"]')?.value?.trim()

  if (!jobTitle) {
    showToast(tr.aiWriteJobTitle + " ⚠️", "warn")
    form.querySelector('[data-ai="jobTitle"]')?.focus()
    return
  }

  const loading  = form.querySelector(".ai-write-loading")
  const result   = form.querySelector(".ai-write-result")
  const actions  = form.querySelector(".ai-write-actions")
  const fields   = form.querySelector(".ai-write-fields")

  // Show loading
  loading?.classList.remove("hidden")
  actions?.classList.add("hidden")
  fields?.classList.add("hidden")
  result?.classList.add("hidden")

  try {
    const response = await fetch("/api/generate-description", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lang: currentLang,
        descInput: { jobTitle, achievement, years },
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    const bullets = data.bullets || []

    if (!bullets.length) {
      throw new Error("Empty response")
    }

    // Increment usage
    incrementUsage()
    const remaining = getRemainingUses()
    updateCounter(counter, remaining)

    // Show result
    loading?.classList.add("hidden")
    renderResult(result, bullets, form, descTextarea, mainBtn, counter, onUpdate)

  } catch (err) {
    console.error("[AiWriter]", err.message)
    loading?.classList.add("hidden")
    actions?.classList.remove("hidden")
    fields?.classList.remove("hidden")
    showToast(tr.aiWriteError, "error")
  }
}

// ─── Result Renderer ─────────────────────────────────────────────────────────

function renderResult(resultEl, bullets, form, descTextarea, mainBtn, counter, onUpdate) {
  const tr = t()

  const bulletsHtml = bullets
    .map(b => `<li>${escapeHtml(b)}</li>`)
    .join("")

  resultEl.innerHTML = `
    <ul class="ai-write-bullets">${bulletsHtml}</ul>
    <div class="ai-write-result-actions">
      <button type="button" class="btn btn-ai btn-sm ai-write-use">${escapeHtml(tr.aiWriteUse)}</button>
      <button type="button" class="btn btn-soft btn-sm ai-write-retry">${escapeHtml(tr.aiWriteRetry)}</button>
    </div>
  `
  resultEl.classList.remove("hidden")

  // "Use This" — insert bullets into textarea
  resultEl.querySelector(".ai-write-use")?.addEventListener("click", () => {
    const text = bullets.map(b => `• ${b}`).join("\n")
    descTextarea.value = text
    descTextarea.dispatchEvent(new Event("input", { bubbles: true }))
    onUpdate?.()

    // Close form
    form.classList.add("hidden")
    resultEl.classList.add("hidden")
    mainBtn.classList.remove("hidden")

    showToast("✓", "success", 1500)
  })

  // "Try Again" — go back to form
  resultEl.querySelector(".ai-write-retry")?.addEventListener("click", () => {
    if (getRemainingUses() <= 0) {
      showToast(t().aiWriteLimitReached, "warn")
      return
    }
    resultEl.classList.add("hidden")
    form.querySelector(".ai-write-fields")?.classList.remove("hidden")
    form.querySelector(".ai-write-actions")?.classList.remove("hidden")
  })
}

// ─── Counter Helper ──────────────────────────────────────────────────────────

function updateCounter(counterEl, remaining) {
  const tr = t()
  counterEl.textContent = `${remaining}/${MAX_DAILY} ${tr.aiWriteRemaining}`
  counterEl.classList.toggle("ai-write-counter--empty", remaining === 0)
}
