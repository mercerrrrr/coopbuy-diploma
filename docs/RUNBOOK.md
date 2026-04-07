# CoopBuy — RUNBOOK

## Официальный сценарий наполнения базы

- Официальный seed path: `prisma/seed.js`
- Официальный сценарий запуска seed: `npm run db:reset`

```bash
npm install
npm run db:reset
npm run dev
```

Приложение поднимается на `http://localhost:3000`.

## Пилотный сценарий

- Демо-данные ориентированы на один пилотный регион.
- Основной пользовательский выбор идёт через населённый пункт (`Settlement`).
- Архитектура остаётся масштабируемой: `Region`, `Settlement`, `PickupPoint`, `SupplierDeliveryZone` уже позволяют расширение на несколько регионов.

## Учётные записи после `npm run db:reset`

| Роль | Email | Пароль | Назначение |
| --- | --- | --- | --- |
| ADMIN | `admin@local.test` | `Admin123!` | Полный административный доступ |
| OPERATOR | `operator1@local.test` | `Operator123!` | Работа со своим пунктом выдачи |
| RESIDENT | `user1@local.test` | `User123!` | Житель settlement №1 |
| RESIDENT | `user2@local.test` | `User123!` | Житель settlement №1 |
| RESIDENT | `user3@local.test` | `User123!` | Житель settlement №2 |

## Что проверить после seed

- Авторизация работает по `email + password`.
- Администратор видит `/admin/users` и может создать `OPERATOR` и `RESIDENT`.
- Жители видят закупки только своего населённого пункта в `/my/procurements`.
- Страница `/p/[code]` открывается всем по ссылке, но участие доступно только авторизованному `RESIDENT` с совпадающим `settlementId`.
- Страница `/my/orders/[orderId]` используется как основная квитанция, а PDF остаётся дополнительным экспортом.
- Для завершённой закупки доступны `report.pdf`, `report.xlsx`, `payments.xlsx`, `export.csv`, `export.pdf`, `export.xlsx`, `receiving.csv`, `receiving.xlsx`.

## Краткий smoke-сценарий

1. Выполнить `npm run db:reset`.
2. Войти как `admin@local.test / Admin123!`.
3. Открыть `/admin/users` и создать одного `OPERATOR` и одного `RESIDENT`.
4. Открыть `/admin/procurements` и убедиться, что форма создания визуально разделена на основные поля и дополнительные настройки.
5. Войти как `user1@local.test / User123!` и проверить `/my/procurements`, `/my/orders`, `/my/orders/[orderId]`, `/my/notifications`.
6. Открыть чужую закупку под жителем другого settlement и убедиться, что доступ остаётся только на просмотр.

## Чек-лист

- [ ] Seed запускается официально через `npm run db:reset`
- [ ] Используется только `prisma/seed.js` как официальный seed path
- [ ] Seed поднимает один пилотный регион и несколько settlement
- [ ] Есть открытые и закрытая закупки
- [ ] Есть подтверждённые заказы, оплаты, выдача и акт приёмки
- [ ] Документация и поведение приложения соответствуют `docs/IMPLEMENTATION_ALIGNMENT.md`
