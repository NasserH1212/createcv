/**
 * storage.js — LocalStorage persistence
 * Handles save, load, and clear of all resume data.
 * Isolated from UI — only deals with raw data objects.
 */

"use strict"

const STORAGE_KEY    = "createcv_data_v3"
const AUTOSAVE_DELAY = 5000 // 5 seconds — decoupled from live preview

/**
 * Serializes and saves the given data to localStorage.
 * Silently catches errors (private browsing, storage full, etc.)
 * @param {object} data
 */
export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    console.warn("[Storage] Save failed:", err.message)
  }
}

/**
 * Loads and parses data from localStorage.
 * Returns null if no data exists or parsing fails.
 * @returns {object|null}
 */
export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (err) {
    console.warn("[Storage] Load failed:", err.message)
    return null
  }
}

/**
 * Removes all CreateCV data from localStorage.
 */
export function clearData() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn("[Storage] Clear failed:", err.message)
  }
}

/**
 * Creates a debounced auto-save function.
 * Call scheduleAutosave(getData) from your form change handlers.
 * @param {Function} getDataFn — function that returns the current state object
 * @returns {Function} — debounced save trigger
 */
export function createAutosave(getDataFn) {
  let timer
  return function scheduleAutosave() {
    clearTimeout(timer)
    timer = setTimeout(() => {
      const data = getDataFn()
      saveData(data)
    }, AUTOSAVE_DELAY)
  }
}