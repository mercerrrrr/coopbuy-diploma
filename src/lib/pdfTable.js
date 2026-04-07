import { rgb } from "pdf-lib";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_BOTTOM = 55;

const DEFAULT_HEADER_BG = rgb(0.18, 0.18, 0.22);
const DEFAULT_HEADER_FG = rgb(1, 1, 1);
const DEFAULT_ROW_ALT = rgb(0.96, 0.96, 0.97);
const DEFAULT_LINE = rgb(0.78, 0.78, 0.82);
const DEFAULT_TEXT = rgb(0.07, 0.07, 0.1);

function splitLongWord(word, font, fontSize, maxWidth) {
  const segments = [];
  let current = "";

  for (const char of Array.from(word)) {
    const candidate = current + char;
    if (!current || font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }

    segments.push(current);
    current = char;
  }

  if (current) {
    segments.push(current);
  }

  return segments.length > 0 ? segments : [word];
}

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
  const cellPaddingX = 4;
  const cellPaddingY = Math.max(4, Math.round(fontSize * 0.65));
  const lineHeight = Math.max(fontSize + 2, Math.round(fontSize * 1.25));

  function wrapText(text, maxWidth) {
    const source = String(text ?? "");
    if (!source) return [""];

    const wrappedLines = [];
    const rawLines = source.split(/\r?\n/);

    for (const rawLine of rawLines) {
      const words = rawLine.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        wrappedLines.push("");
        continue;
      }

      let currentLine = "";

      for (const word of words) {
        if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
          if (currentLine) {
            wrappedLines.push(currentLine);
            currentLine = "";
          }

          const segments = splitLongWord(word, font, fontSize, maxWidth);
          wrappedLines.push(...segments.slice(0, -1));
          currentLine = segments.at(-1) ?? "";
          continue;
        }

        const candidate = currentLine ? `${currentLine} ${word}` : word;
        if (!currentLine || font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
          currentLine = candidate;
          continue;
        }

        wrappedLines.push(currentLine);
        currentLine = word;
      }

      if (currentLine) {
        wrappedLines.push(currentLine);
      }
    }

    return wrappedLines.length > 0 ? wrappedLines : [""];
  }

  function getRowMetrics(row) {
    const cellLines = row.map((value, colIdx) =>
      wrapText(value, Math.max(colWidths[colIdx] - cellPaddingX * 2, fontSize))
    );
    const maxLineCount = Math.max(...cellLines.map((lines) => lines.length));
    const computedHeight = Math.max(
      rowHeight,
      cellPaddingY * 2 + Math.max(1, maxLineCount) * lineHeight - 2
    );

    return { cellLines, height: computedHeight };
  }

  function cellX(colIdx, align, text) {
    let cx = startX;
    for (let i = 0; i < colIdx; i++) cx += colWidths[i];
    const w = colWidths[colIdx];
    if (align) {
      const tw = font.widthOfTextAtSize(String(text ?? ""), fontSize);
      return cx + w - tw - cellPaddingX;
    }
    return cx + cellPaddingX;
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
    const { cellLines, height } = getRowMetrics(headers);
    pg.drawRectangle({
      x: startX,
      y: rowTop - height,
      width: totalW,
      height,
      color: headerBg,
    });

    for (let colIdx = 0; colIdx < headers.length; colIdx++) {
      const lines = cellLines[colIdx];
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const text = lines[lineIdx];
        const tx = cellX(colIdx, alignRightCols.includes(colIdx), text);
        const ty = rowTop - cellPaddingY - fontSize - lineIdx * lineHeight;
        pg.drawText(text, { x: tx, y: ty, size: fontSize, font, color: headerFg });
      }
    }

    drawHLine(pg, rowTop - height);
    return height;
  }

  // --- Draw initial header ---
  let sectionTop = y;
  const headerHeight = drawHeaderRow(page, y);
  y -= headerHeight;

  // --- Draw rows ---
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const { cellLines, height } = getRowMetrics(row);

    if (y - height < MARGIN_BOTTOM) {
      // Close vertical lines for this page section
      drawVLines(page, sectionTop, y);

      // New page
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 40;
      sectionTop = y;
      const newHeaderHeight = drawHeaderRow(page, y);
      y -= newHeaderHeight;
    }

    // Alternating row background
    if (ri % 2 === 1) {
      page.drawRectangle({
        x: startX,
        y: y - height,
        width: totalW,
        height,
        color: rowAlt,
      });
    }

    // Row text
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const lines = cellLines[colIdx];
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const text = lines[lineIdx];
        const tx = cellX(colIdx, alignRightCols.includes(colIdx), text);
        const ty = y - cellPaddingY - fontSize - lineIdx * lineHeight;
        page.drawText(text, { x: tx, y: ty, size: fontSize, font, color: textColor });
      }
    }

    drawHLine(page, y - height);
    y -= height;
  }

  // Vertical lines for last section
  drawVLines(page, sectionTop, y);

  return { page, y };
}
