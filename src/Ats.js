/**
 * ats.js — ATS Score Calculator
 *
 * Computes a 0–100 score based on resume completeness.
 * Decoupled from UI — returns a number, doesn't touch the DOM.
 * The UI update is handled by ui.js (updateATSBar).
 */

"use strict"

import { splitComma } from "./modules/Utils.js"

/**
 * Calculates an ATS completeness score from the form state.
 * @param {object} state — the current resume data snapshot
 * @returns {number} — 0 to 100
 */
export function calculateATSScore(state) {
  let score = 0

  // Personal info (35 points)
  if (state.name?.trim())     score += 10
  if (state.role?.trim())     score += 10
  if (state.email?.trim())    score +=  7
  if (state.phone?.trim())    score +=  5
  if (state.location?.trim()) score +=  3

  // Online presence (5 points)
  if (state.linkedin?.trim()) score += 3
  if (state.github?.trim())   score += 2

  // Summary quality (12 points)
  const summaryLen = state.summary?.trim().length ?? 0
  if (summaryLen > 120) score += 12
  else if (summaryLen > 60) score += 7
  else if (summaryLen > 20) score += 3

  // Skills breadth (12 points)
  const skillCount = splitComma(state.skills ?? "").length
  if (skillCount >= 10)     score += 12
  else if (skillCount >= 6) score += 8
  else if (skillCount >= 3) score += 4

  // Education (8 points)
  const eduValid = (state.education ?? []).filter(e => e.degree || e.university)
  if (eduValid.length > 0) score += 8

  // Experience (18 points)
  const expValid = (state.experience ?? []).filter(e => e.title || e.company)
  if (expValid.length >= 2)  score += 18
  else if (expValid.length === 1) score += 10

  // Experience descriptions (5 bonus)
  const hasDescriptions = expValid.some(e => e.desc?.trim().length > 30)
  if (hasDescriptions) score += 5

  // Languages (5 points)
  if ((state.languages ?? []).length > 0) score += 5

  return Math.min(100, score)
}