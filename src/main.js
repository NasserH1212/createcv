/**
 * main.js — Application Entry Point
 *
 * Wires all modules together. This file should remain thin:
 * - Import modules
 * - Initialize event listeners
 * - Orchestrate data flow between form → preview → storage
 *
 * No business logic lives here. Each module owns its domain.
 */

"use strict"

import { $id, $all, debounce }           from "./modules/Utils.js"
import { i18n, t, currentLang, setLang } from "./modules/I18n.js"
import { showToast, showConfirm, updateATSBar } from "./modules/Ui.js"
import { saveData, loadData, clearData, createAutosave } from "./modules/Storage.js"
import { renderFullPreview }             from "./modules/Preview.js"
import { calculateATSScore }             from "./modules/Ats.js"
import { exportPDF }                     from "./modules/Pdf.js"
import { initAIPanel, analyzeResume, openAIPanel, closeAIPanel } from "./modules/Ai.js"
import { initShare, decodeShareLink }    from "./modules/Share.js"
import { hasCompletedOnboarding, initOnboarding } from "./modules/Onboarding.js"
import {
  createEducation, createExperience, createProject, createCertification, createLanguageItem,
  getEducationData, getExperienceData, getProjectsData, getCertificationsData, getLanguagesData,
  rebuildDynamicLabels, loadSampleCards,
} from "./modules/form.js"

// ─── Static Input Elements ────────────────────────────────────────────────────

const inputs = {
  name:        $id("fullName"),
  role:        $id("targetRole"),
  email:       $id("email"),
  phone:       $id("phone"),
  location:    $id("location"),
  linkedin:    $id("linkedin"),
  github:      $id("github"),
  summary:     $id("summary"),
  skills:      $id("skills"),
  profileType: $id("profileType"),
}

const templateSelect  = $id("templateSelect")
const resumePreview   = $id("resumePreview")
const atsBar          = $id("atsBar")
const atsValue        = $id("atsValue")
const atsHint         = $id("atsHint")
const scoreBox        = document.querySelector(".score-box")

// ─── State Collector ──────────────────────────────────────────────────────────

/**
 * Collects the full current resume state from all inputs and dynamic sections.
 * This is the single source of truth for state.
 * @returns {object}
 */
function getState() {
  return {
    name:        inputs.name?.value        ?? "",
    role:        inputs.role?.value        ?? "",
    email:       inputs.email?.value       ?? "",
    phone:       inputs.phone?.value       ?? "",
    location:    inputs.location?.value    ?? "",
    linkedin:    inputs.linkedin?.value    ?? "",
    github:      inputs.github?.value      ?? "",
    summary:     inputs.summary?.value     ?? "",
    skills:      inputs.skills?.value      ?? "",
    profileType: inputs.profileType?.value ?? "experienced",
    lang:        currentLang,
    template:    templateSelect?.value     ?? "classic",
    education:       getEducationData(),
    experience:      getExperienceData(),
    projects:        getProjectsData(),
    certifications:  getCertificationsData(),
    languages:       getLanguagesData(),
  }
}

// ─── Core Update Cycle ────────────────────────────────────────────────────────

/**
 * Main render cycle: collect state → render preview → update ATS bar.
 * Called on every user input (debounced).
 * Autosave is decoupled and runs on its own timer.
 */
function updateAll() {
  const state = getState()
  renderFullPreview(state)
  const score = calculateATSScore(state)
  updateATSBar(score, atsBar, atsValue, atsHint, scoreBox)
}

const updateAllDebounced = debounce(updateAll, 120)

// ─── Autosave (decoupled from preview) ───────────────────────────────────────
// Saves every 5 seconds after last change — not on every keypress.

const scheduleAutosave = createAutosave(getState)

// ─── Template ─────────────────────────────────────────────────────────────────

function applyTemplate(name) {
  if (!resumePreview) return
  resumePreview.classList.remove("template-classic", "template-executive", "template-minimal")
  resumePreview.classList.add(`template-${name}`)
}

// ─── Language Switch ──────────────────────────────────────────────────────────

/**
 * Updates all static UI text and rebuilds dynamic card labels.
 * @param {"en"|"ar"} lang
 */
