/**
 * Генератор ERD-диаграммы (презентационная версия) в формате draw.io
 * Запуск: node scripts/generate-erd.js
 * Результат: docs/erd.drawio
 *
 * Компактная ERD для слайда 16:9:
 *  - только сущности со связями (без AuditLog, RateLimitBucket)
 *  - сокращённые поля: PK + FK + ключевые бизнес-поля
 *  - цветовое кодирование по доменам
 */
const fs = require("fs");
const path = require("path");

// ── компактные размеры ──
const ROW_H = 20;
const TITLE_H = 24;
const SEP_H = 6;

// ── цвета по доменам ──
const C = {
  geo:     { fill: "#d5e8d4", stroke: "#82b366" },
  auth:    { fill: "#fff2cc", stroke: "#d6b656" },
  supply:  { fill: "#dae8fc", stroke: "#6c8ebf" },
  import:  { fill: "#e1d5e7", stroke: "#9673a6" },
  core:    { fill: "#f8cecc", stroke: "#b85450" },
  fulfill: { fill: "#ffe6cc", stroke: "#d79b00" },
};

// ── сущности (только PK, FK и ключевые поля) ──
const entities = [
  // ──── Row 0 — справочники (y=10) ────
  {
    id: "Region", color: "geo", x: 20, y: 10, w: 160,
    fields: [
      { n: "id", pk: true },
      { n: "name" },
    ],
  },
  {
    id: "Settlement", color: "geo", x: 200, y: 10, w: 170,
    fields: [
      { n: "id", pk: true },
      { n: "name" },
      { n: "regionId", fk: true },
    ],
  },
  {
    id: "PickupPoint", color: "geo", x: 395, y: 10, w: 180,
    fields: [
      { n: "id", pk: true },
      { n: "name" },
      { n: "address" },
      { n: "settlementId", fk: true },
    ],
  },
  {
    id: "Supplier", color: "supply", x: 640, y: 10, w: 165,
    fields: [
      { n: "id", pk: true },
      { n: "name" },
      { n: "isActive" },
    ],
  },
  {
    id: "Category", color: "supply", x: 840, y: 10, w: 150,
    fields: [
      { n: "id", pk: true },
      { n: "name" },
    ],
  },
  {
    id: "Unit", color: "supply", x: 1015, y: 10, w: 140,
    fields: [
      { n: "id", pk: true },
      { n: "name" },
    ],
  },

  // ──── Row 1 — основные (y=140) ────
  {
    id: "User", color: "auth", x: 20, y: 140, w: 195,
    fields: [
      { n: "id", pk: true },
      { n: "email" },
      { n: "fullName" },
      { n: "role" },
      { n: "settlementId", fk: true },
      { n: "pickupPointId", fk: true },
    ],
  },
  {
    id: "Procurement", color: "core", x: 260, y: 140, w: 225,
    fields: [
      { n: "id", pk: true },
      { n: "status" },
      { n: "title" },
      { n: "deadlineAt" },
      { n: "supplierId", fk: true },
      { n: "settlementId", fk: true },
      { n: "pickupPointId", fk: true },
      { n: "deliverySplitMode" },
    ],
  },
  {
    id: "Product", color: "supply", x: 540, y: 140, w: 195,
    fields: [
      { n: "id", pk: true },
      { n: "name" },
      { n: "price" },
      { n: "categoryId", fk: true },
      { n: "unitId", fk: true },
      { n: "supplierId", fk: true },
    ],
  },
  {
    id: "PriceImportBatch", color: "import", x: 810, y: 140, w: 210,
    fields: [
      { n: "id", pk: true },
      { n: "supplierId", fk: true },
      { n: "fileName" },
      { n: "status" },
    ],
  },

  // ──── Row 2 — операции (y=360) ────
  {
    id: "Notification", color: "auth", x: 20, y: 360, w: 180,
    fields: [
      { n: "id", pk: true },
      { n: "userId", fk: true },
      { n: "type" },
      { n: "title" },
    ],
  },
  {
    id: "Order", color: "core", x: 260, y: 360, w: 215,
    fields: [
      { n: "id", pk: true },
      { n: "status" },
      { n: "userId", fk: true },
      { n: "procurementId", fk: true },
      { n: "paymentStatus" },
      { n: "grandTotal" },
    ],
  },
  {
    id: "SupplierDeliveryZone", color: "supply", x: 540, y: 360, w: 220,
    fields: [
      { n: "id", pk: true },
      { n: "supplierId", fk: true },
      { n: "settlementId", fk: true },
    ],
  },
  {
    id: "PriceImportRow", color: "import", x: 810, y: 360, w: 200,
    fields: [
      { n: "id", pk: true },
      { n: "batchId", fk: true },
      { n: "rawName" },
      { n: "status" },
    ],
  },

  // ──── Row 3 — детали (y=540) ────
  {
    id: "OrderItem", color: "core", x: 260, y: 540, w: 195,
    fields: [
      { n: "id", pk: true },
      { n: "orderId", fk: true },
      { n: "productId", fk: true },
      { n: "qty" },
      { n: "price" },
    ],
  },
  {
    id: "ReceivingReport", color: "fulfill", x: 510, y: 540, w: 200,
    fields: [
      { n: "id", pk: true },
      { n: "status" },
      { n: "procurementId", fk: true },
    ],
  },
  {
    id: "PickupSession", color: "fulfill", x: 760, y: 540, w: 200,
    fields: [
      { n: "id", pk: true },
      { n: "status" },
      { n: "procurementId", fk: true },
    ],
  },

  // ──── Row 4 — низ (y=690) ────
  {
    id: "ReceivingLine", color: "fulfill", x: 510, y: 690, w: 200,
    fields: [
      { n: "id", pk: true },
      { n: "reportId", fk: true },
      { n: "productId", fk: true },
      { n: "expectedQty" },
      { n: "receivedQty" },
    ],
  },
  {
    id: "PickupCheckin", color: "fulfill", x: 760, y: 690, w: 200,
    fields: [
      { n: "id", pk: true },
      { n: "sessionId", fk: true },
      { n: "orderId", fk: true },
    ],
  },
];

