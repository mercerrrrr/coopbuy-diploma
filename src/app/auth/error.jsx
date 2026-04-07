"use client";

import { RouteErrorState } from "@/components/ui/RouteStatus";

export default function AuthError({ reset }) {
  return (
    <RouteErrorState
      reset={reset}
      title="Не удалось открыть экран доступа"
      description="Сервис авторизации временно недоступен. Повторите попытку ещё раз."
    />
  );
}
