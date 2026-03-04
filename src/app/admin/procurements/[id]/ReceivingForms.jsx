"use client";

import { useState } from "react";

/** Confirm button — shows native confirm dialog before submitting the form */
export function ConfirmForm({ action, hiddenFields, label, confirmText, buttonClass }) {
  function handleSubmit(e) {
    if (!confirm(confirmText)) e.preventDefault();
  }
  return (
    <form action={action} onSubmit={handleSubmit}>
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className={buttonClass}>
        {label}
      </button>
    </form>
  );
}

/** Inline editable row for a ReceivingLine */
export function ReceivingLineRow({ line, procurementId, updateAction, isFinal }) {
  const [receivedQty, setReceivedQty] = useState(String(line.receivedQty));
  const [comment, setComment] = useState(line.comment ?? "");
  const delta = line.receivedQty - line.expectedQty;

  return (
    <tr className={delta !== 0 ? "bg-red-50" : ""}>
      <td className="py-2 pr-3 text-sm font-medium">{line.product.name}</td>
      <td className="py-2 pr-3 text-sm text-zinc-600">{line.product.unit?.name ?? "—"}</td>
      <td className="py-2 pr-3 text-right text-sm">{line.expectedQty}</td>
      <td className="py-2 pr-3 text-right text-sm">
        {isFinal ? (
          <span className={delta !== 0 ? "font-medium text-red-700" : ""}>{line.receivedQty}</span>
        ) : (
          <input
            type="number"
            min="0"
            value={receivedQty}
            onChange={(e) => setReceivedQty(e.target.value)}
            className="w-20 rounded-lg border bg-white px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-zinc-300"
          />
        )}
      </td>
      <td className="py-2 pr-3 text-right text-sm font-medium">
        {delta > 0 ? "+" : ""}{delta}
      </td>
      <td className="py-2 pr-3 text-sm text-zinc-600">
        {isFinal ? (
          line.comment || "—"
        ) : (
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Комментарий"
            className="w-full min-w-30 rounded-lg border bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
          />
        )}
      </td>
      {!isFinal && (
        <td className="py-2">
          <form action={updateAction}>
            <input type="hidden" name="lineId" value={line.id} />
            <input type="hidden" name="procurementId" value={procurementId} />
            <input type="hidden" name="receivedQty" value={receivedQty} />
            <input type="hidden" name="comment" value={comment} />
            <button
              type="submit"
              className="rounded-lg border bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800"
            >
              Сохранить
            </button>
          </form>
        </td>
      )}
      {isFinal && <td />}
    </tr>
  );
}
