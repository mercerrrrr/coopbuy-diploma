function sanitizeFilenamePart(value, fallback) {
  const safeValue = String(value ?? fallback)
    .normalize("NFKC")
    .trim()
    .replace(/[\s/\\:]+/g, "-")
    .replace(/[^0-9A-Za-zА-Яа-яЁё._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");

  return safeValue || fallback;
}

function normalizeExtension(extension) {
  return sanitizeFilenamePart(String(extension ?? "bin").replace(/^\./, ""), "bin").toLowerCase();
}

export function buildProcurementDocumentFilename(inviteCode, kind, extension) {
  const code = sanitizeFilenamePart(inviteCode, "procurement");
  const fileKind = sanitizeFilenamePart(kind, "export");
  return `procurement_${code}_${fileKind}.${normalizeExtension(extension)}`;
}

export function buildOrderDocumentFilename(orderId, kind, extension) {
  const safeOrderId = sanitizeFilenamePart(orderId, "order");
  const fileKind = sanitizeFilenamePart(kind, "document");
  return `order_${safeOrderId}_${fileKind}.${normalizeExtension(extension)}`;
}