function applyTranslation(lang) {
  setLang(lang)
  const tr = t()

  // Update all elements that have a matching i18n key as their ID
  const staticIds = [
    "brandSubtitle","heroBadge","heroTitle","heroDescription",
    "heroFeature1","heroFeature2","heroFeature3","heroFeature4","heroFeature5",
    "statTemplates","statFree","statAI",
    "editorTitle","editorSubtitle","previewTitle","previewSubtitle",
    "atsLabel","atsHint",
    "sectionPersonal","sectionEducation","sectionExperience","sectionProjects",
    "sectionCertifications","sectionSkillsLanguages",
    "labelFullName","labelTargetRole","labelEmail","labelPhone",
    "labelLocation","labelProfileType","labelLinkedin","labelGithub",
    "labelSummary","summaryHint","labelSkills","skillsHint",
    "labelLanguages","languagesHint",
    "cvSummaryHeading","cvEducationHeading","cvExperienceHeading",
    "cvProjectsHeading","cvSkillsHeading","cvCertificationsHeading","cvLanguagesHeading",
    "aiPanelTitle","aiLoadingText","aiEmptyText",
  ]

  staticIds.forEach(id => {
    const el = $id(id)
    if (el && tr[id] !== undefined) el.textContent = tr[id]
  })

  // Placeholder updates
  const placeholderMap = {
    fullName:   "fullNamePlaceholder",
    targetRole: "targetRolePlaceholder",
    email:      "emailPlaceholder",
    phone:      "phonePlaceholder",
    location:   "locationPlaceholder",
    summary:    "summaryPlaceholder",
    skills:     "skillsPlaceholder",
  }
  Object.entries(placeholderMap).forEach(([inputKey, trKey]) => {
    if (inputs[inputKey]) inputs[inputKey].placeholder = tr[trKey]
  })

  // Button text updates
  const buttonMap = {
    addEducationBtn:    "addEducation",
    addExperienceBtn:   "addExperience",
    addProjectBtn:      "addProject",
    addCertificationBtn:"addCertification",
    addLanguageBtn:     "addLanguage",
    aiAnalyzeBtn:       "analyzeBtn",
  }
  Object.entries(buttonMap).forEach(([id, trKey]) => {
    const el = $id(id)
    if (el) el.textContent = tr[trKey]
  })

  // Direction & lang attribute
  document.documentElement.lang = lang
  document.documentElement.dir  = lang === "ar" ? "rtl" : "ltr"

  // Language toggle button states
  $all(".lang-btn").forEach(btn => {
    const isActive = btn.dataset.lang === lang
    btn.classList.toggle("active", isActive)
    btn.setAttribute("aria-pressed", String(isActive))
  })

  // Rebuild dynamic card labels
  rebuildDynamicLabels()
}

// ─── Data Load/Restore ────────────────────────────────────────────────────────

/**
 * Restores state from a saved data object (localStorage or share link).
 * @param {object} data
 */
function restoreState(data) {
  // Normalize share link compressed keys to full keys
  const norm = {
    name:     data.name     ?? data.n  ?? "",
    role:     data.role     ?? data.r  ?? "",
    email:    data.email    ?? data.e  ?? "",
    phone:    data.phone    ?? data.p  ?? "",
    location: data.location ?? data.l  ?? "",
    linkedin: data.linkedin ?? data.li ?? "",
    github:   data.github   ?? data.g  ?? "",
    summary:  data.summary  ?? data.s  ?? "",
    skills:   data.skills   ?? data.sk ?? "",
    profileType: data.profileType ?? data.pt ?? "experienced",
    template: data.template ?? data.tmpl ?? "classic",
    lang:     data.lang     ?? "en",
  }

  const simpleKeys = ["name","role","email","phone","location","linkedin","github","summary","skills"]
  simpleKeys.forEach(key => {
    if (inputs[key] && norm[key]) inputs[key].value = norm[key]
  })
  if (inputs.profileType && norm.profileType) inputs.profileType.value = norm.profileType

  if (templateSelect && norm.template) {
    templateSelect.value = norm.template
    applyTemplate(norm.template)
  }
  if (norm.lang) applyTranslation(norm.lang)

  // Education (full key or share-link compressed key)
  const eduData  = data.education      ?? data.edu  ?? []
  const expData  = data.experience     ?? data.exp  ?? []
  const projData = data.projects       ?? data.proj ?? []
  const certData = data.certifications ?? data.cert ?? []
  const langData = data.languages      ?? data.langs ?? data.languagesData ?? []

  if (eduData.length)  eduData.forEach(item  => createEducation(item, updateAllDebounced))
  if (expData.length)  expData.forEach(item  => createExperience(item, updateAllDebounced))
  if (projData.length) projData.forEach(item => createProject(item, updateAllDebounced))
  if (certData.length) certData.forEach(item => createCertification(item, updateAllDebounced))
  if (langData.length) langData.forEach(l    => createLanguageItem(l.language, l.level, updateAllDebounced))
}

// ─── Mobile Preview Toggle ────────────────────────────────────────────────────

