"use client";

import { RouteErrorState } from "@/components/ui/RouteStatus";

export default function GlobalError({ reset }) {
  return (
    <RouteErrorState
      reset={reset}
      title="Не удалось открыть CoopBuy"
      description="Интерфейс не смог загрузить данные. Повторите попытку или вернитесь на главный экран."
    />
  );
}
