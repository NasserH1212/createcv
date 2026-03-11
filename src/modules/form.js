/**
 * form.js — Dynamic form section management
 *
 * Handles creation, removal, and data collection for all dynamic card sections:
 * Education, Experience, Projects, Certifications, Languages.
 *
 * Key improvement over original:
 * - Each input has a `data-field` attribute — NO more fragile index-based access.
 * - Each label has a matching `for` attribute linked to a unique input ID.
 * - "Currently here" checkboxes for Experience and Education.
 * - Fully accessible: label/input associations, keyboard removable.
 */

"use strict"

import { escapeHtml, uid, $all } from "../../utils.js"
import { t, currentLang }        from "./I18n.js"

// ─── Language option lists ────────────────────────────────────────────────────

const LANGUAGE_OPTIONS = [
  "Arabic","English","French","Spanish","German","Italian","Portuguese",
  "Russian","Turkish","Chinese","Japanese","Korean","Hindi","Urdu","Bengali",
  "Malay","Indonesian","Persian","Dutch","Swedish","Polish","Greek","Hebrew",
  "Thai","Vietnamese","Tamil","Punjabi","Ukrainian","Romanian","Czech",
  "Hungarian","Danish","Norwegian","Finnish","Other",
]
const LEVEL_OPTIONS = ["Native", "Fluent", "Advanced", "Intermediate", "Basic"]

// ─── Container references ─────────────────────────────────────────────────────

const containers = {
  education:      () => document.getElementById("educationContainer"),
  experience:     () => document.getElementById("experienceContainer"),
  projects:       () => document.getElementById("projectsContainer"),
  certifications: () => document.getElementById("certificationsContainer"),
  languages:      () => document.getElementById("languagesContainer"),
}

// ─── Internal card builder ────────────────────────────────────────────────────

/**
 * Creates a card shell <div> with standard header (label + remove button).
 * @param {string} type — used as data-type
 * @param {string} cardTitle
 * @returns {HTMLDivElement}
 */
function makeCard(type, cardTitle) {
  const tr   = t()
  const card = document.createElement("div")
  card.className  = "item-card"
  card.dataset.type = type

  const header = document.createElement("div")
  header.className = "item-top"

  const titleEl = document.createElement("strong")
  titleEl.textContent = cardTitle

  const removeBtn = document.createElement("button")
  removeBtn.type      = "button"
  removeBtn.className = "remove-btn"
  removeBtn.textContent = tr.removeLabel
  removeBtn.setAttribute("aria-label", `${tr.removeLabel} ${cardTitle}`)

  header.append(titleEl, removeBtn)
  card.appendChild(header)
  return card
}

/**
 * Creates an accessible field (label + input pair) inside a container.
 * @param {string} labelText
 * @param {object} inputAttrs — attributes to set on the input element
 * @param {string} fieldName — value for data-field attribute
 * @returns {{ wrapper: HTMLDivElement, input: HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement }}
 */
function makeField(labelText, inputAttrs, fieldName, tag = "input") {
  const inputId  = `field-${uid()}`
  const wrapper  = document.createElement("div")
  wrapper.className = "field"

  const label    = document.createElement("label")
  label.htmlFor  = inputId
  label.setAttribute("data-label", fieldName + "Label")
  label.textContent = labelText

  const input    = document.createElement(tag)
  input.id       = inputId
  input.dataset.field = fieldName
  Object.entries(inputAttrs).forEach(([k, v]) => {
    if (k === "className") { input.className = v; return }
    if (k === "value") { input.value = v; return }
    input.setAttribute(k, v)
  })

  wrapper.append(label, input)
  return { wrapper, input }
}

/**
 * Makes a two-column grid wrapper.
 * @returns {HTMLDivElement}
 */
function makeGrid() {
  const grid = document.createElement("div")
  grid.className = "form-grid two"
  return grid
}

/**
 * Builds a "Currently here" checkbox field.
 * @param {string} labelText
 * @param {HTMLInputElement} endInput — the end date input it controls
 * @param {boolean} [checked]
 * @returns {HTMLDivElement}
 */
function makeCurrentCheckbox(labelText, endInput, checked = false) {
  const id      = `chk-${uid()}`
  const wrapper = document.createElement("div")
  wrapper.className = "field field--checkbox"

  const chk     = document.createElement("input")
  chk.type      = "checkbox"
  chk.id        = id
  chk.dataset.field = "current"
  chk.checked   = checked

  const lbl     = document.createElement("label")
  lbl.htmlFor   = id
  lbl.textContent = labelText

  // Toggle end input
  const toggle = () => {
    endInput.disabled    = chk.checked
    endInput.placeholder = chk.checked ? "Present" : ""
    if (chk.checked) endInput.value = ""
  }
  chk.addEventListener("change", toggle)
  toggle() // apply initial state

  wrapper.append(chk, lbl)
  return wrapper
}

