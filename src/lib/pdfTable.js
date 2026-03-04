import { rgb } from "pdf-lib";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_BOTTOM = 55;

const DEFAULT_HEADER_BG = rgb(0.18, 0.18, 0.22);
const DEFAULT_HEADER_FG = rgb(1, 1, 1);
const DEFAULT_ROW_ALT = rgb(0.96, 0.96, 0.97);
const DEFAULT_LINE = rgb(0.78, 0.78, 0.82);
const DEFAULT_TEXT = rgb(0.07, 0.07, 0.1);

/**
 * Draws a table on a pdf-lib document.
 *
 * @param {object} opts
 * @param {import('pdf-lib').PDFDocument} opts.pdf
 * @param {import('pdf-lib').PDFPage} opts.page  — current page
 * @param {number} opts.y                        — current Y cursor (top of table)
 * @param {import('pdf-lib').PDFFont} opts.font
 * @param {number}   [opts.startX=40]            — left edge of table
 * @param {number[]} opts.colWidths              — array of column widths in points
 * @param {string[]} opts.headers                — header labels
 * @param {Array<Array<string|number>>} opts.rows — data rows
 * @param {number}   [opts.rowHeight=17]
 * @param {number}   [opts.fontSize=8]
 * @param {number[]} [opts.alignRightCols=[]]    — 0-based indices of right-aligned columns
 * @returns {{ page: import('pdf-lib').PDFPage, y: number }}
 */
export function drawTable({
  pdf,
  page,
  y,
  font,
  startX = 40,
  colWidths,
  headers,
  rows,
  rowHeight = 17,
  fontSize = 8,
  alignRightCols = [],
  headerBg = DEFAULT_HEADER_BG,
  headerFg = DEFAULT_HEADER_FG,
  rowAlt = DEFAULT_ROW_ALT,
  lineColor = DEFAULT_LINE,
  textColor = DEFAULT_TEXT,
}) {
  const totalW = colWidths.reduce((s, w) => s + w, 0);
  const textY = (rowTop) => rowTop - rowHeight + Math.round(rowHeight * 0.32);

  function cellX(colIdx, align, text) {
    let cx = startX;
    for (let i = 0; i < colIdx; i++) cx += colWidths[i];
    const w = colWidths[colIdx];
    if (align) {
      const tw = font.widthOfTextAtSize(String(text ?? ""), fontSize);
      return cx + w - tw - 4;
    }
    return cx + 4;
  }

  function drawHLine(pg, lineY) {
    pg.drawLine({
      start: { x: startX, y: lineY },
      end: { x: startX + totalW, y: lineY },
      thickness: 0.4,
      color: lineColor,
    });
  }

  function drawVLines(pg, topY, bottomY) {
    let cx = startX;
    pg.drawLine({ start: { x: cx, y: topY }, end: { x: cx, y: bottomY }, thickness: 0.4, color: lineColor });
    for (const w of colWidths) {
      cx += w;
      pg.drawLine({ start: { x: cx, y: topY }, end: { x: cx, y: bottomY }, thickness: 0.4, color: lineColor });
    }
  }

  function drawHeaderRow(pg, rowTop) {
    pg.drawRectangle({
      x: startX,
      y: rowTop - rowHeight,
      width: totalW,
      height: rowHeight,
      color: headerBg,
    });
    for (let i = 0; i < headers.length; i++) {
      const text = String(headers[i] ?? "");
      const tx = cellX(i, alignRightCols.includes(i), text);
      pg.drawText(text, { x: tx, y: textY(rowTop), size: fontSize, font, color: headerFg });
    }
    drawHLine(pg, rowTop - rowHeight);
  }

  // --- Draw initial header ---
  let sectionTop = y;
  drawHeaderRow(page, y);
  y -= rowHeight;

  // --- Draw rows ---
  for (let ri = 0; ri < rows.length; ri++) {
    if (y - rowHeight < MARGIN_BOTTOM) {
      // Close vertical lines for this page section
      drawVLines(page, sectionTop, y);

      // New page
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 40;
      sectionTop = y;
      drawHeaderRow(page, y);
      y -= rowHeight;
    }

    const row = rows[ri];

    // Alternating row background
    if (ri % 2 === 1) {
      page.drawRectangle({
        x: startX,
        y: y - rowHeight,
        width: totalW,
        height: rowHeight,
        color: rowAlt,
      });
    }

    // Row text
    for (let i = 0; i < row.length; i++) {
      const text = String(row[i] ?? "");
      const tx = cellX(i, alignRightCols.includes(i), text);
      page.drawText(text, { x: tx, y: textY(y), size: fontSize, font, color: textColor });
    }

    drawHLine(page, y - rowHeight);
    y -= rowHeight;
  }

  // Vertical lines for last section
  drawVLines(page, sectionTop, y);

  return { page, y };
}
