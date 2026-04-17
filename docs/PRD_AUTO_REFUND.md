# PRD: Автоматический возврат при несборе минимальной суммы

> **Версия:** 1.0  
> **Дата:** 2026-04-13  
> **Проект:** CoopBuy Diploma  
> **Стек:** Next.js 16 (App Router) + Prisma 7 + PostgreSQL + ЮKassa SDK

---

## 1. Цель

Автоматически возвращать онлайн-платежи через ЮKassa, если закупка закрылась (по дедлайну или вручную) и собранная сумма не достигла `minTotalSum`.

**Текущее состояние:** `Procurement.minTotalSum` — информационное поле. UI показывает прогресс-бар и предупреждение `closedBecauseMinNotReached`, но никаких автоматических действий не происходит. Админ вручную делает возврат каждому через кнопку «Возврат».

**Целевое состояние:** при закрытии закупки система проверяет `submittedTotal < minTotalSum` → автоматически возвращает деньги всем оплатившим через ЮKassa → уведомляет резидентов → логирует в аудит. Ручной возврат сохраняется как fallback.

---

## 2. Ключевые решения

| Вопрос | Решение |
|--------|---------|
| Когда запускается | При любом закрытии: `closeProcurement()` (ручное) и `autoCloseExpiredProcurements()` (автоматическое) |
| Что возвращается | Полная сумма `order.grandTotal` (товары + доля доставки) |
| Какие заказы затрагиваются | `paymentStatus = "PAID"` с `yookassaPaymentId != null` (только онлайн-платежи) |
| PENDING заказы | Переводятся в `FAILED` (платёж ещё не завершён — нечего возвращать) |
| PAY_ON_PICKUP / UNPAID | Не затрагиваются (денег на счёте нет) |
| Идемпотентность | Ключ `refund-autoclose-${orderId}` — детерминированный, безопасен при повторном вызове |
| Ошибки API | Логируются, обработка продолжается к следующему заказу. Сбойные заказы остаются `PAID` — админ возвращает вручную |
| Миграция БД | **Не нужна** — все поля и enum-значения уже существуют |

---

## 3. Предусловия (уже реализовано)

Перед началом работы убедиться что следующее на месте (всё уже есть в кодовой базе):

| Компонент | Статус | Где |
|-----------|--------|-----|
| `Procurement.minTotalSum` | Есть | `prisma/schema.prisma` |
| `PaymentStatus.REFUNDED` | Есть | `prisma/schema.prisma` |
| `PaymentStatus.FAILED` | Есть | `prisma/schema.prisma` |
| `AuditAction.ONLINE_PAYMENT_REFUNDED` | Есть | `prisma/schema.prisma` |
| `AuditAction.ONLINE_PAYMENT_FAILED` | Есть | `prisma/schema.prisma` |
| `NotificationType.PAYMENT_STATUS_CHANGED` | Есть | `prisma/schema.prisma` |
| `refundsApi` export | Есть | `src/lib/yookassa.js` |
| `writeOrderAudit()` | Есть | `src/lib/audit.js` |
| `createNotification()` | Есть | `src/lib/notifications.js` |
| `getOrdersGoodsTotal()` | Есть | `src/lib/orders.js` |
| `logger` | Есть | `src/lib/logger.js` |
| Ручной `refundPayment()` | Есть | `src/app/admin/procurements/[id]/actions.js:487-573` |
| `closedBecauseMinNotReached` | Есть | `src/lib/procurements/state.js` |

---

## 4. Фазы реализации

### Фаза 1 — Функция автовозврата

> **Промпт для сессии:**  
> `Реализуй Фазу 1 из docs/PRD_AUTO_REFUND.md — создай функцию refundPaidOrdersIfMinNotReached в src/lib/procurements/autoCloseExpired.js. Прочитай PRD и файлы указанные в секции "Файлы для чтения" перед началом.`

#### 4.1.1 Описание

Создать экспортируемую функцию `refundPaidOrdersIfMinNotReached` в файле `src/lib/procurements/autoCloseExpired.js`, рядом с существующей `notifyProcurementClosed()`.

#### 4.1.2 Сигнатура

```js
export async function refundPaidOrdersIfMinNotReached(prisma, procurementId, actorLabel)
```

