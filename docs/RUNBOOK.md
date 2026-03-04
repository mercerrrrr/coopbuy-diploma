# CoopBuy — Demo Runbook

## Быстрый старт

```bash
npm install
npm run db:reset:demo   # сброс БД + demo seed
npm run dev             # http://localhost:3000
```

---

## Учётные записи

### Базовый seed (`npx prisma db seed`)

| Роль     | Email                | Пароль       | Доступ                                      |
|----------|----------------------|--------------|---------------------------------------------|
| ADMIN    | admin@local.test     | Admin123!    | Полный доступ                               |
| OPERATOR | operator1@local.test | Operator123! | `/admin/procurements` своего пункта выдачи  |

### Demo seed (`npm run db:reset:demo`)

| Роль     | Email                   | Пароль       |
|----------|-------------------------|--------------|
| ADMIN    | admin@local.test        | Admin123!    |
| OPERATOR | operator1@local.test    | Operator123! |
| OPERATOR | operator2@local.test    | Operator123! |
| RESIDENT | user1@local.test        | User123!     |
| RESIDENT | user2@local.test        | User123!     |
| RESIDENT | user3–6@local.test      | User123!     |

---

## 10-минутный сценарий демо

### 1. ADMIN — Дашборд и отчёты (~2 мин)
1. Войти как `admin@local.test / Admin123!`
2. Открыть **`/admin/dashboard`** → видны карточки по закупкам: статистика оплат, прогресс
3. Открыть **`/admin/procurements`** → список закупок
4. Кликнуть на **«Демо-закупка №3 (завершена)»** → страница деталей
5. Нажать **«Отчёт»** → `/admin/procurements/[id]/report` (KPI, топ-товары)
6. Скачать **report.pdf** и **report.xlsx**
7. Скачать **payments.xlsx** — реестр оплат участников

**Ожидается:** PDF/XLSX скачиваются, данные заполнены.

---

### 2. RESIDENT — Просмотр закупки и submit (~2 мин)
1. Войти как `user1@local.test / User123!`
2. Открыть **`/my/procurements`** → видны открытые закупки
3. Нажать **«Перейти к закупке»** на «Демо-закупка №1»
4. Добавить товары в корзину → нажать **«Оформить заявку»**
5. Открыть **`/my/orders`** → заявка со статусом SUBMITTED
6. Кликнуть на заявку → видны QR-код и кнопка **«Скачать квитанцию (PDF)»**

**Ожидается:** Заявка создана, QR и PDF доступны.

---

### 3. OPERATOR — Выдача заказа (~2 мин)
1. Войти как `operator1@local.test / Operator123!`
2. Открыть **`/admin/procurements`** → видна своя закупка
3. Открыть деталь закупки → секция **«Выдача»**
4. Создать сессию выдачи (если нет) → **«Начать выдачу»**
5. В поле ввода вставить **orderId** нужного заказа → нажать **«Выдать»**
6. Статус заказа меняется на **«Выдано»**

**Ожидается:** checkin создан, запись в списке выдачи.

---

### 4. RESIDENT — Статус «Выдано» и уведомления (~2 мин)
1. Вернуться под `user1@local.test`
2. Открыть **`/my/orders`** → заказ со статусом **Выдано**
3. Открыть **`/my/notifications`** → список уведомлений (PROCUREMENT_CREATED, ORDER_SUBMITTED, PAYMENT_STATUS_CHANGED)
4. Нажать **«Отметить все как прочитанные»** → badge на навбаре исчезает

**Ожидается:** статус обновлён, уведомления читаются.

---

### 5. ADMIN — Экспорты и импорт (~2 мин)
1. Открыть **`/admin/suppliers`** → список поставщиков (4 активных, 1 неактивный)
2. Зайти в поставщика → вкладка продуктов → экспорт CSV/XLSX
3. Открыть **`/admin/dictionaries`** → управление категориями и единицами

**Ожидается:** все разделы работают без ошибок.

---

## URL по ролям

| Путь | Роль |
|------|------|
| `/admin/dashboard` | ADMIN, OPERATOR |
| `/admin/procurements` | ADMIN, OPERATOR |
| `/admin/procurements/[id]` | ADMIN, OPERATOR |
| `/admin/procurements/[id]/report` | ADMIN |
| `/admin/procurements/[id]/report.pdf` | ADMIN |
| `/admin/procurements/[id]/report.xlsx` | ADMIN |
| `/admin/procurements/[id]/payments.xlsx` | ADMIN |
| `/admin/suppliers` | ADMIN |
| `/admin/dictionaries` | ADMIN |
| `/my/procurements` | RESIDENT |
| `/my/orders` | RESIDENT |
| `/my/orders/[id]` | RESIDENT (QR + receipt.pdf) |
| `/my/notifications` | RESIDENT |
| `/p/[code]` | все (публичная корзина) |
| `/auth/login` | все |

---

## Команды

```bash
# Первичный запуск
npm install
npm run db:reset:demo

# Повторный сброс данных (без удаления схемы)
npm run seed:demo

# Запуск dev-сервера
npm run dev
```

---

## Чек-лист после seed

- [ ] Создано 5 регионов, 7 населённых пунктов, 7 пунктов выдачи
- [ ] Создано 5 категорий, 5 единиц, 5 поставщиков, 20 продуктов
- [ ] Создано 3 закупки (2 OPEN, 1 CLOSED)
- [ ] Создано 6+ SUBMITTED заказов с позициями и goodsTotal/grandTotal
- [ ] 3 заказа имеют PickupCheckin (выдано)
- [ ] У каждого RESIDENT есть 3 уведомления
- [ ] Создан ReceivingReport с 2 строками (1 с расхождением)
- [ ] Создано ≥10 записей AuditLog
- [ ] Все учётные записи из таблицы выше работают
