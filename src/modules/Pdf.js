/**
 * pdf.js — PDF Export Module
 *
 * Lazily loads html2pdf.js only when the user requests a PDF export.
 * Uses a hidden clone of the resume preview for clean output,
 * removing preview-only UI elements and applying print-safe styles.
 */

"use strict"

const HTML2PDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"

/**
 * Lazily loads the html2pdf library from CDN.
 * Subsequent calls resolve immediately (singleton).
 * @returns {Promise<void>}
 */
function loadHtml2Pdf() {
  return new Promise((resolve, reject) => {
    if (window.html2pdf) { resolve(); return }

    const script    = document.createElement("script")
    script.src      = HTML2PDF_CDN
    script.async    = true
    script.onload   = () => resolve()
    script.onerror  = () => reject(new Error("Failed to load html2pdf library"))
    document.head.appendChild(script)
  })
}

/**
 * Exports the resume preview as a PDF.
 *
 * @param {HTMLElement} resumePreviewEl — the #resumePreview element
 * @param {string} filename — e.g. "John-Smith.pdf"
 * @returns {Promise<void>}
 */
export async function exportPDF(resumePreviewEl, filename = "CreateCV-Resume.pdf") {
  await loadHtml2Pdf()

  // Clone the preview so we can style it without affecting the live UI
  const clone = resumePreviewEl.cloneNode(true)

  // Remove empty/hidden sections from the PDF clone
  clone.querySelectorAll(".empty-section").forEach(el => el.remove())

  // Apply PDF-safe inline styles
  Object.assign(clone.style, {
    position:   "fixed",
    left:       "-9999px",
    top:        "0",
    width:      "210mm",
    minHeight:  "297mm",
    padding:    "22mm 18mm 20mm",
    background: "#ffffff",
    color:      "#111827",
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize:   "13px",
    lineHeight: "1.55",
    zIndex:     "-1",
  })

  document.body.appendChild(clone)

  const options = {
    margin:   0,
    filename,
    image:    { type: "jpeg", quality: 0.97 },
    html2canvas: {
      scale:          2,
      useCORS:        true,
      letterRendering:true,
      logging:        false,
      allowTaint:     true,
      backgroundColor:"#ffffff",
      windowWidth:    794,
    },
    jsPDF: {
      unit:        "mm",
      format:      "a4",
      orientation: "portrait",
      compress:    true,
    },
  }

  try {
    await window.html2pdf().set(options).from(clone).save()
  } finally {
    // Always clean up the clone, even on failure
    document.body.removeChild(clone)
  }
}