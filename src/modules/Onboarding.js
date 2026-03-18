/**
 * Onboarding.js — First-visit wizard
 * Shows a 3-step wizard for new users:
 *   Step 1: Choose language
 *   Step 2: Name + Role + Profile type
 *   Step 3: Start from scratch or with AI help
 */

"use strict"

import { $id } from "./Utils.js"
import { t, setLang, currentLang } from "./I18n.js"

const ONBOARDING_KEY = "createcv_onboarded"

/** Check if user has completed onboarding before */
export function hasCompletedOnboarding() {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "1"
  } catch { return false }
}

/** Mark onboarding as done */
function markOnboardingDone() {
  try { localStorage.setItem(ONBOARDING_KEY, "1") } catch {}
}

/**
 * Initializes and shows the onboarding wizard.
 * @param {object} callbacks
 * @param {Function} callbacks.onComplete — called with { name, role, profileType, lang, useAI }
 */
export function initOnboarding(callbacks) {
  const overlay = $id("onboardingOverlay")
  if (!overlay) return

  let chosenLang = "en"
  let chosenProfile = "experienced"
  let currentStep = 1

  const step1 = $id("wizardStep1")
  const step2 = $id("wizardStep2")
  const step3 = $id("wizardStep3")

  // Show the wizard
  overlay.classList.remove("hidden")
  overlay.setAttribute("aria-hidden", "false")
  document.body.style.overflow = "hidden"

  // ─── Step 1: Language Selection ───────────────────
  const langBtns = overlay.querySelectorAll("[data-wizard-lang]")
  langBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      chosenLang = btn.dataset.wizardLang
      goToStep(2)
    })
  })

  // ─── Step 2: Basic Info ───────────────────────────
  const profileBtns = overlay.querySelectorAll("[data-profile]")
  profileBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      chosenProfile = btn.dataset.profile
      profileBtns.forEach(b => b.classList.remove("wizard-profile-btn--active"))
      btn.classList.add("wizard-profile-btn--active")
    })
  })

  $id("wizardBackBtn")?.addEventListener("click", () => goToStep(1))

  $id("wizardNextBtn")?.addEventListener("click", () => {
    goToStep(3)
  })

  // ─── Step 3: Start ───────────────────────────────
  $id("wizardStartScratch")?.addEventListener("click", () => {
    finish(false)
  })

  $id("wizardStartAI")?.addEventListener("click", () => {
    finish(true)
  })

  // ─── Navigation ──────────────────────────────────
  function goToStep(step) {
    currentStep = step
    ;[step1, step2, step3].forEach(el => {
      if (el) el.classList.remove("wizard-step--active")
    })

    const target = step === 1 ? step1 : step === 2 ? step2 : step3
    if (target) {
      target.classList.add("wizard-step--active")
    }

    // Apply translations when moving to step 2+
    if (step >= 2) {
      applyWizardTranslations(chosenLang)
    }

    // Auto-focus name field on step 2
    if (step === 2) {
      setTimeout(() => $id("wizardName")?.focus(), 300)
    }
  }

  function applyWizardTranslations(lang) {
    setLang(lang)
    const tr = t()
    const dir = lang === "ar" ? "rtl" : "ltr"

    // Apply direction to wizard
    const wizard = overlay.querySelector(".onboarding-wizard")
    if (wizard) wizard.style.direction = dir

    // Update text
    const updates = {
      wizardStep2Title:       "wizardStep2Title",
      wizardStep2Subtitle:    "wizardStep2Subtitle",
      wizardLabelName:        "wizardLabelName",
      wizardLabelRole:        "wizardLabelRole",
      wizardLabelProfile:     "wizardLabelProfile",
      wizardProfileExp:       "wizardProfileExp",
      wizardProfileGrad:      "wizardProfileGrad",
      wizardStep3Title:       "wizardStep3Title",
      wizardStep3Subtitle:    "wizardStep3Subtitle",
      wizardStartScratchLabel: "wizardStartScratchLabel",
      wizardStartScratchDesc: "wizardStartScratchDesc",
      wizardStartAILabel:     "wizardStartAILabel",
      wizardStartAIDesc:      "wizardStartAIDesc",
    }
    Object.entries(updates).forEach(([elId, trKey]) => {
      const el = $id(elId)
      if (el && tr[trKey]) el.textContent = tr[trKey]
    })

    // Update button text
    const backBtn = $id("wizardBackBtn")
    const nextBtn = $id("wizardNextBtn")
    if (backBtn) backBtn.textContent = tr.wizardBackBtn
    if (nextBtn) nextBtn.textContent = tr.wizardNextBtn

    // Update placeholders
    const nameInput = $id("wizardName")
    const roleInput = $id("wizardRole")
    if (nameInput) nameInput.placeholder = tr.wizardNamePlaceholder
    if (roleInput) roleInput.placeholder = tr.wizardRolePlaceholder
  }

  function finish(useAI) {
    const name = $id("wizardName")?.value?.trim() || ""
    const role = $id("wizardRole")?.value?.trim() || ""

    markOnboardingDone()

    // Close wizard
    overlay.classList.add("hidden")
    overlay.setAttribute("aria-hidden", "true")
    document.body.style.overflow = ""

    callbacks.onComplete({
      name,
      role,
      profileType: chosenProfile,
      lang: chosenLang,
      useAI,
    })
  }
}