// ── связи (FK → PK) ──
const relations = [
  // Geography
  { from: "Settlement", ff: "regionId", to: "Region", tf: "id", type: "N:1" },
  { from: "PickupPoint", ff: "settlementId", to: "Settlement", tf: "id", type: "N:1" },
  // Supply
  { from: "SupplierDeliveryZone", ff: "supplierId", to: "Supplier", tf: "id", type: "N:1" },
  { from: "SupplierDeliveryZone", ff: "settlementId", to: "Settlement", tf: "id", type: "N:1" },
  { from: "Product", ff: "categoryId", to: "Category", tf: "id", type: "N:1" },
  { from: "Product", ff: "unitId", to: "Unit", tf: "id", type: "N:1" },
  { from: "Product", ff: "supplierId", to: "Supplier", tf: "id", type: "N:1" },
  // Import
  { from: "PriceImportBatch", ff: "supplierId", to: "Supplier", tf: "id", type: "N:1" },
  { from: "PriceImportRow", ff: "batchId", to: "PriceImportBatch", tf: "id", type: "N:1" },
  // Auth
  { from: "User", ff: "settlementId", to: "Settlement", tf: "id", type: "N:1" },
  { from: "User", ff: "pickupPointId", to: "PickupPoint", tf: "id", type: "N:1" },
  { from: "Notification", ff: "userId", to: "User", tf: "id", type: "N:1" },
  // Core
  { from: "Procurement", ff: "supplierId", to: "Supplier", tf: "id", type: "N:1" },
  { from: "Procurement", ff: "settlementId", to: "Settlement", tf: "id", type: "N:1" },
  { from: "Procurement", ff: "pickupPointId", to: "PickupPoint", tf: "id", type: "N:1" },
  { from: "Order", ff: "userId", to: "User", tf: "id", type: "N:1" },
  { from: "Order", ff: "procurementId", to: "Procurement", tf: "id", type: "N:1" },
  { from: "OrderItem", ff: "orderId", to: "Order", tf: "id", type: "N:1" },
  { from: "OrderItem", ff: "productId", to: "Product", tf: "id", type: "N:1" },
  // Fulfillment
  { from: "ReceivingReport", ff: "procurementId", to: "Procurement", tf: "id", type: "1:1" },
  { from: "ReceivingLine", ff: "reportId", to: "ReceivingReport", tf: "id", type: "N:1" },
  { from: "ReceivingLine", ff: "productId", to: "Product", tf: "id", type: "N:1" },
  { from: "PickupSession", ff: "procurementId", to: "Procurement", tf: "id", type: "1:1" },
  { from: "PickupCheckin", ff: "sessionId", to: "PickupSession", tf: "id", type: "N:1" },
  { from: "PickupCheckin", ff: "orderId", to: "Order", tf: "id", type: "1:1" },
];

