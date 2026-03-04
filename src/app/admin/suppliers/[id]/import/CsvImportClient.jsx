"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { createDraftBatch, applyBatch } from "./actions";

const REQUIRED_FIELDS = ["name", "category", "unit", "price"];
const OPTIONAL_FIELDS = ["sku", "imageUrl"];
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

const FIELD_LABELS = {
  name:     "Название",
  category: "Категория",
  unit:     "Ед. изм.",
  price:    "Цена",
  sku:      "Артикул (SKU)",
  imageUrl: "Картинка (URL)",
};

const FIELD_ALIASES = {
  name:     ["name", "название", "наименование", "товар", "product"],
  category: ["category", "категория", "кат", "раздел"],
  unit:     ["unit", "ед", "единица"],
  price:    ["price", "цена", "стоимость", "прайс"],
  sku:      ["sku", "артикул", "арт", "код"],
  imageUrl: ["imageurl", "image", "картинка", "фото"],
};

function detectMappingClient(headers) {
  const mapping = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase().replace(/[\s.]/g, "");
      if (aliases.some((a) => h === a || h.startsWith(a))) {
        if (!(field in mapping)) mapping[field] = String(i);
        break;
      }
    }
  }
  return mapping;
}

function detectDelim(firstLine) {
  const sc = (firstLine.match(/;/g) || []).length;
  const cm = (firstLine.match(/,/g) || []).length;
  return sc >= cm ? ";" : ",";
}

function parseLineClient(line, delim) {
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

function parseCSVClient(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const delim = detectDelim(lines[0]);
  const headers = parseLineClient(lines[0], delim);
  const rows = lines.slice(1).map((l) => parseLineClient(l, delim));
  return { headers, rows };
}

// ── Phase 3: Applied ──────────────────────────────────────

function AppliedView({ result }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-emerald-50 border-emerald-200 p-5 shadow-sm space-y-4">
        <div className="text-sm font-semibold text-emerald-800">
          Импорт применён: {result.fileName}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border bg-white p-3 text-center">
            <div className="text-2xl font-bold text-emerald-700">{result.created}</div>
            <div className="text-xs text-zinc-500 mt-1">Создано</div>
          </div>
          <div className="rounded-xl border bg-white p-3 text-center">
            <div className="text-2xl font-bold text-amber-700">{result.updated}</div>
            <div className="text-xs text-zinc-500 mt-1">Обновлено</div>
          </div>
          <div className="rounded-xl border bg-white p-3 text-center">
            <div className="text-2xl font-bold text-red-500">{result.errorsCount}</div>
            <div className="text-xs text-zinc-500 mt-1">Ошибок</div>
          </div>
        </div>
      </div>
      <Link
        href="/admin/suppliers"
        className="inline-block text-sm text-zinc-500 underline hover:text-zinc-900"
      >
        ← К поставщикам
      </Link>
    </div>
  );
}

// ── Phase 2: Draft created ────────────────────────────────

function DraftView({ draftResult, applyAction, isApplyPending, applyError }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
        <div className="text-sm font-semibold">
          Черновик создан:{" "}
          <span className="font-normal text-zinc-500">{draftResult.fileName}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-emerald-50 p-3 text-center">
            <div className="text-2xl font-bold text-emerald-700">{draftResult.okCount}</div>
            <div className="text-xs text-zinc-500 mt-1">Строк готово к импорту</div>
          </div>
          <div className="rounded-xl border bg-red-50 p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{draftResult.errorCount}</div>
            <div className="text-xs text-zinc-500 mt-1">Строк с ошибками</div>
          </div>
        </div>

        {draftResult.errors.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <div className="text-xs font-medium text-red-800 mb-1">
              Ошибки (строки будут пропущены при применении):
            </div>
            <ul className="space-y-0.5 max-h-40 overflow-y-auto">
              {draftResult.errors.map((e, i) => (
                <li key={i} className="text-xs text-red-700">{e}</li>
              ))}
            </ul>
          </div>
        )}

        {applyError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {applyError}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <form action={applyAction}>
          <input type="hidden" name="batchId" value={draftResult.batchId} />
          <button
            type="submit"
            disabled={isApplyPending || draftResult.okCount === 0}
            className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {isApplyPending
              ? "Применяем..."
              : `Применить импорт (${draftResult.okCount} строк)`}
          </button>
        </form>

        <Link
          href="/admin/suppliers"
          className="text-sm text-zinc-500 underline hover:text-zinc-900"
        >
          Отмена
        </Link>
      </div>
    </div>
  );
}

