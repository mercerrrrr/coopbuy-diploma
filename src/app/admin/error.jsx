"use client";

import { RouteErrorState } from "@/components/ui/RouteStatus";

export default function AdminError({ reset }) {
  return (
    <RouteErrorState
      reset={reset}
      title="Не удалось открыть операционный экран"
      description="Система не смогла подготовить данные для административного интерфейса. Повторите попытку."
    />
  );
}
