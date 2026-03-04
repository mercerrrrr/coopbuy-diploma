import { rgb } from "pdf-lib";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_TOP = 40;
const MARGIN_BOTTOM = 50;

/**
 * Ensures there is enough vertical space on the current page.
 * If `y - needed < MARGIN_BOTTOM`, adds a new page and resets y.
 * @returns {{ page, y }}
 */
export function ensurePage(pdf, page, y, needed = 30) {
  if (y - needed < MARGIN_BOTTOM) {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN_TOP;
  }
  return { page, y };
}

/**
 * Draws a single line of text and advances y.
 * @returns {number} new y
 */
export function drawLine(page, font, text, x, y, size, color = rgb(0, 0, 0)) {
  page.drawText(String(text ?? ""), { x, y, size, font, color });
  return y - size * 1.6;
}

/**
 * Draws a centred line of text and advances y.
 * @returns {number} new y
 */
export function drawLineCenter(page, font, text, y, size, pageW = PAGE_W, color = rgb(0, 0, 0)) {
  const s = String(text ?? "");
  const tw = font.widthOfTextAtSize(s, size);
  page.drawText(s, { x: (pageW - tw) / 2, y, size, font, color });
  return y - size * 1.6;
}

/**
 * Draws a right-aligned line of text and advances y.
 * @returns {number} new y
 */
export function drawLineRight(page, font, text, y, size, rightX = 555, color = rgb(0, 0, 0)) {
  const s = String(text ?? "");
  const tw = font.widthOfTextAtSize(s, size);
  page.drawText(s, { x: rightX - tw, y, size, font, color });
  return y - size * 1.6;
}

/**
 * Draws a horizontal rule line (no y advance — caller must add gap).
 */
export function drawHRule(page, y, leftX = 40, rightX = 555, color = rgb(0.73, 0.73, 0.73)) {
  page.drawLine({ start: { x: leftX, y }, end: { x: rightX, y }, thickness: 0.5, color });
}

/**
 * Draws a paragraph that wraps at maxWidth.
 * Each line uses the provided lineHeight (default = size * 1.4).
 * @returns {{ page, y }} — updated page (may have added page) and new y
 */
export function drawParagraph(pdf, page, font, text, x, y, size, maxWidth, lineHeight, color = rgb(0, 0, 0)) {
  const lh = lineHeight ?? size * 1.4;
  const words = String(text ?? "").split(" ");
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      currentLine = candidate;
    } else {
      // flush current line
      const r = ensurePage(pdf, page, y, lh);
      page = r.page; y = r.y;
      page.drawText(currentLine, { x, y, size, font, color });
      y -= lh;
      currentLine = word;
    }
  }
  if (currentLine) {
    const r = ensurePage(pdf, page, y, lh);
    page = r.page; y = r.y;
    page.drawText(currentLine, { x, y, size, font, color });
    y -= lh;
  }
  return { page, y };
}