function initMobilePreviewToggle() {
  const toggleBtn    = $id("mobilePreviewToggle")
  const previewPanel = document.querySelector(".preview-panel")
  if (!toggleBtn || !previewPanel) return

  let previewVisible = false
  const tr = t()

  toggleBtn.addEventListener("click", () => {
    previewVisible = !previewVisible
    previewPanel.classList.toggle("preview-panel--mobile-visible", previewVisible)
    toggleBtn.textContent = previewVisible ? tr.previewToggleHide : tr.previewToggleShow
    toggleBtn.setAttribute("aria-expanded", String(previewVisible))

    if (previewVisible) {
      // Scroll preview into view smoothly
      previewPanel.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  })
}

// ─── Escape Key Handler ───────────────────────────────────────────────────────
// Single unified handler — no duplicate listeners.

document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return
  const aiPanel    = $id("aiPanel")
  const shareModal = $id("shareModal")
  // Confirm dialog handles its own Escape key internally — no need to handle it here
  if (aiPanel?.classList.contains("open"))          { closeAIPanel(); return }
  if (!shareModal?.classList.contains("hidden"))     { $id("shareCloseBtn")?.click(); return }
})

// ─── Onboarding AI Helper ─────────────────────────────────────────────────────

async function handleOnboardingAI(data) {
  const { name, role, profileType, lang } = data

  // Fill basic fields immediately
  if (inputs.name && name) inputs.name.value = name
  if (inputs.role && role) inputs.role.value = role
  if (inputs.profileType) inputs.profileType.value = profileType

  applyTranslation(lang)
  showToast(lang === "ar" ? "جاري إنشاء محتوى بالذكاء الاصطناعي..." : "AI is generating your starter content...", "info", 4000)

  try {
    const res = await fetch("/api/generate-onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lang,
        onboardingData: { name, role, profileType },
      }),
    })

    if (!res.ok) throw new Error("API error")
    const result = await res.json()

    // Fill in AI-generated content
    if (inputs.summary && result.summary) inputs.summary.value = result.summary
    if (inputs.skills && result.skills) inputs.skills.value = result.skills

    const onCardChange = () => { updateAllDebounced(); scheduleAutosave() }

    if (result.experience?.length) {
      result.experience.forEach(exp => {
        createExperience({
          title: exp.title || "",
          company: exp.company || "",
          desc: exp.desc || "",
        }, onCardChange)
      })
    }

    if (result.education?.length) {
      result.education.forEach(edu => {
        createEducation({
          degree: edu.degree || "",
          university: edu.university || "",
        }, onCardChange)
      })
    }

    // Seed default languages
    createLanguageItem("Arabic",  "Native",       onCardChange)
    createLanguageItem("English", "Intermediate", onCardChange)

    updateAll()
    scheduleAutosave()
    showToast(lang === "ar" ? "تم إنشاء سيرتك الأولية! عدّل البيانات حسب رغبتك" : "Your starter resume is ready! Edit the details to match your experience.", "success", 5000)

  } catch (err) {
    console.error("[Onboarding AI]", err)
    // Fallback — just seed languages
    createLanguageItem("Arabic",  "Native",       () => { updateAllDebounced(); scheduleAutosave() })
    createLanguageItem("English", "Intermediate", () => { updateAllDebounced(); scheduleAutosave() })
    updateAll()
    showToast(t().toastAnalysisError, "error")
  }
}

function handleOnboardingScratch(data) {
  const { name, role, profileType, lang } = data

  if (inputs.name && name) inputs.name.value = name
  if (inputs.role && role) inputs.role.value = role
  if (inputs.profileType) inputs.profileType.value = profileType

  applyTranslation(lang)

  // Seed default languages
  const onCardChange = () => { updateAllDebounced(); scheduleAutosave() }
  createLanguageItem("Arabic",  "Native",       onCardChange)
  createLanguageItem("English", "Intermediate", onCardChange)

  updateAll()
  scheduleAutosave()
  showToast(lang === "ar" ? "مرحباً! ابدأ بملء بياناتك" : "Welcome! Start filling in your details.", "success")
}

// ─── Application Bootstrap ────────────────────────────────────────────────────

