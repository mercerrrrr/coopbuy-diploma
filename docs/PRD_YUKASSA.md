# PRD: Интеграция ЮKassa — онлайн-оплата заказов

> **Версия:** 1.0  
> **Дата:** 2026-04-12  
> **Проект:** CoopBuy Diploma  
> **Стек:** Next.js 16 (App Router) + Prisma 7 + PostgreSQL

---

## 1. Цель

Добавить возможность онлайн-оплаты заказов через ЮKassa (YooKassa).  
Резидент после оформления заказа может оплатить его картой/СБП/ЮMoney прямо из интерфейса, а система автоматически подтвердит оплату через webhook.

**Текущее состояние:** оплата отслеживается вручную — админ нажимает кнопки PAID / PAY_ON_PICKUP.  
**Целевое состояние:** резидент платит онлайн → webhook обновляет `paymentStatus` → админ видит факт оплаты; ручной режим сохраняется как fallback.

---

## 2. Ключевые решения

| Вопрос | Решение |
|--------|---------|
| SDK | `@yookassa/sdk` (официальный Node.js SDK) |
| Метод приёма | **Платёж с редиректом** — создаём Payment, получаем `confirmation.confirmation_url`, отправляем пользователя туда |
| Webhook | POST `/api/webhooks/yookassa` — принимает `payment.succeeded` / `payment.canceled` |
| Идемпотентность | `idempotenceKey` = `order-${orderId}-${attempt}` (attempt хранится в Order) |
| Валюта | RUB (копейки → рубли при отправке в API: `grandTotal / 100` → `"amount.value"`) |
| Хранение ключей | `.env.local`: `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `YOOKASSA_WEBHOOK_SECRET` |

---

## 3. Фазы реализации

### Фаза 1 — Базовая интеграция (создание платежа + webhook)

**Цель:** резидент может оплатить заказ онлайн, статус обновляется автоматически.

#### 3.1.1 Схема БД (миграция `yukassa_payments`)

```prisma
// Новые поля в Order
model Order {
  // ... существующие поля ...
  yookassaPaymentId  String?          // ID платежа в ЮKassa (например "2d9f1b3a-...")
  paymentAttempt     Int     @default(0) // Счётчик попыток (для idempotenceKey)
}

// Новый enum-значение
enum PaymentStatus {
  UNPAID
  PAID
  PAY_ON_PICKUP
  PENDING        // <-- новое: платёж создан, ожидаем подтверждения
  FAILED         // <-- новое: платёж отклонён/отменён
}
```

**Индекс:**
```prisma
@@index([yookassaPaymentId])
```

#### 3.1.2 Серверный модуль `src/lib/yookassa.js`

```js
// Инициализация SDK
import { YooCheckout } from "@yookassa/sdk";

const checkout = new YooCheckout({
  shopId: process.env.YOOKASSA_SHOP_ID,
  secretKey: process.env.YOOKASSA_SECRET_KEY,
});