Возвращает `{ refunded: number, failed: number, pendingCancelled: number }`.

#### 4.1.3 Алгоритм

```
1. procurement = prisma.procurement.findUnique({ id: procurementId, select: { minTotalSum } })
2. if (minTotalSum <= 0) → return { refunded: 0, failed: 0, pendingCancelled: 0 }

3. orders = prisma.order.findMany({
     where: { procurementId, status: "SUBMITTED" },
     select: { id, userId, paymentStatus, yookassaPaymentId, grandTotal,
               items: { select: { qty, price } } }
   })

4. submittedTotal = getOrdersGoodsTotal(orders)
5. if (submittedTotal >= minTotalSum) → return (минимум достигнут, ничего не делаем)

6. paidOrders = orders.filter(o => o.paymentStatus === "PAID" && o.yookassaPaymentId)
7. pendingOrders = orders.filter(o => o.paymentStatus === "PENDING")

8. Для каждого paidOrder:
   a. idempotenceKey = `refund-autoclose-${order.id}`
   b. amountValue = (order.grandTotal / 100).toFixed(2)
   c. try:
        refundsApi.refundsPost(idempotenceKey, {
          payment_id: order.yookassaPaymentId,
          amount: { value: amountValue, currency: "RUB" },
          description: `Автовозврат — минимальная сумма закупки не достигнута`
        })
      catch (err):
        logger.error({ err, op: "autoRefund", orderId: order.id }, "auto-refund failed")
        failCount++
        continue  ← переходим к следующему заказу

   d. prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: "REFUNDED", refundedAt: new Date(), refundAmount: order.grandTotal }
      })

   e. writeOrderAudit({
        actorType: "ADMIN", actorLabel,
        action: "ONLINE_PAYMENT_REFUNDED",
        orderId: order.id, procurementId,
        meta: { refundAmount: order.grandTotal, amountValue, reason: "min_not_reached" }
      })

   f. if (order.userId):
        createNotification({
          userId: order.userId,
          type: "PAYMENT_STATUS_CHANGED",
          title: "Возврат средств",
          body: `Минимальная сумма закупки не была достигнута. Оплата ${amountValue} ₽ возвращена.`,
          linkUrl: `/my/orders/${order.id}`
        })

   g. refundedCount++

9. Для каждого pendingOrder:
   a. prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: "FAILED" }
      })

   b. writeOrderAudit({
        actorType: "ADMIN", actorLabel,
        action: "ONLINE_PAYMENT_FAILED",
        orderId: order.id, procurementId,
        meta: { reason: "min_not_reached_procurement_closed" }
      })

   c. if (order.userId):
        createNotification({
          userId: order.userId,
          type: "PAYMENT_STATUS_CHANGED",
          title: "Оплата отменена",
          body: "Минимальная сумма закупки не была достигнута. Платёж отменён.",
          linkUrl: `/my/orders/${order.id}`
        })

   d. pendingCancelledCount++

10. logger.info({ op: "autoRefund", procurementId, refunded, failed, pendingCancelled }, "auto-refund complete")
11. return { refunded, failed, pendingCancelled }
```

#### 4.1.4 Новые импорты в файле

Файл `src/lib/procurements/autoCloseExpired.js` — текущие импорты:

```js
import { createNotificationsMany } from "@/lib/notifications";
import { writeProcurementAudit } from "@/lib/audit";
```

Добавить:

```js
import { refundsApi } from "@/lib/yookassa";
import { writeOrderAudit } from "@/lib/audit";           // в тот же import из @/lib/audit
import { createNotification } from "@/lib/notifications"; // в тот же import из @/lib/notifications
import { getOrdersGoodsTotal } from "@/lib/orders";
import { logger } from "@/lib/logger";
```

Итого импорты станут:

```js
import { createNotificationsMany, createNotification } from "@/lib/notifications";
import { writeProcurementAudit, writeOrderAudit } from "@/lib/audit";
import { refundsApi } from "@/lib/yookassa";
import { getOrdersGoodsTotal } from "@/lib/orders";
import { logger } from "@/lib/logger";
```

#### 4.1.5 Паттерн для копирования

Логика вызова `refundsApi.refundsPost()` и обновления Order повторяет существующий `refundPayment()` в `src/app/admin/procurements/[id]/actions.js:524-544`. Ключевые отличия:

| | Ручной `refundPayment` | Автоматический `refundPaidOrdersIfMinNotReached` |
|---|---|---|
| Idempotence key | `refund-${orderId}-${Date.now()}` | `refund-autoclose-${orderId}` (детерминированный) |
| Сумма | Из FormData | `order.grandTotal` (полный возврат) |
| При ошибке API | `return { ok: false }` (прерывание) | `logger.error()` + `continue` (продолжение) |
| Аудит meta | `{ refundAmount, amountValue, yookassaPaymentId }` | `+ reason: "min_not_reached"` |

#### 4.1.6 Файлы для чтения

| Файл | Зачем |
|------|-------|
| `src/lib/procurements/autoCloseExpired.js` | Куда добавляем функцию |
| `src/app/admin/procurements/[id]/actions.js:487-573` | Образец `refundPayment()` |
| `src/lib/yookassa.js` | API — `refundsApi.refundsPost()` |
| `src/lib/orders.js` | `getOrdersGoodsTotal()` — сигнатура и что ожидает |
| `src/lib/audit.js` | `writeOrderAudit()` — сигнатура |
| `src/lib/notifications.js` | `createNotification()` — сигнатура |

#### 4.1.7 Проверка фазы

```bash
npx vitest run
```

Существующие тесты должны пройти без изменений (новая функция добавлена, но ещё нигде не вызывается).

---

### Фаза 2 — Интеграция в оба пути закрытия

> **Промпт для сессии:**  
> `Реализуй Фазу 2 из docs/PRD_AUTO_REFUND.md — подключи refundPaidOrdersIfMinNotReached в closeProcurement и autoCloseExpiredProcurements. Прочитай PRD и файлы указанные в секции "Файлы для чтения" перед началом.`

#### 4.2.1 Интеграция в `autoCloseExpiredProcurements()`

**Файл:** `src/lib/procurements/autoCloseExpired.js`

В цикле `for (const p of expired)` (текущие строки 40-53), **после** аудита и **перед** `notifyProcurementClosed`, добавить вызов:

**Текущий код:**

```js
for (const p of expired) {
  await prisma.procurement.update({ where: { id: p.id }, data: { status: "CLOSED" } });
  await writeProcurementAudit({ ... });
  await notifyProcurementClosed(prisma, p.id, p.title);        // ← было последним
}
```

**Новый код:**

```js
for (const p of expired) {
  await prisma.procurement.update({ where: { id: p.id }, data: { status: "CLOSED" } });
  await writeProcurementAudit({ ... });
  await refundPaidOrdersIfMinNotReached(prisma, p.id, "system");  // ← НОВОЕ
  await notifyProcurementClosed(prisma, p.id, p.title);
}
```

Новых импортов не нужно — функция в том же файле.

#### 4.2.2 Интеграция в `closeProcurement()`

**Файл:** `src/app/admin/procurements/actions.js`

**Текущий код (строки ~195-205):**

```js
await writeProcurementAudit({
  actorType: "ADMIN",
  actorLabel,
  action: "CLOSE_PROCUREMENT",
  procurementId: id,
});

await notifyProcurementClosed(prisma, id, procurement.title);

revalidatePath("/admin/procurements");
return { ok: true, message: "Закупка закрыта." };
```

**Новый код:**

```js
await writeProcurementAudit({
  actorType: "ADMIN",
  actorLabel,
  action: "CLOSE_PROCUREMENT",
  procurementId: id,
});

await refundPaidOrdersIfMinNotReached(prisma, id, actorLabel);   // ← НОВОЕ

await notifyProcurementClosed(prisma, id, procurement.title);

revalidatePath("/admin/procurements");
return { ok: true, message: "Закупка закрыта." };
```

**Новый импорт** — в строке 7 уже есть:

```js
import { notifyProcurementClosed } from "@/lib/procurements/autoCloseExpired";
```

Изменить на:

```js
import { notifyProcurementClosed, refundPaidOrdersIfMinNotReached } from "@/lib/procurements/autoCloseExpired";
```

#### 4.2.3 Файлы для чтения

| Файл | Зачем |
|------|-------|
| `src/lib/procurements/autoCloseExpired.js` | Добавить вызов в цикл |
| `src/app/admin/procurements/actions.js` | Добавить вызов + импорт в `closeProcurement()` |