function init() {
  // 1. Try loading from a share link first
  const shared = decodeShareLink()
  if (shared) {
    restoreState(shared)
    showToast(t().toastSharedLoaded, "success")
  } else {
    // 2. Restore from localStorage
    const saved = loadData()
    if (saved) {
      restoreState(saved)
    } else if (!hasCompletedOnboarding()) {
      // 3. First visit — show onboarding wizard
      initOnboarding({
        onComplete(data) {
          if (data.useAI) {
            handleOnboardingAI(data)
          } else {
            handleOnboardingScratch(data)
          }
        },
      })
    } else {
      // 4. Onboarded before but cleared data — seed defaults
      createLanguageItem("Arabic",  "Native",       updateAllDebounced)
      createLanguageItem("English", "Intermediate", updateAllDebounced)
    }
  }

  // 5. Initial render
  updateAll()

  // 5. Wire static input listeners
  Object.values(inputs).forEach(input => {
    input?.addEventListener("input", () => {
      updateAllDebounced()
      scheduleAutosave()
    })
  })

  // 6. Section add buttons
  // Wrapper that triggers both preview update and autosave on card changes
  const onCardChange = () => { updateAllDebounced(); scheduleAutosave() }
  $id("addEducationBtn")?.addEventListener("click",    () => { createEducation({},    onCardChange); onCardChange() })
  $id("addExperienceBtn")?.addEventListener("click",   () => { createExperience({},   onCardChange); onCardChange() })
  $id("addProjectBtn")?.addEventListener("click",      () => { createProject({},      onCardChange); onCardChange() })
  $id("addCertificationBtn")?.addEventListener("click",() => { createCertification({},onCardChange); onCardChange() })
  $id("addLanguageBtn")?.addEventListener("click",     () => { createLanguageItem(undefined, undefined, onCardChange); onCardChange() })

  // 7. Template switcher
  templateSelect?.addEventListener("change", () => {
    applyTemplate(templateSelect.value)
    scheduleAutosave()
  })

  // 8. Language buttons
  $all(".lang-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      applyTranslation(btn.dataset.lang)
      updateAll()
      scheduleAutosave()
    })
  })

  // 9. Action buttons
  $id("saveBtn")?.addEventListener("click", () => {
    saveData(getState())
    showToast(t().toastSaved, "success")
  })

  $id("clearBtn")?.addEventListener("click", async () => {
    const tr = t()
    const confirmed = await showConfirm({
      title:        tr.confirmClearTitle,
      body:         tr.confirmClearBody,
      confirmLabel: tr.confirmClearYes,
      cancelLabel:  tr.confirmClearNo,
      variant:      "danger",
    })
    if (confirmed) {
      clearData()
      // Programmatic reset — no location.reload()
      Object.values(inputs).forEach(input => {
        if (input) input.value = ""
      })
      if (inputs.profileType) inputs.profileType.value = "experienced"
      if (templateSelect) {
        templateSelect.value = "classic"
        applyTemplate("classic")
      }
      // Clear all dynamic card containers
      ;["educationContainer","experienceContainer","projectsContainer",
        "certificationsContainer","languagesContainer"
      ].forEach(id => { const el = $id(id); if (el) el.innerHTML = "" })
      updateAll()
      showToast(tr.toastCleared, "info")
    }
  })

  $id("sampleBtn")?.addEventListener("click", () => {
    // Set simple fields
    if (inputs.name)     inputs.name.value     = "Nasser Al-Tamimi"
    if (inputs.role)     inputs.role.value     = "Full-Stack Software Engineer"
    if (inputs.email)    inputs.email.value    = "nasser@example.com"
    if (inputs.phone)    inputs.phone.value    = "+966 50 123 4567"
    if (inputs.location) inputs.location.value = "Riyadh, Saudi Arabia"
    if (inputs.linkedin) inputs.linkedin.value = "linkedin.com/in/nasser-altamimi"
    if (inputs.github)   inputs.github.value   = "github.com/nasser-dev"
    if (inputs.summary)  inputs.summary.value  = "Results-driven Full-Stack Engineer with 4+ years of experience building scalable web applications. Proficient in React, Node.js, and cloud technologies."
    if (inputs.skills)   inputs.skills.value   = "JavaScript, TypeScript, React, Next.js, Node.js, Express, Python, PostgreSQL, MongoDB, Docker, AWS, Git, REST APIs, GraphQL"
    if (inputs.profileType) inputs.profileType.value = "experienced"

    loadSampleCards(updateAllDebounced)
    updateAll()
    showToast(t().toastSampleLoaded, "info")
  })

  // 10. PDF export
  $id("pdfBtn")?.addEventListener("click", async () => {
    const tr = t()
    showToast(tr.toastPdf, "info", 4000)
    try {
      const filename = `CreateCV-${inputs.name?.value || "Resume"}.pdf`
      await exportPDF(resumePreview, filename)
      showToast(tr.toastPdfSuccess, "success")
    } catch (err) {
      console.error("[PDF]", err)
      const msg = err.message?.includes("load") ? tr.toastPdfLibError : tr.toastPdfError
      showToast(msg, "error")
    }
  })

  // 11. AI panel
  initAIPanel()

  // Wire up the re-analyze event from ai.js result panel
  $id("aiResult")?.addEventListener("reanalyze", () => {
    analyzeResume(getState())
  })
  $id("aiAnalyzeBtn")?.addEventListener("click", () => {
    analyzeResume(getState())
  })

  // 12. Share feature
  initShare(getState)

  // 13. Mobile preview toggle
  initMobilePreviewToggle()
}

// Boot when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}