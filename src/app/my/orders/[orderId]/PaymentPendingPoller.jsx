"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, SpinnerGap } from "@phosphor-icons/react";

export function PaymentPendingPoller({ orderId, initialStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    if (status !== "PENDING") return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/payment-status`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.paymentStatus !== "PENDING") {
          setStatus(data.paymentStatus);
          router.refresh();
        }
      } catch {
        // ignore network errors, retry on next tick
      }
    };

    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [orderId, status, router]);

  if (status === "PAID") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 animate-in fade-in">
        <CheckCircle size={20} weight="fill" className="text-emerald-600" />
        Оплата прошла успешно!
      </div>
    );
  }

  if (status === "PENDING") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <SpinnerGap size={18} className="animate-spin text-amber-600" />
        Ожидание подтверждения оплаты...
      </div>
    );
  }

  return null;
}
