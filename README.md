# CoopBuy

Информационная система для пилотной модели совместных закупок в одном регионе с несколькими населёнными пунктами и пунктами выдачи.

## Назначение

Система разделяет роли `ADMIN`, `OPERATOR` и `RESIDENT`, поддерживает закупки по settlement, оформление заказов, уведомления, выдачу по QR/ID, отчёты и экспорт документов.

## Стек

- Next.js 16 + React 19
- Prisma + PostgreSQL
- Server Actions
- Tailwind CSS 4
- Zod
- Vitest

## Запуск

```bash
npm install
npm run db:reset
npm run dev
```

Приложение доступно по адресу `http://localhost:3000`.

## Seed

- Официальный seed path: `prisma/seed.js`
- Официальный сценарий наполнения базы: `npm run db:reset`
- Seed создаёт один пилотный регион и несколько settlement внутри него

## Тестовые роли

| Роль | Email | Пароль | Назначение |
| --- | --- | --- | --- |
| ADMIN | `admin@local.test` | `Admin123!` | Администрирование, справочники, закупки, пользователи |
| OPERATOR | `operator1@local.test` | `Operator123!` | Работа со своим ПВЗ |
| RESIDENT | `user1@local.test` | `User123!` | Житель settlement №1 |
| RESIDENT | `user2@local.test` | `User123!` | Житель settlement №1 |
| RESIDENT | `user3@local.test` | `User123!` | Житель settlement №2 |

## Ключевые возможности

- авторизация по `email + password`
- управление закупками, поставщиками, территориями и справочниками
- минимальное администрирование пользователей через `/admin/users`
- оформление заявок жителями только в рамках своего населённого пункта
- расчёт доставки и сумм заказа
- квитанция заказа на странице `/my/orders/[orderId]` и PDF-экспорт
- выдача заказов по QR/ID, отчёты, экспорт PDF/XLSX/CSV

## Документация

- `docs/RUNBOOK.md` — официальный сценарий запуска и проверки
- `docs/IMPLEMENTATION_ALIGNMENT.md` — фиксация текущей реализации для пояснительной записки
