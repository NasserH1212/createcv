/**
 * utils.js — Shared utility functions
 * XSS protection, debouncing, string helpers.
 */

"use strict"

/**
 * Escapes HTML special characters to prevent XSS.
 * Used whenever user-supplied text is injected into innerHTML.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return ""
  const div = document.createElement("div")
  div.textContent = String(str)
  return div.innerHTML
}

/**
 * Creates a debounced version of a function.
 * The returned function delays invoking `fn` until after `ms` milliseconds
 * have elapsed since the last time it was called.
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
export function debounce(fn, ms) {
  let timer
  return function (...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), ms)
  }
}

/**
 * Splits a comma-separated string into a trimmed array, removing empty entries.
 * @param {string} text
 * @returns {string[]}
 */
export function splitComma(text) {
  if (!text) return []
  return text.split(",").map(v => v.trim()).filter(Boolean)
}

/**
 * Returns a unique ID string, useful for generating input IDs in dynamic cards.
 * @returns {string}
 */
export function uid() {
  return Math.random().toString(36).slice(2, 9)
}

/**
 * Safely gets an element by ID, returns null without throwing if missing.
 * @param {string} id
 * @returns {HTMLElement|null}
 */
export function $id(id) {
  return document.getElementById(id)
}

/**
 * Queries a single element within a parent (defaults to document).
 * @param {string} selector
 * @param {Element} [parent]
 * @returns {Element|null}
 */
export function $qs(selector, parent = document) {
  return parent.querySelector(selector)
}

/**
 * Queries all matching elements within a parent.
 * @param {string} selector
 * @param {Element} [parent]
 * @returns {Element[]}
 */
export function $all(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector))
}