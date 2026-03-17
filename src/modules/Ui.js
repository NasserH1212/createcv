/**
 * ui.js — UI utilities
 * Toast notifications, custom confirm dialog, modal open/close helpers.
 * No business logic — purely presentation layer.
 */

"use strict"

import { $id, $qs } from "./Utils.js"
import { t }        from "./I18n.js"

// ─── Toast System ─────────────────────────────────────────────────────────────

let toastContainer

function getToastContainer() {
  if (!toastContainer) toastContainer = $id("toastContainer")
  return toastContainer
}

/**
 * Shows a temporary toast notification.
 * @param {string} message
 * @param {"success"|"error"|"info"|"warn"} [type]
 * @param {number} [duration] ms
 */
export function showToast(message, type = "success", duration = 3200) {
  const container = getToastContainer()
  if (!container) return

  const toast = document.createElement("div")
  toast.className = `toast toast--${type}`
  toast.setAttribute("role", "status")
  toast.setAttribute("aria-live", "polite")
  toast.textContent = message
  container.appendChild(toast)

  // Trigger enter animation on next frame
  requestAnimationFrame(() => toast.classList.add("toast--visible"))

  setTimeout(() => {
    toast.classList.remove("toast--visible")
    toast.addEventListener("transitionend", () => toast.remove(), { once: true })
  }, duration)
}

// ─── Custom Confirm Dialog ────────────────────────────────────────────────────

/**
 * Shows a custom, accessible confirmation dialog.
 * Returns a Promise that resolves to true (confirmed) or false (cancelled).
 * Replaces the native browser confirm() for a consistent UI.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.body
 * @param {string} [options.confirmLabel]
 * @param {string} [options.cancelLabel]
 * @param {"danger"|"primary"} [options.variant]
 * @returns {Promise<boolean>}
 */
export function showConfirm({ title, body, confirmLabel, cancelLabel, variant = "danger" }) {
  return new Promise(resolve => {
    // Remove any existing confirm dialog
    $id("confirmDialog")?.remove()
    $id("confirmOverlay")?.remove()

    const overlay = document.createElement("div")
    overlay.id = "confirmOverlay"
    overlay.className = "confirm-overlay"

    const dialog = document.createElement("div")
    dialog.id = "confirmDialog"
    dialog.className = "confirm-dialog"
    dialog.setAttribute("role", "alertdialog")
    dialog.setAttribute("aria-modal", "true")
    dialog.setAttribute("aria-labelledby", "confirmTitle")
    dialog.setAttribute("aria-describedby", "confirmBody")

    dialog.innerHTML = `
      <h3 id="confirmTitle" class="confirm-title">${title}</h3>
      <p id="confirmBody" class="confirm-body">${body}</p>
      <div class="confirm-actions">
        <button type="button" id="confirmCancelBtn" class="btn btn-soft">${cancelLabel ?? "Cancel"}</button>
        <button type="button" id="confirmOkBtn" class="btn btn--${variant}">${confirmLabel ?? "Confirm"}</button>
      </div>
    `

    document.body.appendChild(overlay)
    document.body.appendChild(dialog)

    // Trap focus
    const okBtn     = $id("confirmOkBtn")
    const cancelBtn = $id("confirmCancelBtn")

    function onKey(e) {
      if (e.key === "Escape") cleanup(false)
    }

    const cleanup = (result) => {
      document.removeEventListener("keydown", onKey)
      overlay.remove()
      dialog.remove()
      resolve(result)
    }

    okBtn.addEventListener("click",     () => cleanup(true))
    cancelBtn.addEventListener("click", () => cleanup(false))
    overlay.addEventListener("click",   () => cleanup(false))
    document.addEventListener("keydown", onKey)

    // Focus the cancel button by default (safer UX for destructive actions)
    requestAnimationFrame(() => cancelBtn.focus())
  })
}

// ─── Modal Helpers ────────────────────────────────────────────────────────────

/**
 * Opens a modal panel or dialog by adding CSS classes and managing body scroll + focus.
 * @param {HTMLElement} panelEl — the panel/modal element
 * @param {HTMLElement} overlayEl
 * @param {HTMLElement} [focusTarget] — element to focus on open
 * @param {"open"|"visible"} [openClass]
 */
export function openModal(panelEl, overlayEl, focusTarget, openClass = "open") {
  panelEl.classList.add(openClass)
  overlayEl?.classList.remove("hidden")
  document.body.style.overflow = "hidden"
  requestAnimationFrame(() => (focusTarget ?? panelEl)?.focus())
}

/**
 * Closes a modal panel.
 * @param {HTMLElement} panelEl
 * @param {HTMLElement} overlayEl
 * @param {HTMLElement} [returnFocusTarget] — element to return focus to
 * @param {"open"|"visible"} [openClass]
 */
export function closeModal(panelEl, overlayEl, returnFocusTarget, openClass = "open") {
  panelEl.classList.remove(openClass)
  overlayEl?.classList.add("hidden")
  document.body.style.overflow = ""
  returnFocusTarget?.focus()
}

// ─── Focus Trap ───────────────────────────────────────────────────────────────

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Creates a keyboard focus trap within a container element.
 * Call activate() when the modal opens, deactivate() when it closes.
 * @param {HTMLElement} containerEl
 * @returns {{ activate: Function, deactivate: Function }}
 */
export function createFocusTrap(containerEl) {
  function onKeyDown(e) {
    if (e.key !== "Tab") return
    const focusable = Array.from(containerEl.querySelectorAll(FOCUSABLE)).filter(
      el => !el.closest("[hidden]") && el.offsetParent !== null
    )
    if (!focusable.length) { e.preventDefault(); return }
    const first = focusable[0]
    const last  = focusable[focusable.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus() }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }

  return {
    activate()   { containerEl.addEventListener("keydown", onKeyDown) },
    deactivate() { containerEl.removeEventListener("keydown", onKeyDown) },
  }
}

// ─── ATS Score Bar ────────────────────────────────────────────────────────────

/**
 * Updates the ATS score bar UI.
 * @param {number} score — 0 to 100
 * @param {HTMLElement} barEl
 * @param {HTMLElement} valueEl
 * @param {HTMLElement} hintEl
 * @param {HTMLElement} scoreBoxEl
 */
export function updateATSBar(score, barEl, valueEl, hintEl, scoreBoxEl) {
  const tr = t()
  valueEl.textContent = score + "%"
  barEl.style.width   = score + "%"
  scoreBoxEl?.setAttribute("aria-valuenow", score)

  barEl.className = "score-fill"
  if (score >= 80) {
    barEl.classList.add("score-fill--great")
    hintEl.textContent = tr.atsHintGood
  } else if (score >= 55) {
    barEl.classList.add("score-fill--good")
    hintEl.textContent = tr.atsHintMedium
  } else {
    barEl.classList.add("score-fill--poor")
    hintEl.textContent = tr.atsHint
  }
}