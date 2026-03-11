/**
 * preview.js — Live Resume Preview Renderer
 *
 * Reads collected data and updates the resume preview DOM.
 * Completely decoupled from form logic — only knows about preview elements.
 * All user content goes through escapeHtml() before touching innerHTML.
 */

"use strict"

import { escapeHtml, splitComma, $id } from "./Utils.js"
import { currentLang }                  from "./I18n.js"

// ─── Preview element references ───────────────────────────────────────────────
// Cached once — these elements never change between renders.

const pv = {
  name:           () => $id("cvName"),
  role:           () => $id("cvRole"),
  contact:        () => $id("cvContact"),
  summary:        () => $id("cvSummary"),
  skills:         () => $id("cvSkills"),
  languages:      () => $id("cvLanguages"),
  education:      () => $id("cvEducation"),
  experience:     () => $id("cvExperience"),
  projects:       () => $id("cvProjects"),
  certifications: () => $id("cvCertifications"),
}

// ─── Section visibility ───────────────────────────────────────────────────────

function showSection(sectionId) {
  $id(sectionId)?.classList.remove("empty-section")
}
function hideSection(sectionId) {
  $id(sectionId)?.classList.add("empty-section")
}

// ─── Resume item builder ──────────────────────────────────────────────────────

/**
 * Creates a standard resume item element with a head row and optional description.
 */
function makeResumeItem({ titleLine, subLine, dateText, desc }) {
  const div = document.createElement("div")
  div.className = "resume-item"

  const head = document.createElement("div")
  head.className = "resume-item-head"

  const left = document.createElement("div")

  if (titleLine) {
    const t = document.createElement("div")
    t.className   = "resume-item-title"
    t.textContent = titleLine
    left.appendChild(t)
  }
  if (subLine) {
    const s = document.createElement("div")
    s.className   = "resume-item-sub"
    s.textContent = subLine
    left.appendChild(s)
  }
  head.appendChild(left)

  if (dateText) {
    const d = document.createElement("div")
    d.className   = "resume-item-date"
    d.textContent = dateText
    head.appendChild(d)
  }

  div.appendChild(head)

  if (desc) {
    const p = document.createElement("div")
    p.className = "resume-item-desc"
    // Preserve newlines from textarea — convert \n to <br>
    // escapeHtml first, then restore linebreaks safely
    p.innerHTML = escapeHtml(desc).replace(/\n/g, "<br>")
    div.appendChild(p)
  }

  return div
}

// ─── Section renderers ────────────────────────────────────────────────────────

export function renderEducationPreview(data) {
  const container = pv.education()
  if (!container) return
  container.innerHTML = ""

  const valid = data.filter(e => e.degree || e.university)
  if (!valid.length) { hideSection("educationSection"); return }
  showSection("educationSection")

  valid.forEach(item => {
    const endText = item.current ? "Present" : item.end
    const date    = [item.start, endText].filter(Boolean).join(" – ")
    container.appendChild(makeResumeItem({
      titleLine: item.degree,
      subLine:   item.university,
      dateText:  date,
      desc:      item.gpa ? `GPA: ${item.gpa}` : "",
    }))
  })
}

export function renderExperiencePreview(data) {
  const container = pv.experience()
  if (!container) return
  container.innerHTML = ""

  const valid = data.filter(e => e.title || e.company)
  if (!valid.length) { hideSection("experienceSection"); return }
  showSection("experienceSection")

  valid.forEach(item => {
    const endText = item.current ? "Present" : item.end
    const date    = [item.start, endText].filter(Boolean).join(" – ")
    container.appendChild(makeResumeItem({
      titleLine: item.title,
      subLine:   item.company,
      dateText:  date,
      desc:      item.desc,
    }))
  })
}