#### 4.2.4 Проверка фазы

```bash
npx vitest run
```

Существующие тесты `autoCloseExpired.test.js` **могут упасть** — функция `autoCloseExpiredProcurements()` теперь вызывает `refundPaidOrdersIfMinNotReached()`, которая обращается к новым зависимостям (`refundsApi`, `writeOrderAudit` и т.д.). Нужно добавить моки для них. Это решается в Фазе 3, но если тесты падают — добавить минимальные заглушки:

```js
vi.mock("@/lib/yookassa", () => ({ refundsApi: { refundsPost: vi.fn() } }));
vi.mock("@/lib/orders", () => ({ getOrdersGoodsTotal: vi.fn().mockReturnValue(0) }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
```

И расширить `makePrisma()`:

```js
function makePrisma() {
  return {
    procurement: { findMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    order: { findMany: vi.fn(), update: vi.fn() },
  };
}
```

Дополнить мок `@/lib/audit`:

```js
vi.mock("@/lib/audit", () => ({
  writeProcurementAudit: mockWriteProcurementAudit,
  writeOrderAudit: vi.fn(),
}));
```

Дополнить мок `@/lib/notifications`:

```js
vi.mock("@/lib/notifications", () => ({
  createNotificationsMany: mockCreateNotificationsMany,
  createNotification: vi.fn(),
}));
```

Обеспечить что `procurement.findUnique` возвращает `{ minTotalSum: 0 }` в существующих тестах (чтобы рефанд пропускался):

```js
prisma.procurement.findUnique.mockResolvedValue({ minTotalSum: 0 });
```

---

### Фаза 3 — Тесты автовозврата

> **Промпт для сессии:**  
> `Реализуй Фазу 3 из docs/PRD_AUTO_REFUND.md — напиши тесты для refundPaidOrdersIfMinNotReached в src/__tests__/lib/autoCloseExpired.test.js. Прочитай PRD и файлы указанные в секции "Файлы для чтения" перед началом.`

#### 4.3.1 Новый describe-блок

Добавить `describe("refundPaidOrdersIfMinNotReached()")` в `src/__tests__/lib/autoCloseExpired.test.js`.

Импортировать функцию:

```js
import {
  autoCloseExpiredProcurements,
  notifyProcurementClosed,
  refundPaidOrdersIfMinNotReached,    // ← НОВОЕ
} from "@/lib/procurements/autoCloseExpired";
```

#### 4.3.2 Необходимые моки

Если не добавлены в Фазе 2, добавить в hoisted-блок и vi.mock:

```js
const { ..., mockRefundsPost, mockWriteOrderAudit, mockCreateNotification, mockGetOrdersGoodsTotal, mockLogger } = vi.hoisted(() => ({
  ...,
  mockRefundsPost: vi.fn(),
  mockWriteOrderAudit: vi.fn(),
  mockCreateNotification: vi.fn(),
  mockGetOrdersGoodsTotal: vi.fn(),
  mockLogger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/yookassa", () => ({
  refundsApi: { refundsPost: mockRefundsPost },
}));

vi.mock("@/lib/audit", () => ({
  writeProcurementAudit: mockWriteProcurementAudit,
  writeOrderAudit: mockWriteOrderAudit,
}));

vi.mock("@/lib/notifications", () => ({
  createNotificationsMany: mockCreateNotificationsMany,
  createNotification: mockCreateNotification,
}));

vi.mock("@/lib/orders", () => ({
  getOrdersGoodsTotal: mockGetOrdersGoodsTotal,
}));

vi.mock("@/lib/logger", () => ({
  logger: mockLogger,
}));
```

Расширить `makePrisma()`:

```js
function makePrisma() {
  return {
    procurement: { findMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    order: { findMany: vi.fn(), update: vi.fn() },
  };
}
```

#### 4.3.3 Тест-кейсы

**Тест 1: "returns early when minTotalSum is 0"**

```
Setup:   procurement.findUnique → { minTotalSum: 0 }
Expect:  refundsApi.refundsPost NOT called
         result = { refunded: 0, failed: 0, pendingCancelled: 0 }
```

**Тест 2: "returns early when submittedTotal >= minTotalSum"**

