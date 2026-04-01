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
 * - Force all parent containers visible and properly sized
 * - Remove min-height to prevent forced 2-page output
 * - Use avoid-all pagebreak mode for single-page output
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
      scale:           2,
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

        // ── Force ALL ancestor containers visible and properly sized ──

        // 1. Force body/html clean
        clonedDoc.documentElement.style.cssText = "margin:0;padding:0;overflow:visible;width:" + A4_PX + "px;"
        clonedDoc.body.style.cssText = "margin:0;padding:0;overflow:visible;width:" + A4_PX + "px;background:#fff;"

        // 2. Hide everything except the resume path
        //    This prevents any other element from adding height
        Array.from(clonedDoc.body.children).forEach(child => {
          if (!child.contains(el) && child !== el) {
            child.style.display = "none"
          }
        })

        // 3. Force preview-panel visible (≤1200px media query hides it)
        const panel = el.closest(".preview-panel")
        if (panel) {
          panel.style.cssText = "display:block !important;width:" + A4_PX + "px;padding:0;margin:0;overflow:visible;border:none;background:#fff;"
        }

        // 4. Force preview-shell clean
        const shell = el.closest(".preview-shell")
        if (shell) {
          shell.style.cssText = "padding:0;margin:0;background:#fff;overflow:visible;width:" + A4_PX + "px;"
        }

        // 5. Force app-layout and any grid parents to be simple block
        const layout = clonedDoc.querySelector(".app-layout")
        if (layout) {
          layout.style.cssText = "display:block;width:" + A4_PX + "px;margin:0;padding:0;overflow:visible;"
        }

        // 6. Force panel-card wrapper clean
        const panelCard = el.closest(".panel-card")
        if (panelCard) {
          panelCard.style.cssText = "display:block;width:" + A4_PX + "px;padding:0;margin:0;border:none;background:#fff;overflow:visible;"
        }

        // 7. Force sticky-card wrapper clean
        const stickyCard = el.closest(".sticky-card")
        if (stickyCard) {
          stickyCard.style.cssText = "position:static;width:" + A4_PX + "px;padding:0;margin:0;overflow:visible;"
        }

        // 8. Hide panel headers inside the preview panel
        const panelHeaders = panel ? panel.querySelectorAll(".panel-header, .panel-header--minimal") : []
        panelHeaders.forEach(h => { h.style.display = "none" })

        // ── Force PDF-safe styles on the resume paper ──
        el.style.cssText = [
          "box-sizing: border-box",
          "width: " + A4_PX + "px",
          "max-width: " + A4_PX + "px",
          "min-height: auto",          // KEY FIX: remove 297mm min-height
          "height: auto",              // Let content determine height
          "padding: 18mm 18mm 16mm",
          "margin: 0",
          "background: #ffffff",
          "color: #111827",
          "font-family: Calibri, Arial, Helvetica, sans-serif",
          "font-size: 11pt",
          "line-height: 1.45",
          "box-shadow: none",
          "border-radius: 0",
          "border: none",
          "overflow: visible",
          "position: relative",
          "float: none",
          "transform: none",
        ].join(";") + ";"
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