export function renderProjectsPreview(data) {
  const container = pv.projects()
  if (!container) return
  container.innerHTML = ""

  const valid = data.filter(p => p.name)
  if (!valid.length) { hideSection("projectsSection"); return }
  showSection("projectsSection")

  valid.forEach(item => {
    const div = document.createElement("div")
    div.className = "resume-item"

    const title = document.createElement("div")
    title.className = "resume-item-title"

    if (item.url) {
      const a = document.createElement("a")
      a.href   = escapeHtml(item.url)
      a.target = "_blank"
      a.rel    = "noopener noreferrer"
      a.textContent = item.name
      title.appendChild(a)
    } else {
      title.textContent = item.name
    }
    div.appendChild(title)

    if (item.desc) {
      const desc = document.createElement("div")
      desc.className = "resume-item-desc"
      desc.innerHTML = escapeHtml(item.desc).replace(/\n/g, "<br>")
      div.appendChild(desc)
    }

    container.appendChild(div)
  })
}

export function renderCertificationsPreview(data) {
  const container = pv.certifications()
  if (!container) return
  container.innerHTML = ""

  const valid = data.filter(c => c.name)
  if (!valid.length) { hideSection("certificationsSection"); return }
  showSection("certificationsSection")

  valid.forEach(item => {
    container.appendChild(makeResumeItem({
      titleLine: item.name,
      subLine:   item.issuer,
      dateText:  item.date,
    }))
  })
}

export function renderTagsPreview(containerId, sectionId, list) {
  const container = $id(containerId)
  if (!container) return
  container.innerHTML = ""

  if (!list.length) { hideSection(sectionId); return }
  showSection(sectionId)

  list.forEach(item => {
    const tag = document.createElement("div")
    tag.className   = "tag"
    tag.textContent = item
    container.appendChild(tag)
  })
}

export function renderLanguagesPreview(data) {
  const container = pv.languages()
  if (!container) return
  container.innerHTML = ""

  const valid = data.filter(l => l.language)
  if (!valid.length) { hideSection("languagesSection"); return }
  showSection("languagesSection")

  valid.forEach(item => {
    const tag = document.createElement("div")
    tag.className   = "tag"
    tag.textContent = `${item.language} — ${item.level}`
    container.appendChild(tag)
  })
}

// ─── Contact row ──────────────────────────────────────────────────────────────

export function renderContact(fields) {
  const container = pv.contact()
  if (!container) return
  container.innerHTML = ""

  const items = fields.filter(Boolean)
  items.forEach((item, i) => {
    const span = document.createElement("span")
    span.className   = "cv-contact-item"
    span.textContent = item
    container.appendChild(span)

    if (i < items.length - 1) {
      const dot = document.createElement("span")
      dot.className   = "cv-contact-sep"
      dot.textContent = "•"
      dot.setAttribute("aria-hidden", "true")
      container.appendChild(dot)
    }
  })
}

// ─── Full preview update ──────────────────────────────────────────────────────

/**
 * Renders the complete live preview from collected form data.
 * @param {object} formState — the current form data snapshot
 */
export function renderFullPreview(formState) {
  const isAr = currentLang === "ar"
  const {
    name, role, email, phone, location, linkedin, github,
    summary, skills,
    education, experience, projects, certifications, languages,
  } = formState

  // Header
  const nameEl = pv.name()
  const roleEl = pv.role()
  if (nameEl) nameEl.textContent = name || (isAr ? "اسمك" : "Your Name")
  if (roleEl) roleEl.textContent = role || (isAr ? "المسمى الوظيفي" : "Target Role")

  // Contact bar
  renderContact([email, phone, location, linkedin, github])

  // Summary
  const summaryEl      = pv.summary()
  const summarySectionEl = $id("summarySection")
  if (summaryEl) {
    summaryEl.textContent = summary || (isAr ? "ملخصك المهني سيظهر هنا." : "Your professional summary will appear here.")
    // Always show summary section (even if empty, shows placeholder)
    summarySectionEl?.classList.remove("empty-section")
  }

  // Dynamic sections
  renderEducationPreview(education)
  renderExperiencePreview(experience)
  renderProjectsPreview(projects)
  renderCertificationsPreview(certifications)

  // Skills tags
  renderTagsPreview("cvSkills", "skillsSection", splitComma(skills))

  // Languages
  renderLanguagesPreview(languages)
}