// ─── Education ───────────────────────────────────────────────────────────────

export function createEducation(data = {}, onUpdate) {
  const tr   = t()
  const card = makeCard("education", tr.educationCardTitle)

  const { wrapper: degreeW, input: degreeIn }       = makeField(tr.degreeLabel,     { type:"text", value: data.degree      || "", placeholder:"B.Sc. Computer Science" },    "degree")
  const { wrapper: uniW,    input: uniIn }           = makeField(tr.universityLabel, { type:"text", value: data.university  || "", placeholder:"King Abdulaziz University" }, "university")
  const { wrapper: startW,  input: startIn }         = makeField(tr.startLabel,      { type:"text", value: data.start       || "", placeholder:"2020" },                      "start")
  const { wrapper: endW,    input: endIn }           = makeField(tr.endLabel,        { type:"text", value: data.end         || "", placeholder:"2024" },                      "end")
  const { wrapper: gpaW,    input: gpaIn }           = makeField(tr.gpaLabel,        { type:"text", value: data.gpa         || "", placeholder:"4.5 / 5.0" },                 "gpa")

  const isCurrent = data.current === true || data.end === "Present"
  const currentChk = makeCurrentCheckbox(tr.currentLabel, endIn, isCurrent)

  const topGrid = makeGrid()
  topGrid.append(degreeW, uniW, startW, endW)
  card.append(topGrid, currentChk, gpaW)

  // Remove handler
  card.querySelector(".remove-btn").addEventListener("click", () => {
    card.remove()
    onUpdate?.()
  })

  // Change handlers
  card.querySelectorAll("input").forEach(i => i.addEventListener("input", () => onUpdate?.()))
  card.querySelectorAll("input[type='checkbox']").forEach(i => i.addEventListener("change", () => onUpdate?.()))

  containers.education().appendChild(card)
}

// ─── Experience ───────────────────────────────────────────────────────────────