// ── Генерация XML ──

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function entityH(e) {
  return TITLE_H + ROW_H + SEP_H + (e.fields.length - 1) * ROW_H;
}

function entityXml(e) {
  const h = entityH(e);
  const c = C[e.color];
  const lines = [];

  lines.push(
    `    <mxCell id="${e.id}" value="${esc(e.id)}" ` +
      `style="shape=table;startSize=${TITLE_H};container=1;collapsible=0;childLayout=stackLayout;` +
      `fixedRows=1;rowLines=0;fontStyle=1;align=center;resizeLast=1;` +
      `fillColor=${c.fill};strokeColor=${c.stroke};fontSize=11;fontFamily=Helvetica;" ` +
      `vertex="1" parent="1">`,
    `      <mxGeometry x="${e.x}" y="${e.y}" width="${e.w}" height="${h}" as="geometry"/>`,
    `    </mxCell>`
  );

  let y = TITLE_H;

  e.fields.forEach((f) => {
    const isPk = !!f.pk;
    const isFk = !!f.fk;
    let label = f.n;
    if (isPk) label += "  PK";
    if (isFk) label += "  FK";

    let fontStyle = 0;
    if (isPk) fontStyle = 5;       // bold + underline
    else if (isFk) fontStyle = 2;  // italic

    const style =
      `text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;` +
      `spacingLeft=4;spacingRight=4;overflow=hidden;rotatable=0;` +
      `points=[[0,0.5],[1,0.5]];portConstraint=eastwest;` +
      `fontStyle=${fontStyle};fontSize=10;`;

    lines.push(
      `    <mxCell id="${e.id}_${f.n}" value="${esc(label)}" style="${style}" vertex="1" parent="${e.id}">`,
      `      <mxGeometry y="${y}" width="${e.w}" height="${ROW_H}" as="geometry"/>`,
      `    </mxCell>`
    );
    y += ROW_H;

    if (isPk) {
      lines.push(
        `    <mxCell id="${e.id}_sep" value="" ` +
          `style="line;strokeWidth=1;fillColor=none;align=left;verticalAlign=middle;` +
          `spacingTop=-1;spacingLeft=3;spacingRight=3;rotatable=0;labelPosition=left;` +
          `points=[];portConstraint=eastwest;strokeColor=${c.stroke};" ` +
          `vertex="1" parent="${e.id}">`,
        `      <mxGeometry y="${y}" width="${e.w}" height="${SEP_H}" as="geometry"/>`,
        `    </mxCell>`
      );
      y += SEP_H;
    }
  });

  return lines.join("\n");
}

function edgeXml(r, idx) {
  const isOne = r.type === "1:1";
  const startArrow = isOne ? "ERone" : "ERmany";
  const style =
    `edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;` +
    `endArrow=ERone;endFill=0;startArrow=${startArrow};startFill=0;` +
    `strokeColor=#666666;`;

  return [
    `    <mxCell id="rel_${idx}" style="${style}" ` +
      `edge="1" source="${r.from}_${r.ff}" target="${r.to}_${r.tf}" parent="1">`,
    `      <mxGeometry relative="1" as="geometry"/>`,
    `    </mxCell>`,
  ].join("\n");
}

// ── Сборка ──
const parts = [
  `<mxfile host="app.diagrams.net" type="device">`,
  `  <diagram name="CoopBuy ERD" id="erd">`,
  `    <mxGraphModel dx="1200" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="1200" pageHeight="900" math="0" shadow="0">`,
  `      <root>`,
  `        <mxCell id="0"/>`,
  `        <mxCell id="1" parent="0"/>`,
  ``,
];

entities.forEach((e) => parts.push(entityXml(e), ``));

parts.push(`        <!-- Relations -->`);
relations.forEach((r, i) => parts.push(edgeXml(r, i)));

parts.push(
  `      </root>`,
  `    </mxGraphModel>`,
  `  </diagram>`,
  `</mxfile>`,
  ``
);

const xml = parts.join("\n");

const outDir = path.join(__dirname, "..", "docs");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "erd.drawio");
fs.writeFileSync(outPath, xml, "utf-8");
console.log(`ERD saved to ${outPath} (${entities.length} entities, ${relations.length} relations)`);