export { checkout };
```

#### 3.1.3 Server Action: `createPayment`

**Файл:** `src/app/my/orders/[orderId]/actions.js`

Логика:
1. `getSession()` — проверить авторизацию (RESIDENT)
2. Загрузить Order с `procurement.title`
3. Проверить: `order.userId === session.id`, `order.status === "SUBMITTED"`, `paymentStatus` in `["UNPAID", "FAILED"]`
4. Инкрементировать `paymentAttempt`
5. Вызвать `checkout.createPayment(...)`:
   ```js
   {
     amount: { value: (order.grandTotal / 100).toFixed(2), currency: "RUB" },
     confirmation: {
       type: "redirect",
       return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/my/orders/${orderId}?payment=pending`
     },
     capture: true,  // автоматический capture
     description: `CoopBuy: ${procurement.title} — заказ ${orderId.slice(-6)}`,
     metadata: { orderId },
   }
   ```
6. Обновить Order: `yookassaPaymentId`, `paymentStatus: "PENDING"`, `paymentAttempt`
7. Redirect на `confirmation.confirmation_url`

#### 3.1.4 Webhook: `POST /api/webhooks/yookassa`

**Файл:** `src/app/api/webhooks/yookassa/route.js`

Логика:
1. Прочитать body, проверить IP-адрес ЮKassa (whitelist: `185.71.76.0/27`, `185.71.77.0/27`, `77.75.153.0/25`, `77.75.156.11`, `77.75.156.35`)
2. Распарсить `event`:
   - `payment.succeeded` → найти Order по `metadata.orderId`, обновить: `paymentStatus: "PAID"`, `paidAt: new Date()`, `paymentMethod: "ЮKassa онлайн"`
   - `payment.canceled` → найти Order, обновить: `paymentStatus: "FAILED"`
3. Создать AuditLog: `ONLINE_PAYMENT_SUCCEEDED` / `ONLINE_PAYMENT_FAILED`
4. Создать Notification резиденту
5. Ответить `200 OK`

**Важно:** webhook должен быть идемпотентным — если `paymentStatus` уже `PAID`, пропускаем.

#### 3.1.5 UI: кнопка «Оплатить онлайн»

**Файл:** `src/app/my/orders/[orderId]/page.jsx`

- Показывать кнопку «Оплатить онлайн» если `paymentStatus` in `["UNPAID", "FAILED"]`
- При `PENDING` — показывать индикатор «Ожидание оплаты...» + ссылку «Повторить»
- При `PAID` — зелёный бейдж, кнопка скрыта
- При `PAY_ON_PICKUP` — кнопка скрыта (админ вручную назначил наличку)
- При `FAILED` — красный бейдж «Оплата не прошла» + кнопка «Попробовать снова»

**Страница `/my/orders` (список):**
- Бейдж `PENDING` — жёлтый, «Ожидание оплаты»
- Бейдж `FAILED` — красный, «Оплата не прошла»

#### 3.1.6 Обновление `constants.js`

```js
PAYMENT_LABELS = {
  UNPAID:         "Не оплачено",
  PAID:           "Оплачено",
  PAY_ON_PICKUP:  "Оплата при выдаче",
  PENDING:        "Ожидание оплаты",
  FAILED:         "Оплата не прошла",
};

PAYMENT_BADGE_VARIANTS = {
  UNPAID:         "danger",
  PAID:           "success",
  PAY_ON_PICKUP:  "info",
  PENDING:        "warning",
  FAILED:         "danger",
};

PAYMENT_STATUS_TRANSITIONS = {
  UNPAID:         ["PAID", "PAY_ON_PICKUP"],
  PAY_ON_PICKUP:  ["PAID", "UNPAID"],
  PAID:           [],
  PENDING:        ["PAID", "FAILED", "UNPAID"],   // админ может вручную разрешить
  FAILED:         ["PAID", "PAY_ON_PICKUP", "UNPAID"],
};
```

#### 3.1.7 Обновление админки

- В `OrdersSearchTable.jsx`: показывать `PENDING` / `FAILED` бейджи
- Админ по-прежнему может переключать статус вручную (fallback)
- В `payments.xlsx`: добавить столбец `yookassaPaymentId` (если есть)

#### 3.1.8 Обновление receipt.pdf

- Если `paymentMethod === "ЮKassa онлайн"` — показать ID платежа ЮKassa
- Статус `PENDING` / `FAILED` отображать корректно

#### 3.1.9 Новые AuditAction

```prisma
enum AuditAction {
  // ... существующие ...
  ONLINE_PAYMENT_CREATED
  ONLINE_PAYMENT_SUCCEEDED
  ONLINE_PAYMENT_FAILED
}
```

---

### Фаза 2 — Возвраты (refunds)

**Цель:** админ может сделать полный/частичный возврат из интерфейса.

#### 3.2.1 Server Action: `refundPayment`

**Файл:** `src/app/admin/procurements/[id]/actions.js`

Логика:
1. Проверить роль ADMIN
2. Загрузить Order, проверить `paymentStatus === "PAID"` и `yookassaPaymentId` не null
3. Вызвать `checkout.createRefund(...)`:
   ```js
   {
     payment_id: order.yookassaPaymentId,
     amount: { value: (refundAmount / 100).toFixed(2), currency: "RUB" },
   }
   ```
4. Обновить Order: `paymentStatus: "REFUNDED"`, `refundedAt: new Date()`
5. AuditLog: `ONLINE_PAYMENT_REFUNDED`
6. Notification резиденту: «Возврат средств: ₽...»

#### 3.2.2 Схема БД

```prisma
enum PaymentStatus {
  // ... фаза 1 ...
  REFUNDED       // <-- новое
}

model Order {
  // ... фаза 1 ...
  refundedAt     DateTime?
  refundAmount   Int?        // сумма возврата в копейках
}
```

#### 3.2.3 UI: кнопка «Возврат» в админке

- Показывать рядом с заказами со статусом `PAID` + `yookassaPaymentId`
- Модальное окно подтверждения с суммой
- После успеха — бейдж «Возвращено» (фиолетовый)

---

### Фаза 3 — Оплата из корзины (pay-on-submit)

**Цель:** резидент может оплатить сразу при оформлении заказа, не заходя в «Мои заказы».

#### 3.3.1 Изменение `submitOrder`

После создания заказа (status: SUBMITTED):
1. Если пользователь выбрал «Оплатить онлайн» — сразу вызвать `createPayment`
2. Redirect на ЮKassa
3. `return_url` → `/my/orders/${orderId}?payment=pending`

#### 3.3.2 UI: радио-выбор способа оплаты

В форме подтверждения заказа (`/p/[code]`):
- **Оплатить онлайн** (карта / СБП / ЮMoney) — default
- **Оплата при получении** → `PAY_ON_PICKUP`

#### 3.3.3 Анимация ожидания

- После redirect назад → показывать skeleton + polling статуса
- Когда webhook придёт и статус станет PAID → зелёная галочка с анимацией

---

### Фаза 4 — Автоматические чеки (54-ФЗ)

**Цель:** ЮKassa отправляет чеки автоматически (для соответствия 54-ФЗ).

#### 3.4.1 Данные чека в `createPayment`

```js
receipt: {
  customer: {
    email: session.email,
    phone: order.participantPhone,
  },
  items: orderItems.map(item => ({
    description: item.product.name,
    quantity: String(item.quantity),
    amount: {
      value: (item.price / 100).toFixed(2),
      currency: "RUB",
    },
    vat_code: 1,  // без НДС (для кооперативной закупки)
    payment_subject: "commodity",
    payment_mode: "full_payment",
  })),
  // + строка доставки если deliveryShare > 0
}
```

#### 3.4.2 Требования

- Необходим договор с ЮKassa на онлайн-кассу
- Настроить `vat_code` в зависимости от налогообложения кооператива
- Для тестового режима чеки не отправляются — достаточно передать объект `receipt`

---

## 4. Переменные окружения

```env
# ЮKassa
YOOKASSA_SHOP_ID=123456          # ID магазина
YOOKASSA_SECRET_KEY=test_...     # Секретный ключ
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # Для return_url

# Продакшн
# YOOKASSA_SECRET_KEY=live_...
```

---

## 5. Безопасность

| Мера | Реализация |
|------|-----------|
| Webhook-аутентификация | Проверка IP-адреса ЮKassa (whitelist) |
| Идемпотентность | `idempotenceKey` на каждый платёж, проверка статуса перед обновлением |
| Защита от переплаты | `amount` берётся из БД (`grandTotal`), а не из клиента |
| CSRF | Server Actions Next.js (встроенная защита) |
| Секреты | Только серверные env, не `NEXT_PUBLIC_` |
| Аудит | Все действия логируются в AuditLog |

---

## 6. Затрагиваемые файлы

### Новые файлы
| Файл | Назначение |
|------|-----------|
| `src/lib/yookassa.js` | SDK-инстанс |
| `src/app/api/webhooks/yookassa/route.js` | Webhook endpoint |
| `src/app/my/orders/[orderId]/actions.js` | `createPayment` action |
| `prisma/migrations/.../migration.sql` | Миграция |

### Изменяемые файлы
| Файл | Что меняется |
|------|-------------|
| `prisma/schema.prisma` | Order: +3 поля, PaymentStatus: +2 значения, AuditAction: +3 |
| `src/lib/constants.js` | PAYMENT_LABELS, BADGE_VARIANTS, TRANSITIONS |
| `src/app/my/orders/[orderId]/page.jsx` | Кнопка «Оплатить онлайн», статусы PENDING/FAILED |
| `src/app/my/orders/page.jsx` | Бейджи новых статусов |
| `src/app/my/orders/[orderId]/receipt.pdf/route.js` | ID платежа ЮKassa |
| `src/app/admin/procurements/[id]/page.jsx` | Бейджи + кнопка возврата (фаза 2) |
| `src/app/admin/procurements/[id]/OrdersSearchTable.jsx` | Новые статусы |
| `src/app/admin/procurements/[id]/payments.xlsx/route.js` | Столбец yookassaPaymentId |
| `src/app/p/[code]/actions.js` | Выбор способа оплаты (фаза 3) |
| `package.json` | `@yookassa/sdk` |

---

## 7. Тестирование

### 7.1 Юнит-тесты (Vitest)

- `createPayment`: mock SDK, проверить формирование amount, idempotenceKey, redirect
- Webhook handler: mock body с `payment.succeeded` / `payment.canceled`, проверить обновление Order
- Transitions: UNPAID→PENDING→PAID, UNPAID→PENDING→FAILED→UNPAID (retry)

### 7.2 Интеграционные тесты

- E2E: submit order → pay → webhook → check PAID status
- Идемпотентность: дважды отправить один webhook → Order обновлён один раз
- IP-фильтрация: запрос с чужого IP → 403

---

## 8. Как тестировать бесплатно (тестовый режим ЮKassa)

### 8.1 Получение тестовых ключей

1. Перейти на [yookassa.ru](https://yookassa.ru) → «Подключить»
2. Зарегистрироваться (нужен email и телефон, **юр. лицо НЕ нужно** для тестового режима)
3. Попасть в личный кабинет → раздел **«Интеграция»** → **«Ключи API»**
4. Там будут:
   - `shopId` — числовой ID магазина
   - **Тестовый секретный ключ** — начинается с `test_...`
5. Скопировать оба в `.env.local`

> **Деньги НЕ списываются.** Тестовый режим полностью бесплатный, без договора и юрлица.

### 8.2 Тестовые карты ЮKassa

| Номер карты | Результат |
|-------------|-----------|
| `5555 5555 5555 4477` | **Успешная оплата** |
| `5555 5555 5555 4444` | **Отказ** (insufficient funds) |
| `5555 5555 5555 4002` | **3D-Secure** → затем успех |

- Срок действия: любой в будущем (напр. `12/28`)
- CVC: любые 3 цифры (напр. `123`)

### 8.3 Тестирование webhook-ов локально

В тестовом режиме ЮKassa **не отправляет webhooks на localhost**. Варианты:

**Вариант А — ngrok (рекомендуется):**
```bash
# Установить ngrok: https://ngrok.com (бесплатный план)
ngrok http 3000

# Получить URL вида https://abc123.ngrok-free.app
# В ЛК ЮKassa → Интеграция → HTTP-уведомления:
#   URL: https://abc123.ngrok-free.app/api/webhooks/yookassa
#   Событие: payment.succeeded, payment.canceled
```

**Вариант Б — ручная эмуляция:**
```bash
# Имитировать webhook локально:
curl -X POST http://localhost:3000/api/webhooks/yookassa \
  -H "Content-Type: application/json" \
  -d '{
    "type": "notification",
    "event": "payment.succeeded",
    "object": {
      "id": "test-payment-id",
      "status": "succeeded",
      "amount": { "value": "150.00", "currency": "RUB" },
      "metadata": { "orderId": "YOUR_ORDER_ID" }
    }
  }'
```

> В тестовом режиме IP-фильтрацию можно отключить через env-переменную `YOOKASSA_SKIP_IP_CHECK=true`.

### 8.4 Полный цикл тестирования

```
1. npm run dev
2. Зарегистрироваться как RESIDENT, оформить заказ
3. Нажать «Оплатить онлайн»
4. Перейти на страницу ЮKassa (тестовую)
5. Ввести тестовую карту 5555 5555 5555 4477
6. Подтвердить → redirect обратно на /my/orders/[id]?payment=pending
7. Webhook придёт (через ngrok) → статус обновится на PAID
8. Проверить: бейдж зелёный, receipt.pdf содержит «Оплачено», 
   payments.xlsx содержит ID платежа, аудит-лог записан
```

---

## 9. Зависимости

```json
{
  "@yookassa/sdk": "^2.x"
}
```

Установка:
```bash
npm install @yookassa/sdk
```

---

## 10. Метрики успеха

| Метрика | Целевое значение |
|---------|-----------------|
| Время от нажатия «Оплатить» до redirect | < 2 с |
| Время обработки webhook | < 500 мс |
| Конверсия оплат (PENDING → PAID) | > 85% |
| Ручных подтверждений после внедрения | < 20% от всех заказов |

---

## 11. Риски

| Риск | Митигация |
|------|----------|
| Webhook не дошёл | Cron-задача проверяет PENDING заказы старше 30 мин через `checkout.getPayment()` |
| Двойной платёж | `idempotenceKey` + проверка `paymentStatus !== "PENDING"` перед созданием |
| ЮKassa недоступна | Fallback: ручное подтверждение админом (существующий flow) |
| Несовпадение суммы | `amount` всегда из `order.grandTotal`, не из клиента |