// ── Phase 1: Upload form ──────────────────────────────────

export function CsvImportClient({ supplierId }) {
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});

  const [draftResult, draftAction, isDraftPending] = useActionState(createDraftBatch, null);
  const [applyResult, applyAction, isApplyPending] = useActionState(applyBatch, null);

  // Phase 3: applied
  if (applyResult?.success) return <AppliedView result={applyResult} />;

  // Phase 2: draft created
  if (draftResult?.batchId) {
    return (
      <DraftView
        draftResult={draftResult}
        applyAction={applyAction}
        isApplyPending={isApplyPending}
        applyError={applyResult?.error}
      />
    );
  }

  // Phase 1: upload form
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) { setPreview(null); setMapping({}); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const { headers, rows } = parseCSVClient(text);
      setPreview({ headers, rows: rows.slice(0, 20), total: rows.length });
      setMapping(detectMappingClient(headers));
    };
    reader.readAsText(file, "utf-8");
  }

  return (
    <form action={draftAction}>
      <input type="hidden" name="supplierId" value={supplierId} />

      <div className="space-y-5">
        <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
          <div>
            <label className="text-sm font-medium">CSV-файл</label>
            <div className="mt-2">
              <input
                type="file"
                name="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border file:px-3 file:py-1 file:text-xs file:font-medium file:hover:bg-zinc-50 file:cursor-pointer"
              />
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">
              UTF-8, разделитель <code>;</code> или <code>,</code>. Колонки:{" "}
              <span className="font-medium">Название, Категория, Ед, Цена</span> (обязательно),
              Артикул, Картинка (опционально).
            </p>
          </div>

          {draftResult?.error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {draftResult.error}
            </div>
          )}
        </div>

        {preview && (
          <>
            <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
              <div className="text-sm font-medium">Маппинг колонок</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {ALL_FIELDS.map((field) => (
                  <div key={field} className="flex items-center gap-2">
                    <label className="text-xs w-28 shrink-0 text-zinc-600">
                      {FIELD_LABELS[field]}
                      {REQUIRED_FIELDS.includes(field) && (
                        <span className="text-red-500 ml-0.5">*</span>
                      )}
                    </label>
                    <select
                      name={`map_${field}`}
                      value={mapping[field] ?? "-1"}
                      onChange={(e) =>
                        setMapping((m) => ({ ...m, [field]: e.target.value }))
                      }
                      className="rounded-lg border px-2 py-1 text-xs flex-1 bg-white"
                    >
                      <option value="-1">— не выбрано —</option>
                      {preview.headers.map((h, i) => (
                        <option key={i} value={String(i)}>
                          {h} (кол. {i + 1})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
              <div className="text-sm font-medium">
                Предпросмотр — первые {preview.rows.length} из {preview.total} строк
              </div>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-zinc-50">
                      {preview.headers.map((h, i) => (
                        <th
                          key={i}
                          className="px-2 py-1.5 text-left font-medium text-zinc-600 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-zinc-50">
                        {row.map((cell, j) => (
                          <td key={j} className="px-2 py-1.5 text-zinc-700 max-w-45 truncate">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              type="submit"
              disabled={isDraftPending}
              className="rounded-xl bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {isDraftPending
                ? "Создаём черновик..."
                : `Создать черновик (${preview.total} строк)`}
            </button>
          </>
        )}
      </div>
    </form>
  );
}