export function createExperience(data = {}, onUpdate) {
  const tr   = t()
  const card = makeCard("experience", tr.experienceCardTitle)

  const { wrapper: titleW,   input: titleIn }   = makeField(tr.jobTitleLabel, { type:"text", value: data.title   || "", placeholder:"Frontend Developer" }, "title")
  const { wrapper: companyW, input: companyIn } = makeField(tr.companyLabel,  { type:"text", value: data.company || "", placeholder:"Acme Corp" },          "company")
  const { wrapper: startW,   input: startIn }   = makeField(tr.startLabel,    { type:"text", value: data.start   || "", placeholder:"Jan 2022" },           "start")
  const { wrapper: endW,     input: endIn }     = makeField(tr.endLabel,      { type:"text", value: data.end     || "", placeholder:"Present" },            "end")

  const { wrapper: descW, input: descIn } = makeField(tr.descLabel, {
    className: "",
    value: data.desc || "",
    placeholder: "• Developed React dashboard for 2M+ users\n• Reduced load time by 40% with code splitting",
    rows: "4",
  }, "desc", "textarea")

  const isCurrent  = data.current === true || data.end === "Present"
  const currentChk = makeCurrentCheckbox(tr.currentJobLabel, endIn, isCurrent)

  const topGrid = makeGrid()
  topGrid.append(titleW, companyW, startW, endW)
  card.append(topGrid, currentChk, descW)

  card.querySelector(".remove-btn").addEventListener("click", () => {
    card.remove()
    onUpdate?.()
  })

  card.querySelectorAll("input, textarea").forEach(i => i.addEventListener("input", () => onUpdate?.()))
  card.querySelectorAll("input[type='checkbox']").forEach(i => i.addEventListener("change", () => onUpdate?.()))

  containers.experience().appendChild(card)
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export function createProject(data = {}, onUpdate) {
  const tr   = t()
  const card = makeCard("project", tr.projectCardTitle)

  const { wrapper: nameW } = makeField(tr.projectNameLabel, {
    type:"text", value: data.name || "", placeholder:"E-Commerce App"
  }, "name")

  const { wrapper: urlW } = makeField(tr.projectUrlLabel, {
    type:"url", value: data.url || "", placeholder:"https://github.com/..."
  }, "url")

  const { wrapper: descW } = makeField(tr.descLabel, {
    value: data.desc || "",
    placeholder: "Built with React, Node.js and MongoDB. Includes auth, cart, and payment.",
    rows: "3",
  }, "desc", "textarea")

  card.append(nameW, urlW, descW)

  card.querySelector(".remove-btn").addEventListener("click", () => {
    card.remove()
    onUpdate?.()
  })

  card.querySelectorAll("input, textarea").forEach(i => i.addEventListener("input", () => onUpdate?.()))
  containers.projects().appendChild(card)
}

// ─── Certifications ───────────────────────────────────────────────────────────

export function createCertification(data = {}, onUpdate) {
  const tr   = t()
  const card = makeCard("certification", tr.certCardTitle)

  const { wrapper: nameW }   = makeField(tr.certNameLabel, { type:"text", value: data.name   || "", placeholder:"AWS Solutions Architect" }, "name")
  const { wrapper: issuerW } = makeField(tr.issuerLabel,   { type:"text", value: data.issuer || "", placeholder:"Amazon Web Services" },      "issuer")
  const { wrapper: dateW }   = makeField(tr.dateLabel,     { type:"text", value: data.date   || "", placeholder:"Mar 2024" },                 "date")

  const grid = makeGrid()
  grid.append(nameW, issuerW)
  card.append(grid, dateW)

  card.querySelector(".remove-btn").addEventListener("click", () => {
    card.remove()
    onUpdate?.()
  })

  card.querySelectorAll("input").forEach(i => i.addEventListener("input", () => onUpdate?.()))
  containers.certifications().appendChild(card)
}

// ─── Languages ────────────────────────────────────────────────────────────────

export function createLanguageItem(selectedLanguage = "English", selectedLevel = "Intermediate", onUpdate) {
  const tr   = t()
  const card = document.createElement("div")
  card.className  = "item-card language-item"
  card.dataset.type = "language"

  const header   = document.createElement("div")
  header.className = "item-top"
  const title    = document.createElement("strong")
  title.textContent = tr.languageCardTitle
  const removeBtn = document.createElement("button")
  removeBtn.type = "button"
  removeBtn.className = "remove-btn"
  removeBtn.textContent = tr.removeLabel
  removeBtn.setAttribute("aria-label", `${tr.removeLabel} ${tr.languageCardTitle}`)
  header.append(title, removeBtn)

  // Language select
  const langId  = `lang-${uid()}`
  const langLbl = document.createElement("label")
  langLbl.htmlFor = langId
  langLbl.textContent = tr.languageLabel
  const langSel = document.createElement("select")
  langSel.id = langId
  langSel.dataset.field = "language"
  langSel.className = "language-name"
  LANGUAGE_OPTIONS.forEach(lang => {
    const opt = document.createElement("option")
    opt.value = lang
    opt.textContent = lang
    if (lang === selectedLanguage) opt.selected = true
    langSel.appendChild(opt)
  })

  // Level select
  const levelId  = `level-${uid()}`
  const levelLbl = document.createElement("label")
  levelLbl.htmlFor = levelId
  levelLbl.textContent = tr.levelLabel
  const levelSel = document.createElement("select")
  levelSel.id = levelId
  levelSel.dataset.field = "level"
  levelSel.className = "language-level"
  LEVEL_OPTIONS.forEach(level => {
    const opt = document.createElement("option")
    opt.value = level
    opt.textContent = level
    if (level === selectedLevel) opt.selected = true
    levelSel.appendChild(opt)
  })

  const grid = makeGrid()

  const langField  = document.createElement("div")
  langField.className = "field"
  langField.append(langLbl, langSel)

  const levelField = document.createElement("div")
  levelField.className = "field"
  levelField.append(levelLbl, levelSel)

  grid.append(langField, levelField)
  card.append(header, grid)

  removeBtn.addEventListener("click", () => { card.remove(); onUpdate?.() })
  langSel.addEventListener("change",  () => onUpdate?.())
  levelSel.addEventListener("change", () => onUpdate?.())

  containers.languages().appendChild(card)
}

// ─── Data Collectors ──────────────────────────────────────────────────────────
// All use data-field named selectors — never positional index access.

/**
 * Generic field reader from a card using data-field attributes.
 * @param {HTMLElement} card
 * @param {string[]} fields
 * @returns {object}
 */
function readFields(card, fields) {
  const obj = {}
  fields.forEach(f => {
    const el = card.querySelector(`[data-field="${f}"]`)
    if (el) obj[f] = el.type === "checkbox" ? el.checked : el.value || ""
  })
  return obj
}

export function getEducationData() {
  return $all(".item-card[data-type='education']", document).map(card =>
    readFields(card, ["degree", "university", "start", "end", "gpa", "current"])
  )
}

export function getExperienceData() {
  return $all(".item-card[data-type='experience']", document).map(card =>
    readFields(card, ["title", "company", "start", "end", "desc", "current"])
  )
}

export function getProjectsData() {
  return $all(".item-card[data-type='project']", document).map(card =>
    readFields(card, ["name", "url", "desc"])
  )
}

export function getCertificationsData() {
  return $all(".item-card[data-type='certification']", document).map(card =>
    readFields(card, ["name", "issuer", "date"])
  )
}

export function getLanguagesData() {
  return $all(".item-card[data-type='language']", document).map(card =>
    readFields(card, ["language", "level"])
  )
}

// ─── Label Rebuild (on language switch) ──────────────────────────────────────

/**
 * Updates all dynamic card labels and buttons when the UI language changes.
 * Uses data-label and data-type attributes — no hard-coded text in HTML.
 */
export function rebuildDynamicLabels() {
  const tr = t()

  const typeToTitle = {
    education:     tr.educationCardTitle,
    experience:    tr.experienceCardTitle,
    project:       tr.projectCardTitle,
    certification: tr.certCardTitle,
    language:      tr.languageCardTitle,
  }

  $all(".item-card").forEach(card => {
    const type = card.dataset.type
    const titleEl = card.querySelector(".item-top strong")
    if (titleEl && typeToTitle[type]) titleEl.textContent = typeToTitle[type]

    // Update labeled fields
    card.querySelectorAll("[data-label]").forEach(el => {
      const key = el.dataset.label
      if (tr[key]) el.textContent = tr[key]
    })

    // Update remove buttons
    card.querySelectorAll(".remove-btn").forEach(btn => {
      btn.textContent = tr.removeLabel
    })

    // Update current checkboxes
    card.querySelectorAll("[data-field='current']").forEach(chk => {
      const lbl = chk.nextElementSibling
      if (lbl) lbl.textContent = type === "experience" ? tr.currentJobLabel : tr.currentLabel
    })
  })
}

// ─── Sample Data ──────────────────────────────────────────────────────────────

/**
 * Clears all dynamic containers and loads sample data.
 * @param {Function} onUpdate
 */
export function loadSampleCards(onUpdate) {
  Object.values(containers).forEach(getEl => {
    const el = getEl()
    if (el) el.innerHTML = ""
  })

  createEducation({
    degree: "B.Sc. Computer Science", university: "King Abdulaziz University",
    start: "2016", end: "2020", gpa: "4.7 / 5.0",
  }, onUpdate)

  createExperience({
    title: "Senior Frontend Developer", company: "STC Pay",
    start: "Jan 2022", end: "Present", current: true,
    desc: "• Led development of React-based dashboard serving 2M+ users\n• Reduced page load time by 40% through code splitting and caching\n• Mentored a team of 4 junior developers",
  }, onUpdate)

  createExperience({
    title: "Full-Stack Developer", company: "Elm Company",
    start: "Jul 2020", end: "Dec 2021",
    desc: "• Built RESTful APIs with Node.js handling 10k+ daily requests\n• Integrated third-party payment gateways (Mada, SADAD)\n• Improved test coverage from 30% to 85%",
  }, onUpdate)

  createProject({
    name: "E-Commerce Platform",
    url:  "https://github.com/nasser-dev/ecommerce",
    desc: "Full-stack marketplace built with Next.js, Node.js, MongoDB and Stripe. Features real-time inventory, multi-vendor support, and Arabic localization.",
  }, onUpdate)

  createProject({
    name: "AI Resume Analyzer",
    desc: "Chrome extension that analyzes job descriptions and highlights skill gaps in uploaded CVs using NLP and keyword matching.",
  }, onUpdate)

  createCertification({ name: "AWS Certified Solutions Architect", issuer: "Amazon Web Services", date: "Mar 2023" }, onUpdate)
  createCertification({ name: "Meta Frontend Developer Certificate", issuer: "Meta / Coursera",   date: "Sep 2022" }, onUpdate)

  createLanguageItem("Arabic",  "Native",       onUpdate)
  createLanguageItem("English", "Fluent",        onUpdate)
}