```
Setup:   procurement.findUnique → { minTotalSum: 5000 }
         order.findMany → [{ paymentStatus: "PAID", ... }]
         getOrdersGoodsTotal → 6000
Expect:  refundsApi.refundsPost NOT called
```

**Тест 3: "refunds PAID orders when min not reached"**

```
Setup:   procurement.findUnique → { minTotalSum: 10000 }
         order.findMany → [
           { id: "o1", paymentStatus: "PAID", yookassaPaymentId: "yk-1", grandTotal: 3000, userId: "u1" }
         ]
         getOrdersGoodsTotal → 3000
         refundsApi.refundsPost → resolves
Expect:  refundsApi.refundsPost called with ("refund-autoclose-o1", { payment_id: "yk-1", amount: { value: "30.00", currency: "RUB" }, ... })
         order.update called with { paymentStatus: "REFUNDED", refundedAt: expect.any(Date), refundAmount: 3000 }
         writeOrderAudit called with { action: "ONLINE_PAYMENT_REFUNDED", orderId: "o1", meta containing reason: "min_not_reached" }
         createNotification called with { userId: "u1", type: "PAYMENT_STATUS_CHANGED", title: "Возврат средств" }
         result.refunded = 1
```

**Тест 4: "marks PENDING orders as FAILED"**

```
Setup:   procurement.findUnique → { minTotalSum: 10000 }
         order.findMany → [
           { id: "o2", paymentStatus: "PENDING", yookassaPaymentId: "yk-2", grandTotal: 2000, userId: "u2" }
         ]
         getOrdersGoodsTotal → 2000
Expect:  refundsApi.refundsPost NOT called (PENDING, не PAID)
         order.update called with { paymentStatus: "FAILED" }
         writeOrderAudit called with { action: "ONLINE_PAYMENT_FAILED" }
         result.pendingCancelled = 1
```

**Тест 5: "continues processing when one refund fails"**

```
Setup:   procurement.findUnique → { minTotalSum: 10000 }
         order.findMany → [
           { id: "o1", paymentStatus: "PAID", yookassaPaymentId: "yk-1", grandTotal: 1000, userId: "u1" },
           { id: "o2", paymentStatus: "PAID", yookassaPaymentId: "yk-2", grandTotal: 2000, userId: "u2" },
         ]
         getOrdersGoodsTotal → 3000
         refundsApi.refundsPost → rejects on 1st call, resolves on 2nd
Expect:  order.update called once (only for o2)
         logger.error called once (for o1)
         result = { refunded: 1, failed: 1, pendingCancelled: 0 }
```

**Тест 6: "skips PAID orders without yookassaPaymentId"**

```
Setup:   order with paymentStatus: "PAID" but yookassaPaymentId: null
Expect:  refundsApi.refundsPost NOT called for this order
```

#### 4.3.4 Обновить существующие тесты `autoCloseExpiredProcurements()`

Существующие тесты должны мокать `procurement.findUnique` чтобы `refundPaidOrdersIfMinNotReached` не падала:

```js
prisma.procurement.findUnique.mockResolvedValue({ minTotalSum: 0 });
```

Это обеспечит ранний return из функции рефанда и не повлияет на логику существующих тестов.

#### 4.3.5 Файлы для чтения

| Файл | Зачем |
|------|-------|
| `src/__tests__/lib/autoCloseExpired.test.js` | Существующие тесты и паттерны моков |
| `src/lib/procurements/autoCloseExpired.js` | Тестируемая функция |
| `src/lib/orders.js` | Понять что мокать для `getOrdersGoodsTotal` |

#### 4.3.6 Проверка фазы

```bash
npx vitest run
```

Все тесты (старые + новые) должны проходить.

---

## 5. Безопасность

| Мера | Реализация |
|------|-----------|
| Идемпотентность рефанда | Ключ `refund-autoclose-${orderId}` — ЮKassa не создаст дубликат |
| Сумма из БД | `order.grandTotal` берётся из БД, не из клиента |
| Ошибка API не блокирует | `try/catch` + `continue` — остальные заказы обрабатываются |
| RBAC | Вызывается только из `closeProcurement()` (ADMIN/OPERATOR) или `autoClose` (system) |
| Аудит | Каждый возврат логируется в AuditLog с `reason: "min_not_reached"` |

