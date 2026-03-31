/**
 * pdf.js — PDF Export Module
 *
 * Lazily loads html2pdf.js only when the user requests a PDF export.
 * Uses html2canvas onclone callback to style the internal clone,
 * avoiding manual cloning issues (blank pages, positioning bugs).
 *
 * Font: Calibri (ATS standard) with Arial/Helvetica fallback.
 * Output: A4 portrait, single page, sharp text, no blank pages.
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

// A4 dimensions in mm
const A4_W = 210
const A4_H = 297

// A4 width in pixels at 96 DPI (210mm ≈ 794px)
const A4_PX = 794

/**
 * Exports the resume preview as a PDF.
 *
 * Strategy:
 * - Pass the ORIGINAL #resumePreview element to html2pdf
 * - Use onclone to apply PDF-safe styles on html2canvas's internal clone
 * - This ensures the clone inherits all CSS class styles (template, tags, etc.)
 * - No manual cloneNode — avoids blank PDF issues
 * - Use pagebreak: { mode: "avoid-all" } to force single-page output
 *
 * @param {HTMLElement} resumePreviewEl — the #resumePreview element
 * @param {string} filename — e.g. "John-Smith.pdf"
 * @returns {Promise<void>}
 */
export async function exportPDF(resumePreviewEl, filename = "CreateCV-Resume.pdf") {
  await loadHtml2Pdf()

  const options = {
    margin:      0,
    filename,
    image:       { type: "jpeg", quality: 0.98 },
    pagebreak:   { mode: ["avoid-all"] },
    html2canvas: {
      scale:           3,
      useCORS:         true,
      letterRendering: true,
      logging:         false,
      allowTaint:      true,
      backgroundColor: "#ffffff",
      windowWidth:     A4_PX,
      width:           A4_PX,
      scrollX:         0,
      scrollY:         0,
      onclone: (clonedDoc) => {
        const el = clonedDoc.getElementById("resumePreview")
        if (!el) return

        // Remove empty sections from the PDF
        el.querySelectorAll(".empty-section").forEach(s => s.remove())

        // Force preview-panel visible — windowWidth (794px) triggers
        // the ≤1200px media query which sets .preview-panel to display:none
        const panel = el.closest(".preview-panel")
        if (panel) {
          Object.assign(panel.style, {
            display:  "block",
            width:    A4_PX + "px",
            padding:  "0",
            margin:   "0",
            overflow: "visible",
          })
        }

        // Ensure the preview-shell parent doesn't constrain width
        const shell = el.closest(".preview-shell")
        if (shell) {
          Object.assign(shell.style, {
            padding:    "0",
            margin:     "0",
            background: "#ffffff",
            overflow:   "visible",
            width:      A4_PX + "px",
          })
        }

        // Force PDF-safe styles on the resume paper clone
        // box-sizing: border-box means width INCLUDES padding
        Object.assign(el.style, {
          boxSizing:    "border-box",
          width:        A4_PX + "px",
          maxWidth:     A4_PX + "px",
          minHeight:    "auto",
          padding:      "18mm 18mm 16mm",
          margin:       "0",
          background:   "#ffffff",
          color:        "#111827",
          fontFamily:   "Calibri, Arial, Helvetica, sans-serif",
          fontSize:     "11pt",
          lineHeight:   "1.45",
          boxShadow:    "none",
          borderRadius: "0",
          overflow:     "visible",
          position:     "relative",
        })

        // Reset body/html in clone to prevent any scroll offset
        clonedDoc.documentElement.style.overflow = "visible"
        clonedDoc.body.style.overflow = "visible"
        clonedDoc.body.style.margin = "0"
        clonedDoc.body.style.padding = "0"
      },
    },
    jsPDF: {
      unit:        "mm",
      format:      "a4",
      orientation: "portrait",
      compress:    true,
    },
  }

  await window.html2pdf().set(options).from(resumePreviewEl).save()
}
