/**
 * Pure CSV parsing helpers (no DB, no I/O).
 * Extracted so they can be unit-tested independently.
 */

/** Detect delimiter by counting occurrences in the header line. */
export function detectDelim(firstLine) {
  const sc = (firstLine.match(/;/g) || []).length;
  const cm = (firstLine.match(/,/g) || []).length;
  return sc >= cm ? ";" : ",";
}

/** Parse a single CSV line respecting quoted fields and escaped double-quotes. */
export function parseLine(line, delim) {
  const result = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
      result.push(field.trim());
      field = "";
    } else {
      field += ch;
    }
  }
  result.push(field.trim());
  return result;
}

/** Parse full CSV text into headers + rows + detected delimiter. */
export function parseCSVText(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [], delim: "," };
  const delim = detectDelim(lines[0]);
  const headers = parseLine(lines[0], delim);
  const rows = lines.slice(1).map((l) => parseLine(l, delim));
  return { headers, rows, delim };
}

export const FIELD_ALIASES = {
  name:     ["name", "название", "наименование", "товар", "product"],
  category: ["category", "категория", "кат", "раздел"],
  unit:     ["unit", "ед", "единица", "едизм", "единица"],
  price:    ["price", "цена", "стоимость", "прайс"],
  sku:      ["sku", "артикул", "арт", "код"],
  imageUrl: ["imageurl", "image", "картинка", "фото", "изображение"],
};

/** Auto-detect column indices from headers using known aliases. */
export function autoDetectMapping(headers) {
  const mapping = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase().replace(/[\s.]/g, "");
      if (aliases.some((a) => h === a || h.startsWith(a))) {
        if (!(field in mapping)) mapping[field] = i;
        break;
      }
    }
  }
  return mapping;
}
