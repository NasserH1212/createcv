/**
 * share.js — Share Link Feature
 *
 * Encodes the current resume state into a base64 URL parameter.
 * Decodes shared links on load and restores state.
 * Share i18n is merged into the main i18n — no separate object.
 */

"use strict"

import { $id }           from "./Utils.js"
import { t, currentLang } from "./I18n.js"
import { showToast, openModal, closeModal, createFocusTrap } from "./Ui.js"

let focusTrap = null

// ─── Encode / Decode ─────────────────────────────────────────────────────────

/**
 * Encodes the resume state object into a compact URL-safe base64 string.
 * Only packs the fields that matter for sharing.
 * @param {object} state
 * @returns {string} — the full shareable URL
 */
// Maximum safe URL length (most browsers support ~8000, but some services truncate at 2048)
const MAX_URL_LENGTH = 8000

export function generateShareLink(state) {
  try {
    const payload = {
      n:    state.name,
      r:    state.role,
      e:    state.email,
      p:    state.phone,
      l:    state.location,
      li:   state.linkedin,
      g:    state.github,
      s:    state.summary,
      sk:   state.skills,
      pt:   state.profileType,
      lang: state.lang,
      tmpl: state.template,
      edu:  state.education,
      exp:  state.experience,
      proj: state.projects,
      cert: state.certifications,
      langs:state.languages,
    }
    const json    = JSON.stringify(payload)
    const encoded = btoa(unescape(encodeURIComponent(json)))
    const url = `${window.location.origin}${window.location.pathname}?cv=${encoded}`

    if (url.length > MAX_URL_LENGTH) {
      console.warn(`[Share] URL length (${url.length}) exceeds safe limit`)
    }

    return url
  } catch (e) {
    console.error("[Share] Encode error:", e)
    return window.location.href
  }
}

/**
 * Reads the ?cv= URL parameter and returns the decoded resume state.
 * Returns null if no valid parameter is present.
 * @returns {object|null}
 */
export function decodeShareLink() {
  const param = new URLSearchParams(window.location.search).get("cv")
  if (!param) return null
  try {
    const json = decodeURIComponent(escape(atob(param)))
    return JSON.parse(json)
  } catch (e) {
    console.error("[Share] Decode error:", e)
    return null
  }
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function getEls() {
  return {
    modal:      $id("shareModal"),
    overlay:    $id("shareOverlay"),
    openBtn:    $id("shareBtn"),
    closeBtn:   $id("shareCloseBtn"),
    linkInput:  $id("shareLinkInput"),
    copyBtn:    $id("copyLinkBtn"),
    copied:     $id("shareCopied"),
    copiedTxt:  $id("shareCopiedText"),
    title:      $id("shareModalTitle"),
    desc:       $id("shareModalDesc"),
    note:       $id("shareNote"),
    whatsapp:   $id("shareWhatsapp"),
    email:      $id("shareEmail"),
    linkedin:   $id("shareLinkedin"),
  }
}

function openShareModal(state) {
  const el  = getEls()
  const tr  = t()
  const link = generateShareLink(state)

  // Update modal text
  if (el.title)     el.title.textContent     = tr.shareModalTitle
  if (el.desc)      el.desc.textContent      = tr.shareModalDesc
  if (el.copiedTxt) el.copiedTxt.textContent = tr.shareCopiedText
  if (el.note)      el.note.textContent      = tr.shareNote
  if (el.copyBtn)   el.copyBtn.textContent   = tr.copyBtnLabel
  if (el.linkInput) el.linkInput.value       = link
  if (el.copied)    el.copied.classList.add("hidden")

  // Social share links
  const enc  = encodeURIComponent(link)
  const wpTxt = encodeURIComponent(`${tr.whatsappMsg}\n${link}`)
  const emailBody = encodeURIComponent(`${tr.emailBody}${link}`)
  if (el.whatsapp) el.whatsapp.href = `https://wa.me/?text=${wpTxt}`
  if (el.email)    el.email.href    = `mailto:?subject=${encodeURIComponent(tr.emailSubject)}&body=${emailBody}`
  if (el.linkedin) el.linkedin.href = `https://www.linkedin.com/sharing/share-offsite/?url=${enc}`

  if (!focusTrap && el.modal) focusTrap = createFocusTrap(el.modal)
  focusTrap?.activate()

  // Share modal uses "hidden" class pattern — remove it to show
  el.modal?.classList.remove("hidden")
  el.overlay?.classList.remove("hidden")
  document.body.style.overflow = "hidden"
  requestAnimationFrame(() => (el.closeBtn ?? el.modal)?.focus())

  showToast(tr.toastShareOpened, "info")
}

function closeShareModal() {
  const el = getEls()
  focusTrap?.deactivate()

  // Share modal uses "hidden" class pattern — add it back to hide
  el.modal?.classList.add("hidden")
  el.overlay?.classList.add("hidden")
  document.body.style.overflow = ""
  el.openBtn?.focus()
}

async function copyLink() {
  const el = getEls()
  const tr = t()
  const link = el.linkInput?.value
  if (!link) return

  try {
    await navigator.clipboard.writeText(link)
  } catch {
    el.linkInput?.select()
    document.execCommand("copy")
  }

  if (el.copied)  el.copied.classList.remove("hidden")
  if (el.copyBtn) {
    el.copyBtn.textContent = tr.copyBtnCopied
    el.copyBtn.classList.add("btn--copied")
    setTimeout(() => {
      el.copyBtn.textContent = tr.copyBtnLabel
      el.copyBtn.classList.remove("btn--copied")
      el.copied?.classList.add("hidden")
    }, 2500)
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Initializes share modal event listeners.
 * @param {Function} getState — callback that returns the current resume state
 */
export function initShare(getState) {
  const el = getEls()

  el.openBtn?.addEventListener("click",  () => openShareModal(getState()))
  el.closeBtn?.addEventListener("click", closeShareModal)
  el.overlay?.addEventListener("click",  closeShareModal)
  el.copyBtn?.addEventListener("click",  copyLink)
}