---

## 6. Затрагиваемые файлы (сводка)

| Файл | Фаза | Изменение |
|------|------|-----------|
| `src/lib/procurements/autoCloseExpired.js` | 1, 2 | + функция `refundPaidOrdersIfMinNotReached()` + вызов в цикле `autoCloseExpiredProcurements()` |
| `src/app/admin/procurements/actions.js` | 2 | + вызов в `closeProcurement()`, + импорт |
| `src/__tests__/lib/autoCloseExpired.test.js` | 3 | + моки для yookassa/orders/logger, + 6 тестов, + фикс существующих тестов |

**Новых файлов не создаётся. Миграции БД не нужна. Зависимости npm не добавляются.**

---

## 7. Известные ограничения

| Ограничение | Описание | Решение |
|-------------|----------|---------|
| Race condition с PENDING | Если платёж в статусе PENDING на момент закрытия — мы ставим FAILED, но webhook `payment.succeeded` может прийти позже и перезаписать статус на PAID | Для MVP/диплома допустимо. В продакшене: добавить проверку `procurement.status` в webhook handler |
| Частичный сбор | Если API вернул ошибку для части заказов — они останутся PAID | Админ видит их в интерфейсе и может вернуть вручную через существующую кнопку |
| Нет частичного возврата | Автоматический возврат всегда полный (`grandTotal`) | Частичный возврат остаётся ручной операцией через `refundPayment()` |

---

## 8. Как объяснить на защите диплома

> «Система поддерживает минимальную сумму закупки (`minTotalSum`). Пока закупка открыта, участники видят прогресс сбора в реальном времени. Если по истечении дедлайна минимальная сумма не достигнута — система автоматически инициирует возврат средств всем оплатившим через ЮKassa. Каждый возврат логируется в журнале аудита, а резиденты получают уведомление. При сбое API конкретного возврата — обработка продолжается, а проблемный заказ остаётся для ручного возврата администратором. Это обеспечивает безопасность средств участников без необходимости ручного вмешательства в штатном сценарии.»

**Возможные вопросы комиссии:**

| Вопрос | Ответ |
|--------|-------|
| «А если ЮKassa недоступна?» | Ошибки логируются, заказ остаётся PAID. Админ видит его и может повторить возврат вручную через интерфейс. Это стандартная практика graceful degradation. |
| «А если кто-то оплатил наличными?» | Заказы с `PAY_ON_PICKUP` не имеют `yookassaPaymentId` — автовозврат их не затрагивает. Организатор решает сам. |
| «Зачем minTotalSum, если можно просто закупать?» | `minTotalSum` — это ограничение поставщика (минимальная партия). Система транслирует его участникам через прогресс-бар, мотивируя набрать необходимую сумму. Если не набрали — закупка нерентабельна, деньги возвращаются. |
| «Почему не блокируете закрытие, пока есть PENDING платежи?» | В тестовом/MVP-режиме это допустимый компромисс. В продакшене можно добавить проверку и задержку закрытия до завершения всех платежей. |

---

## 9. Диаграмма потока

```
closeProcurement() / autoCloseExpired()
  │
  ├── procurement.status = "CLOSED"
  ├── writeProcurementAudit()
  │
  ├── refundPaidOrdersIfMinNotReached(prisma, id, actorLabel)
  │     │
  │     ├── minTotalSum <= 0? ──→ return (нет минимума)
  │     ├── submittedTotal >= minTotalSum? ──→ return (минимум достигнут)
  │     │
  │     ├── Для каждого PAID + yookassaPaymentId:
  │     │     ├── refundsApi.refundsPost()
  │     │     │     ├── OK  → order.paymentStatus = REFUNDED
  │     │     │     │         writeOrderAudit(ONLINE_PAYMENT_REFUNDED)
  │     │     │     │         createNotification("Возврат средств")
  │     │     │     └── ERR → logger.error(), continue
  │     │     └──
  │     │
  │     └── Для каждого PENDING:
  │           ├── order.paymentStatus = FAILED
  │           ├── writeOrderAudit(ONLINE_PAYMENT_FAILED)
  │           └── createNotification("Оплата отменена")
  │
  └── notifyProcurementClosed() (остальные участники)
```
