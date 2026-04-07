"use client";

import { RouteErrorState } from "@/components/ui/RouteStatus";

export default function MyError({ reset }) {
  return (
    <RouteErrorState
      reset={reset}
      title="Не удалось открыть личный кабинет"
      description="Данные по заказам и уведомлениям не загрузились. Повторите попытку или вернитесь позже."
    />
  );
}
