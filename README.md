# CoopBuy

Информационная система для организации совместных закупок в рамках одного региона с несколькими населёнными пунктами и пунктами выдачи.

---

## Оглавление

1. [Назначение и предметная область](#назначение-и-предметная-область)
2. [Функциональные возможности](#функциональные-возможности)
3. [Архитектура и стек технологий](#архитектура-и-стек-технологий)
4. [Структура проекта](#структура-проекта)
5. [Модель данных (полная)](#модель-данных-полная)
6. [Ролевая модель и авторизация](#ролевая-модель-и-авторизация)
7. [Бизнес-логика (подробно)](#бизнес-логика-подробно)
8. [Страницы и UI](#страницы-и-ui)
9. [Серверные действия (Server Actions)](#серверные-действия-server-actions)
10. [API-эндпоинты](#api-эндпоинты)
11. [Экспорт документов](#экспорт-документов)
12. [Компоненты UI](#компоненты-ui)
13. [Библиотека (`src/lib/`)](#библиотека-srclib)
14. [Тестирование](#тестирование)
15. [Seed-данные](#seed-данные)
16. [Развёртывание](#развёртывание)
17. [Запуск для разработки](#запуск-для-разработки)
18. [Переменные окружения](#переменные-окружения)
19. [Тестовые учётные записи](#тестовые-учётные-записи)

---

## Назначение и предметная область

Система «CoopBuy» автоматизирует процесс совместных закупок для жителей населённых пунктов, объединённых в регион. Основные сущности предметной области:

- **Регион (Region)** — верхний уровень территориального деления (например, район).
- **Населённый пункт (Settlement)** — входит в регион; к нему привязаны жители и поставщики.
- **Пункт выдачи (PickupPoint)** — физический адрес выдачи товаров в рамках населённого пункта; может иметь морозильник.
- **Поставщик (Supplier)** — организация-поставщик с каталогом товаров, минимальной суммой заказа и зонами доставки.
- **Товар (Product)** — позиция каталога с ценой, категорией, единицей измерения, SKU.
- **Категория (Category)** / **Единица измерения (Unit)** — справочники для товаров.
- **Закупка (Procurement)** — событие совместной закупки: привязано к поставщику, населённому пункту и пункту выдачи; имеет дедлайн, статус, инвайт-ссылку, стоимость доставки.
- **Заказ (Order)** — заявка жителя в рамках закупки; содержит позиции, суммы, статус оплаты.
- **Позиция заказа (OrderItem)** — товар, количество и цена на момент заказа.
- **Акт приёмки (ReceivingReport / ReceivingLine)** — фиксация фактического получения товара от поставщика.
- **Сессия выдачи (PickupSession)** / **Чекин (PickupCheckin)** — процесс выдачи заказов жителям с фиксацией факта получения.
- **Пользователь (User)** — участник системы с одной из трёх ролей.
- **Уведомление (Notification)** — in-app уведомление для жителя.
- **Журнал аудита (AuditLog)** — запись каждого значимого действия.

Система решает задачи: формирование каталога, приём заявок, расчёт стоимости доставки, контроль оплаты (включая онлайн через ЮKassa), приёмка товара, выдача по QR-коду/коду получения, аналитика и отчётность с экспортом в PDF/XLSX/CSV.

---

## Функциональные возможности

### Для администратора (ADMIN)
- Управление территориальной структурой (регионы, населённые пункты, пункты выдачи)
- Управление поставщиками и их зонами доставки
- Справочники категорий и единиц измерения
- Управление пользователями (создание OPERATOR и RESIDENT)
- Создание и управление закупками (создание, открытие, закрытие, отмена)
- Импорт прайс-листов из CSV (черновик → применение → откат)
- Настройка стоимости доставки и режима распределения
- Управление оплатой заказов (ручная отметка статуса, возвраты ЮKassa)
- Приёмка товара (акт приёмки с фиксацией расхождений)
- Сессии выдачи с чекином заказов по QR-коду или коду получения
- Аналитический дашборд с KPI по закупкам
- Отчёт по закупке (сводка, разбивка оплат, топ-категории/товары)
- Экспорт документов (PDF, XLSX, CSV) — 8 типов документов
- Журнал аудита всех действий (22 типа)

### Для оператора пункта выдачи (OPERATOR)
- Работа с закупками своего пункта выдачи
- Дашборд (только свои закупки)
- Проведение сессий выдачи (создание, чекин, закрытие)
- Приёмка товара
- Экспорт документов

### Для жителя (RESIDENT)
- Просмотр активных закупок своего населённого пункта
- Формирование заказа (корзина) и отправка заявки
- Онлайн-оплата через ЮKassa (с поддержкой 54-ФЗ)
- Просмотр своих заказов, QR-код и код получения
- Скачивание квитанции (PDF)
- Уведомления о событиях (6 типов)
- Отметка уведомлений как прочитанных

### Гостевой режим
- Гость может просматривать каталог закупки по инвайт-ссылке
- Может формировать корзину (привязка по cookie `cb_guest`, UUID, 365 дней)
- Для отправки заказа требуется авторизация как RESIDENT
- При входе гостевая корзина мержится с пользовательской

---

## Архитектура и стек технологий

| Слой | Технология | Версия | Назначение |
|------|-----------|--------|-----------|
| Фреймворк | Next.js (App Router) | 16.1.1 | SSR, маршрутизация, Server Actions |
| UI-библиотека | React | 19.2.3 | Компоненты, Server/Client Components |
| React Compiler | babel-plugin-react-compiler | 1.0.0 | Автоматическая мемоизация |
| Стилизация | Tailwind CSS (PostCSS) | 4.1.18 | Utility-first CSS |
| ORM | Prisma + @prisma/adapter-pg | 7.2.0 | Типизированные запросы к БД |
| СУБД | PostgreSQL | — | Основное хранилище |
| JWT | jose | 6.1.3 | Подпись/верификация JWT (HS256) |
| Хеширование паролей | bcryptjs | 3.0.3 | bcrypt (cost 10) |
| Валидация | Zod | 4.3.6 | Схемы валидации форм |
| Платежи | @yookassa/sdk | 0.0.3 | Онлайн-оплата, возвраты |
| PDF | PDFKit + pdf-lib | 0.17.2 / 1.17.1 | Генерация PDF-документов |
| PDF-шрифты | dejavu-fonts-ttf | 2.37.3 | Кириллица в PDF |
| Excel | ExcelJS | 4.4.0 | Генерация XLSX |
| QR-коды | qrcode | 1.5.4 | QR для выдачи заказов |
| Иконки | Lucide React, @phosphor-icons/react | — | UI-иконки |
| Анимации | Framer Motion | 12.38.0 | Анимации интерфейса |
| Логирование | Pino | 10.3.1 | Структурированные логи |
| Тестирование | Vitest | 4.0.18 | Unit + интеграционные тесты |
| Контейнеризация | Docker (multi-stage, node:20-alpine) | — | Продакшн-образ |
| Деплой | Vercel / Docker | — | PaaS или self-host |

### Архитектурные решения

- **Server Actions** — серверная логика вызывается напрямую из React-компонентов через `"use server"` функции без создания REST API. Используется паттерн `useActionState` для форм с обратной связью.
- **React Server Components (RSC)** — страницы рендерятся на сервере с прямым доступом к БД; клиентские компоненты помечены `"use client"` и используются только для интерактивности.
- **React Compiler** — включён через `next.config.mjs: { reactCompiler: true }` — автоматическая мемоизация компонентов.
- **Next.js Middleware (Edge Runtime)** — JWT-проверка и RBAC для маршрутов `/admin/*`, `/my/*`, `/p/*`. Middleware использует `jose` (совместим с Edge, в отличие от `bcryptjs`).
- **Кэширование сессии** — `getSession()` обёрнут в `React.cache()` для дедупликации внутри одного HTTP-запроса (можно вызывать из нескольких компонентов без повторных запросов к БД).
- **Token Version** — каждый JWT содержит `tv` (tokenVersion); при logout/force-logout `tokenVersion` в БД инкрементируется, что инвалидирует все ранее выданные токены.
- **Аудит-лог** — каждое значимое действие фиксируется в таблице `AuditLog` с типом действия (22 типа), актором и метаданными в JSON.
- **Standalone Output** — `output: "standalone"` в `next.config.mjs` для минимального Docker-образа.

---

## Структура проекта

```
coopbuy-diploma/
├── prisma/
│   ├── schema.prisma              # Схема БД (17 моделей, 11 enum)
│   ├── seed.js                    # Скрипт наполнения тестовыми данными (CJS)
│   └── migrations/                # 17 миграций
│       ├── 20260113015110_init
│       ├── 20260113230649_procurement_mvp
│       ├── 20260113232441_guest_cart
│       ├── 20260223205022_ops_docs_upgrade
│       ├── 20260224083504_mega_auth_ops
│       ├── 20260224090242_fulfillment_docs
│       ├── 20260224093044_import_xlsx
│       ├── 20260224120000_data_quality_import
│       ├── 20260224135845_payments_delivery
│       ├── 20260224141121_dashboard_report_notifications
│       ├── 20260227082048_auth_hardening
│       ├── 20260411120000_auto_close_notifications
│       ├── 20260411130000_token_version_and_ratelimit
│       ├── 20260412115635_yookassa_payments
│       ├── 20260412120000_import_undo_and_indexes
│       ├── 20260412121715_yukassa_refunds_phase2
│       └── 20260412140000_add_pickup_code
├── src/
│   ├── app/                       # Маршруты Next.js (App Router)
│   │   ├── layout.js              # Корневой layout (шрифт DejaVu, <html lang="ru">)
│   │   ├── page.js                # Корневой редирект по роли
│   │   ├── globals.css            # Tailwind + кастомные стили
│   │   ├── not-found.jsx          # 404
│   │   ├── error.jsx              # Глобальный error boundary
│   │   ├── 403/page.jsx           # Доступ запрещён
│   │   ├── auth/
│   │   │   ├── login/             # Авторизация (page + LoginForm + actions)
│   │   │   └── register/          # Регистрация (page + RegisterForm + actions)
│   │   ├── admin/
│   │   │   ├── layout.jsx         # Sidebar + header + guards
│   │   │   ├── error.jsx          # Error boundary для /admin
│   │   │   ├── dashboard/         # Дашборд (KPI-карточки, пагинация)
│   │   │   ├── procurements/      # Список закупок
│   │   │   │   └── [id]/          # Детали закупки (самая сложная страница)
│   │   │   │       ├── report/    # Аналитический отчёт
│   │   │   │       ├── export.csv/route.js
│   │   │   │       ├── export.pdf/route.js
│   │   │   │       ├── export.xlsx/route.js
│   │   │   │       ├── report.pdf/route.js
│   │   │   │       ├── report.xlsx/route.js
│   │   │   │       ├── payments.xlsx/route.js
│   │   │   │       ├── receiving.csv/route.js
│   │   │   │       └── receiving.xlsx/route.js
│   │   │   ├── suppliers/         # Поставщики
│   │   │   │   └── [id]/import/   # Импорт прайс-листа (CSV wizard)
│   │   │   ├── dictionaries/      # Справочники
│   │   │   ├── locations/         # Территории
│   │   │   ├── users/             # Пользователи
│   │   │   └── checkin/           # Выдача заказов
│   │   │       └── [orderId]/     # Детали заказа для выдачи
│   │   ├── my/
│   │   │   ├── layout.jsx         # Header + nav tabs + unread badge
│   │   │   ├── error.jsx          # Error boundary для /my
│   │   │   ├── procurements/      # Закупки жителя
│   │   │   ├── orders/            # Заказы жителя
│   │   │   │   └── [orderId]/     # Детали + QR + receipt.pdf
│   │   │   └── notifications/     # Уведомления
│   │   ├── p/[code]/              # Публичная страница закупки по инвайт-коду
│   │   └── api/
│   │       ├── auth/logout/route.js
│   │       ├── cron/auto-close/route.js
│   │       ├── orders/[orderId]/payment-status/route.js
│   │       └── webhooks/yookassa/route.js
│   ├── components/
│   │   ├── AdminSidebar.jsx       # Боковая панель (client, usePathname)
│   │   ├── MyNavLinks.jsx         # Навигация жителя (client, badge)
│   │   ├── CopyLinkButton.jsx     # Кнопка копирования (client, clipboard API)
│   │   └── ui/                    # Дизайн-система
│   │       ├── ActionForm.jsx     # ActionButtonForm + ActionMessage (client)
│   │       ├── Badge.jsx          # 7 вариантов цвета
│   │       ├── Button.jsx         # 5 вариантов, 3 размера, loading state
│   │       ├── Card.jsx           # Card, CardHeader, CardTitle, CardBody, StatCard
│   │       ├── EmptyState.jsx     # Пустое состояние
│   │       ├── InlineMessage.jsx  # 5 типов сообщений
│   │       ├── PageHeader.jsx     # Заголовок страницы
│   │       ├── Pager.jsx          # Серверная пагинация (Link-based)
│   │       ├── RouteStatus.jsx    # PageLoadingState + RouteErrorState (client)
│   │       └── SearchInput.jsx    # Поиск (client)
│   └── lib/                       # Серверная бизнес-логика
│       ├── auth.js                # JWT-сессии
│       ├── guards.js              # Проверки ролей
│       ├── db.js                  # Singleton Prisma
│       ├── validation.js          # Zod-схемы
│       ├── rateLimit.js           # Rate limiter (memory/DB)
│       ├── deliveryShares.js      # Расчёт долей доставки
│       ├── notifications.js       # Создание уведомлений
│       ├── audit.js               # Запись в журнал аудита
│       ├── guestCart.js           # Гостевая корзина
│       ├── orders.js              # Утилиты расчёта сумм
│       ├── pickupCode.js          # Генерация 6-значного кода
│       ├── yookassa.js            # SDK ЮKassa
│       ├── logger.js              # Pino-логгер
│       ├── logoutAction.js        # Серверное действие выхода
│       ├── constants.js           # Константы (метки, переходы, навигация)
│       ├── formUtils.js           # str/num/bool/prismaNiceError
│       ├── zodError.js            # firstZodError/zodFieldErrors
│       ├── baseUrl.js             # Определение базового URL
│       ├── exportDocuments.js     # Генерация имён файлов
│       ├── pdfDoc.js              # Создание PDFDocument + шрифт
│       ├── pdfFont.js             # Путь к DejaVu Sans
│       ├── pdfLayout.js           # Разметка PDF (разрывы, линии, абзацы)
│       └── pdfTable.js            # Движок таблиц PDF
├── docs/
│   ├── RUNBOOK.md                 # Инструкция по запуску и проверке
│   ├── IMPLEMENTATION_ALIGNMENT.md # Соответствие реализации ТЗ
│   ├── PRD_YUKASSA.md             # Требования к интеграции ЮKassa
│   ├── migrations.md              # Описание миграций
│   ├── coopbuy-erd.drawio         # ER-диаграмма (draw.io)
│   ├── coopbuy.dbml               # Схема БД (DBML)
│   └── coopbuy.sql                # SQL-экспорт схемы
├── Dockerfile                     # Multi-stage Docker-образ (3 стадии)
├── vercel.json                    # Vercel cron: auto-close каждые 15 мин
├── .env.example                   # Шаблон переменных окружения
├── next.config.mjs                # reactCompiler: true, output: "standalone"
└── package.json
```

---

## Модель данных (полная)

### Перечисления (11 enum)

| Enum | Значения | Описание |
|------|---------|---------|
| `ProcurementStatus` | DRAFT, OPEN, CLOSED, CANCELED | Жизненный цикл закупки |
| `OrderStatus` | DRAFT, SUBMITTED, CANCELED | Статус заказа |
| `PaymentStatus` | UNPAID, PAID, PAY_ON_PICKUP, PENDING, FAILED, REFUNDED | Статус оплаты |
| `UserRole` | ADMIN, OPERATOR, RESIDENT | Роли пользователей |
| `DeliverySplitMode` | PROPORTIONAL_SUM, EQUAL, PER_ITEM | Режим распределения доставки |
| `PickupSessionStatus` | PLANNED, ACTIVE, CLOSED | Статус сессии выдачи |
| `ImportBatchStatus` | DRAFT, APPLIED, REVERTED | Статус импорта прайса |
| `ImportRowStatus` | OK, ERROR | Результат парсинга строки импорта |
| `ReceivingStatus` | DRAFT, FINAL | Статус акта приёмки |
| `NotificationType` | PROCUREMENT_CREATED, PROCUREMENT_CLOSED, PICKUP_WINDOW_UPDATED, ORDER_SUBMITTED, PAYMENT_STATUS_CHANGED, ORDER_ISSUED | Тип уведомления |
| `AuditAction` | 22 действия (см. ниже) | Тип действия аудита |
| `ActorType` | ADMIN, PUBLIC | Тип актора аудита |
| `EntityType` | PROCUREMENT, ORDER, RECEIVING, PICKUP_SESSION, SUPPLIER, PRICE_IMPORT_BATCH, USER | Тип сущности аудита |

### Действия аудита (AuditAction — 22 значения)

```
CREATE_PROCUREMENT, CLOSE_PROCUREMENT, SUBMIT_ORDER,
CREATE_RECEIVING, UPDATE_RECEIVING_LINE, FINALIZE_RECEIVING,
EXPORT_DOC, CREATE_PICKUP_SESSION, CHECKIN_ORDER, CLOSE_PICKUP_SESSION,
IMPORT_PRICE_LIST, IMPORT_PRICE_LIST_DRAFT, APPLY_PRICE_LIST, REVERT_PRICE_LIST,
UPDATE_DELIVERY_SETTINGS, RECALC_DELIVERY_SHARES, UPDATE_PAYMENT_STATUS,
LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, PROCUREMENT_AUTO_CLOSED, FORCE_LOGOUT,
ONLINE_PAYMENT_CREATED, ONLINE_PAYMENT_SUCCEEDED, ONLINE_PAYMENT_FAILED, ONLINE_PAYMENT_REFUNDED
```

### Модели (17 таблиц) — полное описание полей

#### Region
| Поле | Тип | Описание |
|------|-----|---------|
| id | String @id @default(cuid()) | Первичный ключ |
| createdAt | DateTime @default(now()) | Дата создания |
| name | String @unique | Наименование региона |
| settlements | Settlement[] | Населённые пункты |

#### Settlement
| Поле | Тип | Описание |
|------|-----|---------|
| id | String @id | — |
| createdAt | DateTime | — |
| name | String | Наименование НП |
| regionId | String (FK → Region) | Регион |
| pickupPoints | PickupPoint[] | Пункты выдачи |
| users | User[] | Жители |
| supplierZones | SupplierDeliveryZone[] | Зоны поставщиков |
| procurements | Procurement[] | Закупки |
| @@unique([regionId, name]) | | Уникальная пара |

#### PickupPoint
| Поле | Тип | Описание |
|------|-----|---------|
| id | String @id | — |
| createdAt | DateTime | — |
| name | String | Название ПВЗ |
| address | String | Адрес |
| hasFreezer | Boolean @default(false) | Наличие морозильника |
| settlementId | String (FK → Settlement) | — |
| procurements | Procurement[] | — |
| operators | User[] | Операторы этого ПВЗ |

#### Category
| Поле | Тип | Описание |
|------|-----|---------|
| id | String @id | — |
| name | String @unique | Название категории |
| createdAt | DateTime | — |
| products | Product[] | Товары |

#### Unit
| Поле | Тип | Описание |
|------|-----|---------|
| id | String @id | — |
| name | String @unique | Единица измерения |
| createdAt | DateTime | — |
| products | Product[] | Товары |

#### Supplier
| Поле | Тип | Описание |
|------|-----|---------|
| id | String @id | — |
| createdAt | DateTime | — |
| name | String @unique | Наименование |
| minOrderSum | Int @default(0) | Минимальная сумма заказа (копейки) |
| phone | String? | Телефон |
| email | String? | Email |
| isActive | Boolean @default(true) | Активен ли |
| zones | SupplierDeliveryZone[] | Зоны доставки |
| products | Product[] | Каталог товаров |
| procurements | Procurement[] | Закупки |
| importBatches | PriceImportBatch[] | Импорты прайсов |

#### SupplierDeliveryZone
| Поле | Тип | Описание |
|------|-----|---------|
| id | String @id | — |
| isActive | Boolean @default(true) | — |
| supplierId | String (FK) | — |
| settlementId | String (FK) | — |
| @@unique([supplierId, settlementId]) | | Один поставщик — один НП |

#### Product
| Поле | Тип | Описание |
|------|-----|---------|
| id | String @id | — |
| createdAt | DateTime | — |
| name | String | Наименование товара |
| categoryId | String (FK → Category) | Категория |
| unitId | String (FK → Unit) | Единица измерения |
| sku | String? | Артикул |
| imageUrl | String? | Ссылка на изображение |
| price | Int | Цена (в копейках) |
| isActive | Boolean @default(true) | Активен ли |
| supplierId | String (FK → Supplier, onDelete: Cascade) | — |
| orderItems | OrderItem[] | — |
| receivingLines | ReceivingLine[] | — |

#### PriceImportBatch
| Поле | Тип | Описание |
|------|-----|---------|
| id | String @id | — |
| createdAt | DateTime | — |
| supplierId | String (FK, Cascade) | — |
| fileName | String | Имя загруженного файла |
| delimiter | String @default(",") | Разделитель CSV |
| status | ImportBatchStatus @default(DRAFT) | DRAFT → APPLIED → REVERTED |
| createdByUserId | String? | Кто создал |
| appliedAt | DateTime? | Когда применён |
| revertedAt | DateTime? | Когда откачен |
| rows | PriceImportRow[] | Строки импорта |

#### PriceImportRow
| Поле | Тип | Описание |
|------|-----|---------|
| id | String @id | — |
| batchId | String (FK, Cascade) | — |
| rowNumber | Int | Номер строки в CSV |
| rawName | String | Исходное наименование |
| rawCategory | String | Исходная категория |
| rawUnit | String | Исходная ед. изм. |
| rawPrice | String | Исходная цена |
| rawSku | String? | Исходный артикул |
| rawImageUrl | String? | — |
| status | ImportRowStatus @default(OK) | OK или ERROR |
| errorMessage | String? | Текст ошибки |
| appliedProductId | String? | ID товара после apply |
| previousPrice | Int? | Предыдущая цена (для отката) |
| previousActive | Boolean? | Предыдущий isActive (для отката) |
| @@index([batchId, status]) | | Индекс |

#### Procurement
| Поле | Тип | Описание |
|------|-----|---------|
| id | String @id | — |
| createdAt, updatedAt | DateTime | — |
| status | ProcurementStatus @default(DRAFT) | — |
| title | String | Название закупки |
| inviteCode | String @unique | Инвайт-код (12 hex символов) |
| deadlineAt | DateTime | Дедлайн приёма заказов |
| minTotalSum | Int @default(0) | Минимальная сумма для закупки |
| pickupWindowStart | DateTime? | Начало окна выдачи |
| pickupWindowEnd | DateTime? | Конец окна выдачи |
| pickupInstructions | String? | Инструкции для выдачи |
| supplierId | String (FK, Restrict) | Поставщик |
| settlementId | String (FK, Restrict) | Населённый пункт |
| pickupPointId | String (FK, Restrict) | Пункт выдачи |
| deliveryFee | Int @default(0) | Стоимость доставки (копейки) |
| deliverySplitMode | DeliverySplitMode @default(PROPORTIONAL_SUM) | Режим распределения |
| orders | Order[] | Заказы |
| receivingReport | ReceivingReport? | Акт приёмки (1:1) |
| pickupSession | PickupSession? | Сессия выдачи (1:1) |
| @@index([settlementId, status, deadlineAt]) | | Составной индекс |

#### Order
| Поле | Тип | Описание |
|------|-----|---------|
| id | String @id | — |
| createdAt, updatedAt | DateTime | — |
| status | OrderStatus @default(DRAFT) | — |
| guestId | String? | ID гостя (из cookie) |
| userId | String? (FK → User, SetNull) | ID пользователя |
| participantName | String? | ФИО участника |
| participantPhone | String? | Телефон участника |
| pickupCode | String? @unique | 6-значный код получения |
| procurementId | String (FK, Cascade) | Закупка |
| goodsTotal | Int? | Сумма товаров (копейки) |
| deliveryShare | Int? | Доля доставки (копейки) |
| grandTotal | Int? | Итого к оплате (копейки) |
| paymentStatus | PaymentStatus @default(UNPAID) | Статус оплаты |
| paidAt | DateTime? | Дата оплаты |
| paymentMethod | String? | Способ оплаты |
| yookassaPaymentId | String? | ID платежа ЮKassa |
| paymentAttempt | Int @default(0) | Счётчик попыток оплаты |
| refundedAt | DateTime? | Дата возврата |
| refundAmount | Int? | Сумма возврата |
| items | OrderItem[] | Позиции заказа |
| checkin | PickupCheckin? | Факт выдачи (1:1) |
| @@index — 5 индексов | | procurementId+guestId, +userId, +status; userId+status; yookassaPaymentId |

#### OrderItem
| Поле | Тип | Описание |
|------|-----|---------|
| id | String @id | — |
| orderId | String (FK, Cascade) | — |
| productId | String (FK, Restrict) | — |
| qty | Int | Количество |
| price | Int | Цена на момент заказа |
| @@index([orderId]), @@index([productId]) | | Индексы |

#### ReceivingReport
| Поле | Тип | Описание |
|------|-----|---------|
| id | String @id | — |
| createdAt, updatedAt | DateTime | — |
| status | ReceivingStatus @default(DRAFT) | DRAFT → FINAL |
| notes | String? | Примечания |
| procurementId | String @unique (FK, Cascade) | 1:1 с Procurement |
| lines | ReceivingLine[] | Строки акта |

#### ReceivingLine
| Поле | Тип | Описание |
|------|-----|---------|
| id | String @id | — |
| reportId | String (FK, Cascade) | — |
| productId | String (FK, Restrict) | — |
| expectedQty | Int | Ожидаемое количество |
| receivedQty | Int | Фактическое количество |
| comment | String? | Комментарий |

#### User
| Поле | Тип | Описание |
|------|-----|---------|
| id | String @id | — |
| createdAt, updatedAt | DateTime | — |
| email | String @unique | Email (логин) |
| passwordHash | String | bcrypt hash |
| fullName | String | ФИО |
| phone | String? | Телефон |
| role | UserRole @default(RESIDENT) | Роль |
| tokenVersion | Int @default(0) | Версия токена (для инвалидации JWT) |
| settlementId | String? (FK, SetNull) | Населённый пункт |
| pickupPointId | String? (FK, SetNull) | Пункт выдачи (для OPERATOR) |
| orders | Order[] | — |
| notifications | Notification[] | — |

#### PickupSession
| Поле | Тип | Описание |
|------|-----|---------|
| id | String @id | — |
| createdAt, updatedAt | DateTime | — |
| status | PickupSessionStatus @default(PLANNED) | PLANNED → ACTIVE → CLOSED |
| startAt | DateTime? | Время начала |
| endAt | DateTime? | Время окончания |
| procurementId | String @unique (FK, Cascade) | 1:1 с Procurement |
| checkins | PickupCheckin[] | Чекины |

#### PickupCheckin
| Поле | Тип | Описание |
|------|-----|---------|
| id | String @id | — |
| checkedAt | DateTime @default(now()) | Время выдачи |
| note | String? | Заметка |
| sessionId | String (FK, Cascade) | — |
| orderId | String @unique (FK, Cascade) | 1:1 с Order |
| operatorUserId | String? | Кто выдал |

#### AuditLog
| Поле | Тип | Описание |
|------|-----|---------|
| id | String @id | — |
| createdAt | DateTime @default(now()) | — |
| actorType | ActorType | ADMIN или PUBLIC |
| actorLabel | String | Email актора |
| action | AuditAction | Тип действия |
| entityType | EntityType | Тип сущности |
| entityId | String | ID сущности |
| meta | Json? | Доп. данные |
| @@index — 3 индекса | | entityId, action, createdAt |

#### Notification
| Поле | Тип | Описание |
|------|-----|---------|
| id | String @id | — |
| createdAt | DateTime @default(now()) | — |
| readAt | DateTime? | Дата прочтения (null = не прочитано) |
| userId | String (FK, Cascade) | Получатель |
| type | NotificationType | Тип |
| title | String | Заголовок |
| body | String | Текст |
| linkUrl | String? | Ссылка |
| @@index([userId, createdAt]) | | Индекс |

#### RateLimitBucket
| Поле | Тип | Описание |
|------|-----|---------|
| key | String @id | Ключ ограничения (login:{ip}:{email}) |
| count | Int | Счётчик попыток |
| windowStart | DateTime | Начало окна |
| updatedAt | DateTime @updatedAt | — |

### Связи между сущностями (диаграмма)

```
Region 1──* Settlement 1──* PickupPoint
                │                  │
                ├──* User          ├──* User (OPERATOR)
                │                  └──* Procurement
                ├──* SupplierDeliveryZone
                └──* Procurement

Supplier 1──* Product *──1 Category
         │           *──1 Unit
         ├──* SupplierDeliveryZone
         ├──* Procurement
         └──* PriceImportBatch 1──* PriceImportRow

Procurement 1──* Order 1──* OrderItem *──1 Product
     │              │
     │              └──0..1 PickupCheckin
     │
     ├──0..1 ReceivingReport 1──* ReceivingLine *──1 Product
     └──0..1 PickupSession 1──* PickupCheckin

User 1──* Order
     1──* Notification
```

---

## Ролевая модель и авторизация

### Роли и доступ

| Роль | Маршруты | Описание |
|------|---------|---------|
| **ADMIN** | `/admin/*` (все разделы) | Полный доступ ко всем функциям |
| **OPERATOR** | `/admin/dashboard`, `/admin/procurements` (свой ПВЗ), `/admin/checkin` | Работа только со своим пунктом выдачи |
| **RESIDENT** | `/my/*`, `/p/*` | Просмотр закупок, оформление заказов, уведомления |

Навигация OPERATOR ограничена: Обзор, Закупки, Выдача. ADMIN видит ещё: Пользователи, Поставщики, Территории, Справочники.

### Механизм аутентификации (подробно)

1. **Регистрация** (`register` action):
   - Валидация через Zod: email, password (≥ 8 символов), fullName, settlementId, phone (опц.)
   - Rate limit: 5 попыток за 5 минут по ключу `register:{ip}:{email}`
   - Проверка уникальности email и существования settlement
   - Хеширование пароля: `bcryptjs`, cost factor 10
   - Создание User с ролью RESIDENT
   - Подпись JWT с полями: `sub` (userId), `email`, `role`, `settlementId`, `pickupPointId`, `fullName`, `tv` (tokenVersion)
   - Установка httpOnly cookie `cb_session` (7 дней)
   - Мерж гостевой корзины (`mergeGuestDraftOrdersIntoUser`)
   - Redirect на `/my/procurements`

2. **Вход** (`login` action):
   - Валидация через `loginSchema` (email, password ≥ 8)
   - Rate limit: 5 попыток за 5 минут по ключу `login:{ip}:{email}`
   - **Защита от перебора**: если пользователь не найден, выполняется `bcrypt.compare` с dummy hash для предотвращения timing-атак
   - Аудит: `LOGIN_FAILED` при неудаче, `LOGIN_SUCCESS` при успехе
   - Сброс rate limit при успешном входе
   - Мерж гостевой корзины
   - Redirect на `/admin/dashboard` (ADMIN/OPERATOR) или `/my/procurements` (RESIDENT)

3. **Проверка сессии** (`getSession()`, мемоизирован через `React.cache()`):
   - Читает cookie `cb_session`
   - Верифицирует JWT через `jose.jwtVerify`
   - Загружает `tokenVersion` из БД по `payload.sub`
   - Сравнивает `payload.tv === user.tokenVersion` — если не совпадает, токен считается инвалидированным
   - Возвращает payload или null

4. **Выход** (`logoutAction`):
   - Инкремент `tokenVersion` в БД → все JWT инвалидируются
   - Аудит: `LOGOUT`
   - Очистка cookie
   - `revalidatePath("/", "layout")` + redirect на `/auth/login`

5. **Rate limiting**:
   - Два бекенда: in-memory Map (`RATE_LIMIT_BACKEND=memory`) или PostgreSQL (`RateLimitBucket`)
   - По умолчанию: 5 попыток за 5 минут
   - DB-бекенд использует `$transaction` для атомарности
   - In-memory: автоочистка устаревших записей каждые 10 минут

### Guard-функции (`src/lib/guards.js`)

**Паттерн return** (для `useActionState`):
- `requireSessionResult()` → `{ session, fail }` или `{ session: null, fail: { ok: false, message } }`
- `requireAdminResult()` — только ADMIN
- `requireOperatorOrAdminResult()` — ADMIN или OPERATOR
- `requireResidentResult()` — только RESIDENT

**Паттерн throw** (для route handlers):
- `assertAuth()` — бросает `"Войдите в систему."` если нет сессии
- `assertAdmin()` — бросает `"Нет доступа."` если не ADMIN
- `assertOperatorOrAdmin()` — бросает если не ADMIN/OPERATOR
- `assertResident()` — бросает если не RESIDENT

**Guard для Route Handler**:
- `requireOperatorOrAdminRoute(procurementPickupPointId)` → `{ session }` или `{ response: Response(401/403) }`

**Guard для закупок**:
- `requireAccessibleProcurement(id, query)` — проверяет сессию, роль и для OPERATOR — совпадение pickupPointId
- `getResidentProcurementAccess({ session, procurement, procurementState })` — возвращает `{ status, message }`:
  - `"allowed"` — можно участвовать
  - `"login_required"` — не авторизован
  - `"wrong_role"` — не RESIDENT
  - `"wrong_settlement"` — НП не совпадает
  - `"deadline_closed"` — дедлайн истёк
  - `"minimum_not_reached"` — минимальная сумма не достигнута

### Переходы статусов оплаты

```
UNPAID → PAID, PAY_ON_PICKUP
PAY_ON_PICKUP → PAID, UNPAID
PAID → REFUNDED
PENDING → PAID, FAILED, UNPAID
FAILED → PAID, PAY_ON_PICKUP, UNPAID
REFUNDED → (нет переходов)
```

---

## Бизнес-логика (подробно)

### Жизненный цикл закупки

```
DRAFT → OPEN → CLOSED (вручную или автоматически по дедлайну)
              → CANCELED
```

1. ADMIN/OPERATOR создаёт закупку → статус OPEN (DRAFT не используется в UI)
2. Генерируется инвайт-код (12 hex из UUID, до 10 попыток уникальности)
3. Все RESIDENT в НП получают уведомление `PROCUREMENT_CREATED`
4. Жители формируют заказы по ссылке `/p/{inviteCode}`
5. По дедлайну — автозакрытие через cron или при посещении списка закупок
6. ADMIN/OPERATOR проводит приёмку, сессию выдачи, формирует отчёты

### Автозакрытие закупок

- Функция `autoCloseExpiredProcurements(prisma, now)`:
  - `prisma.procurement.findMany({ where: { status: "OPEN", deadlineAt: { lte: now } } })`
  - Для каждой: `prisma.procurement.update({ status: "CLOSED" })`
  - Аудит: `PROCUREMENT_AUTO_CLOSED`
  - Уведомление: `PROCUREMENT_CLOSED` для всех уникальных userId из SUBMITTED заказов
- Вызывается:
  - `GET /api/cron/auto-close` (Bearer auth, Vercel cron каждые 15 мин)
  - При посещении `/admin/procurements`, `/my/procurements`, `/admin/dashboard`, `/admin/checkin`, `/p/[code]`

### Расчёт стоимости доставки (`recalcDeliveryShares`)

Пересчитывает `goodsTotal`, `deliveryShare`, `grandTotal` для всех SUBMITTED заказов закупки.

| Режим | Формула веса |
|-------|-------------|
| PROPORTIONAL_SUM | вес = goodsTotal заказа |
| EQUAL | вес = 1 (одинаковый для всех) |
| PER_ITEM | вес = сумма qty всех позиций |

Используется **метод наибольших остатков** (largest remainder) для точного распределения копеек без потерь: floor + распределение остатка по наибольшему дробному остатку (при равенстве — приоритет по индексу).

### Гостевая корзина

- Cookie `cb_guest` — UUID, maxAge 365 дней, httpOnly, sameSite: lax
- `getOrCreateGuestId()` — читает или генерирует
- `mergeGuestDraftOrdersIntoUser(userId)` — при входе:
  - Для каждого DRAFT заказа гостя: если у пользователя уже есть SUBMITTED заказ на ту же закупку → удаляем гостевой
  - Если нет DRAFT у пользователя → переносим (migratedOrders)
  - Если есть DRAFT → мержим позиции (суммируем qty одинаковых товаров, добавляем новые) (mergedOrders)
  - Очищаем cookie

### Импорт прайс-листов (3 фазы)

1. **createDraftBatch** — клиент загружает CSV (≤ 5 МБ), авто-определение разделителя (`;` vs `,`), маппинг колонок (поддержка RU и EN), парсинг → `PriceImportBatch(DRAFT)` + `PriceImportRow[]` (OK/ERROR). Аудит: `IMPORT_PRICE_LIST_DRAFT`.

2. **applyBatch** — для каждой OK-строки: `findOrCreate` Category/Unit, upsert Product (поиск сначала по SKU, затем по name+unit). Сохраняет `previousPrice` и `appliedProductId` для отката. Статус → APPLIED. Аудит: `APPLY_PRICE_LIST`.

3. **undoBatch** — проверка конфликтов (нет ли более свежих APPLIED батчей с теми же товарами). Товары, созданные этим батчем (`previousPrice = null`), деактивируются. Обновлённые — восстанавливают предыдущую цену/статус. Статус → REVERTED. Аудит: `REVERT_PRICE_LIST`.

### Онлайн-оплата (ЮKassa)

- **Создание платежа** (`createPayment` action):
  - Доступно для SUBMITTED заказов с `paymentStatus = UNPAID | FAILED`
  - Формирует receipt по 54-ФЗ: каждая позиция заказа + строка доставки (если > 0)
  - Idempotence key: `order-{id}-{paymentAttempt}`
  - Сохраняет `yookassaPaymentId`, устанавливает `paymentStatus: PENDING`
  - Redirect на URL оплаты ЮKassa
  - Аудит: `ONLINE_PAYMENT_CREATED`

- **Webhook** (`POST /api/webhooks/yookassa`):
  - IP-whitelist (5 CIDR-диапазонов ЮKassa), bypass через `YOOKASSA_SKIP_IP_CHECK=true`
  - `payment.succeeded` → статус PAID, аудит `ONLINE_PAYMENT_SUCCEEDED`, уведомление
  - `payment.canceled` → статус FAILED, аудит `ONLINE_PAYMENT_FAILED`, уведомление
  - Идемпотентность: не перезаписывает PAID при повторном succeeded/canceled

- **Polling** (`GET /api/orders/[orderId]/payment-status`):
  - Клиент опрашивает каждые 3 сек. пока `status = PENDING`
  - Сервер активно проверяет ЮKassa API и обновляет БД при изменении

- **Возврат** (`refundPayment` action):
  - Только для PAID заказов с `yookassaPaymentId`
  - `refundAmount ≤ grandTotal`
  - Аудит: `ONLINE_PAYMENT_REFUNDED`, уведомление

### Уведомления

| Событие | Триггер | Получатель |
|---------|---------|-----------|
| PROCUREMENT_CREATED | createProcurement | Все RESIDENT в НП |
| PROCUREMENT_CLOSED | closeProcurement / autoClose | Все с SUBMITTED заказами (дедуп userId) |
| ORDER_SUBMITTED | submitOrder | Автор заказа |
| PAYMENT_STATUS_CHANGED | updatePaymentStatus / refund / webhook | Автор заказа |
| ORDER_ISSUED | checkinOrder | Автор заказа |

### Выдача заказов

- `createPickupSession` — создаёт сессию (PLANNED) с опциональным startAt/endAt
- `checkinOrder` — принимает полный UUID или 6-значный `pickupCode`. Атомарная проверка в `$transaction`:
  - Заказ принадлежит закупке
  - Статус SUBMITTED, оплата PAID или PAY_ON_PICKUP (не UNPAID)
  - Сессия не CLOSED, принадлежит той же закупке
  - Нет дублирующего чекина
- `closePickupSession` — закрывает сессию (CLOSED)

---

## Страницы и UI

### Layouts

| Layout | Тип | Описание |
|--------|-----|---------|
| `app/layout.js` | Server | Корневой: шрифт DejaVu Sans (local), `<html lang="ru">` |
| `app/admin/layout.jsx` | Server | Sidebar + header с ролью/email/logout; guard ADMIN/OPERATOR |
| `app/my/layout.jsx` | Server | Header + nav tabs + unread badge; guard RESIDENT |

### Страницы

#### `/` (page.js) — Server
Редирект по роли: гость → `/auth/login`, ADMIN/OPERATOR → `/admin/dashboard`, RESIDENT → `/my/procurements`.

#### `/auth/login` (page.jsx + LoginForm.jsx) — Server + Client
- Search params: `next`, `error` (если `"forbidden"` — показывает баннер)
- LoginForm: `useActionState(login)`, поля email + password, pending state "Проверяем доступ"

#### `/auth/register` (page.jsx + RegisterForm.jsx) — Server + Client
- Prisma: загружает все Settlement с Region для dropdown
- RegisterForm: fullName, email, phone, password, settlement search+select (клиентская фильтрация)
- Pending: "Создаём профиль"

#### `/403` (page.jsx) — Server
Статическая страница с иконкой щита, сообщением и ссылками на вход.

#### `/p/[code]` (page.jsx + ClientForms.jsx) — Server + Client
Публичная страница закупки. Самая функциональная страница для жителя.
- Prisma: procurement + supplier + products + aggregate submitted total + user's order
- Два столбца: каталог товаров (слева) + корзина/заказ (справа)
- Баннеры доступа: login_required, wrong_role, wrong_settlement, deadline_closed, minimum_not_reached
- Каталог: карточки товаров с "В корзину" (server action addToCart)
- Корзина (DRAFT): позиции с decrease/remove/clear, SubmitOrderForm (client: имя, телефон, выбор оплаты online/pickup)
- Подтверждённый заказ (SUBMITTED): сводка, QR-код, код получения, ссылка на /my/orders/[orderId]

#### `/admin/dashboard` (page.jsx) — Server
- Auth: ADMIN/OPERATOR
- Пагинация: `?page=1&pageSize=10`
- KPI-карточки по каждой закупке: кол-во заказов, собранная сумма, прогресс до minTotalSum, оплачено/не оплачено, выдано
- Deadline hint: < 48ч → amber, ≥ 48ч → zinc, истёк → red
- Ссылки: Детали, Отчёт, Payments XLSX, Export XLSX

#### `/admin/procurements` (page.jsx + ClientForms.jsx) — Server + Client
- Вкладки: Активные / Архив
- CreateProcurementForm (client): авто-заполнение minTotalSum от поставщика, фильтрация ПВЗ по НП, для OPERATOR — locked fields
- Карточки закупок: статус badge, supplier/location, deadline, прогресс-бар, invite URL + CopyLinkButton
- Кнопки: Детали, Открыть, Закрыть

#### `/admin/procurements/[id]` (page.jsx + клиентские формы) — Server + Client
**Самая сложная страница.** Секции (якорная навигация):
1. **Сводка** — поставщик, НП, ПВЗ, дедлайн, мин. сумма, инвайт-ссылка
2. **Оплата** (только ADMIN) — DeliverySettingsForm (fee + mode), таблица заказов с PaymentStatusForm + RefundModal, recalcShares, XLSX export
3. **Агрегированная таблица** (только ADMIN) — продуктовые тоталы; CSV/PDF/XLSX export
4. **Выдача** (только ADMIN) — CreatePickupSessionForm или ManualCheckinForm + CheckinOrderForm + ClosePickupSessionForm
5. **Приёмка** (только ADMIN) — создание отчёта, ReceivingLineRow (inline edit), финализация, CSV/XLSX export
6. **Заказы** — collapsible details с позициями
7. **Журнал аудита** (только ADMIN) — последние 30 записей

#### `/admin/procurements/[id]/report` (page.jsx) — Server
- KPI карточки: заказы, жители, товары, доставка, итого, выдано
- Разбивка оплат (UNPAID/PAID/PAY_ON_PICKUP)
- Таблица заказов с фильтром paymentStatus + поиск name/phone
- Пагинация: 20/стр, topCategories/topProducts без пагинации
- XLSX/PDF export ссылки

#### `/admin/suppliers` (page.jsx + ClientForms.jsx) — Server + Client
- Кол-во поставщиков, CreateSupplierForm
- Карточки: toggle active, delete, import link
- Вложенные панели: зоны доставки (add/delete), товары (таблица + add/delete)

#### `/admin/suppliers/[id]/import` (page.jsx + CsvImportClient.jsx) — Server + Client
3-фазный wizard:
1. Upload + auto-detect columns + preview + mapping UI
2. Draft результат (ok/error counts + error list) + "Применить"
3. Applied результат (created/updated/errors)

#### `/admin/dictionaries` (page.jsx + ClientForms.jsx) — Server + Client
Два столбца: категории и единицы измерения. CRUD: add form + list. Delete заблокирован если есть связанные товары.

#### `/admin/locations` (page.jsx + ClientForms.jsx) — Server + Client
Дерево: Region → Settlement → PickupPoint. CRUD для каждого уровня. Индикатор морозильника.

#### `/admin/users` (page.jsx + ClientForms.jsx) — Server + Client
StatCards: всего/операторов/жителей. Две формы создания (Operator + Resident). Список по ролям (grid: name/email/phone, settlement, pickup point).

#### `/admin/checkin` (page.jsx + PickupForms.jsx) — Server + Client
Для OPERATOR — основной рабочий экран выдачи. Карточки закупок с: статус сессии, "Выдано X/Y". ManualCheckinForm (ввод orderId или pickupCode). Чекин-кнопки по каждому заказу.

#### `/admin/checkin/[orderId]` (page.jsx) — Server
Детали заказа для выдачи: участник, оплата, код получения, позиции, суммы, большая кнопка "Выдать заказ".

#### `/my/procurements` (page.jsx) — Server
Карточки активных закупок НП жителя: supplier, pickup point, deadline, прогресс-бар, кнопка "Открыть" → `/p/{inviteCode}`.

#### `/my/orders` (page.jsx) — Server
Пагинация 10/стр. Карточки SUBMITTED заказов: procurement, supplier, grand total, payment badge, checkin badge, позиции, ссылки на detail и PDF.

#### `/my/orders/[orderId]` (page.jsx + PaymentButton + PaymentPendingPoller + PrintPageButton) — Server + Client
- Детали заказа + QR-код (генерируется серверно через `qrcode.toDataURL`)
- Участник, оплата, окно выдачи, позиции, доставка, итого
- PaymentButton (если UNPAID/FAILED) → createPayment → redirect на ЮKassa
- PaymentPendingPoller (если `?payment=pending`) — polling каждые 3 сек
- PrintPageButton → `window.print()`
- Ссылка на PDF-квитанцию

#### `/my/notifications` (page.jsx) — Server
Пагинация 20/стр. Фильтр: Все / Непрочитанные. "Прочитать все". Иконки по типу, unread dot, timestamp, link.

---

## Серверные действия (Server Actions)

### Аутентификация

| Действие | Файл | Что делает | Аудит |
|----------|------|-----------|-------|
| `login` | auth/login/actions.js | Вход: валидация, rate limit, bcrypt, JWT, мерж корзины | LOGIN_SUCCESS / LOGIN_FAILED |
| `register` | auth/register/actions.js | Регистрация RESIDENT: валидация, hash, JWT, мерж корзины | — |
| `logoutAction` | lib/logoutAction.js | Выход: инвалидация tokenVersion, очистка cookie | LOGOUT |

### Управление пользователями

| Действие | Файл | Что делает |
|----------|------|-----------|
| `createOperator` | admin/users/actions.js | Создание OPERATOR (email+password+pickupPoint) |
| `createResident` | admin/users/actions.js | Создание RESIDENT (email+password+settlement) |

### Территории

| Действие | Файл |
|----------|------|
| `createRegion` / `deleteRegion` | admin/locations/actions.js |
| `createSettlement` / `deleteSettlement` | admin/locations/actions.js |
| `createPickupPoint` / `deletePickupPoint` | admin/locations/actions.js |

### Справочники

| Действие | Файл |
|----------|------|
| `createCategory` / `deleteCategory` | admin/dictionaries/actions.js |
| `createUnit` / `deleteUnit` | admin/dictionaries/actions.js |

### Поставщики

| Действие | Файл | Что делает |
|----------|------|-----------|
| `createSupplier` | admin/suppliers/actions.js | Создание поставщика (name, minOrderSum, phone, email) |
| `toggleSupplierActive` | admin/suppliers/actions.js | Toggle isActive (читает из БД, не из формы) |
| `deleteSupplier` | admin/suppliers/actions.js | Удаление |
| `addDeliveryZone` | admin/suppliers/actions.js | Upsert зоны доставки |
| `deleteDeliveryZone` | admin/suppliers/actions.js | Удаление зоны |
| `createProduct` | admin/suppliers/actions.js | Создание товара (валидация URL для imageUrl) |
| `deleteProduct` | admin/suppliers/actions.js | Удаление товара |

### Импорт прайс-листов

| Действие | Файл | Аудит |
|----------|------|-------|
| `createDraftBatch` | admin/suppliers/[id]/import/actions.js | IMPORT_PRICE_LIST_DRAFT |
| `applyBatch` | admin/suppliers/[id]/import/actions.js | APPLY_PRICE_LIST |
| `undoBatch` | admin/suppliers/[id]/import/actions.js | REVERT_PRICE_LIST |

### Закупки

| Действие | Файл | Аудит |
|----------|------|-------|
| `createProcurement` | admin/procurements/actions.js | CREATE_PROCUREMENT |
| `closeProcurement` | admin/procurements/actions.js | CLOSE_PROCUREMENT |

### Управление закупкой

| Действие | Файл | Аудит |
|----------|------|-------|
| `createReceivingReport` | admin/procurements/[id]/actions.js | CREATE_RECEIVING |
| `updateReceivingLine` | admin/procurements/[id]/actions.js | UPDATE_RECEIVING_LINE |
| `finalizeReceivingReport` | admin/procurements/[id]/actions.js | FINALIZE_RECEIVING |
| `createPickupSession` | admin/procurements/[id]/actions.js | CREATE_PICKUP_SESSION |
| `checkinOrder` | admin/procurements/[id]/actions.js | CHECKIN_ORDER |
| `closePickupSession` | admin/procurements/[id]/actions.js | CLOSE_PICKUP_SESSION |
| `updateDeliverySettings` | admin/procurements/[id]/actions.js | UPDATE_DELIVERY_SETTINGS |
| `recalcShares` | admin/procurements/[id]/actions.js | RECALC_DELIVERY_SHARES |
| `updatePaymentStatus` | admin/procurements/[id]/actions.js | UPDATE_PAYMENT_STATUS |
| `refundPayment` | admin/procurements/[id]/actions.js | ONLINE_PAYMENT_REFUNDED |

### Корзина и заказ (жителя)

| Действие | Файл | Аудит |
|----------|------|-------|
| `addToCart` | p/[code]/actions.js | — |
| `removeFromCart` | p/[code]/actions.js | — |
| `decreaseQty` | p/[code]/actions.js | — |
| `clearCart` | p/[code]/actions.js | — |
| `submitOrder` | p/[code]/actions.js | SUBMIT_ORDER (+ONLINE_PAYMENT_CREATED при онлайн-оплате) |

### Оплата

| Действие | Файл | Аудит |
|----------|------|-------|
| `createPayment` | my/orders/[orderId]/actions.js | ONLINE_PAYMENT_CREATED |

### Уведомления

| Действие | Файл |
|----------|------|
| `markNotificationRead` | my/notifications/actions.js |
| `markAllNotificationsRead` | my/notifications/actions.js |

---

## API-эндпоинты

### `GET /api/auth/logout`
Очищает cookie `cb_session`, redirect на `/`, `Cache-Control: no-store`.

### `GET /api/cron/auto-close`
Автозакрытие закупок. Защита: `Authorization: Bearer ${CRON_SECRET}`. Ответы: 200 `{ ok, closed }`, 401, 500.

### `POST /api/webhooks/yookassa`
Webhook ЮKassa. IP-whitelist (5 CIDR). Обрабатывает `payment.succeeded` и `payment.canceled`. Идемпотентный. Ответы: 200, 400, 403, 500.

### `GET /api/orders/[orderId]/payment-status`
Polling статуса оплаты. Auth: session + ownership. Активно проверяет ЮKassa API при PENDING. Ответ: `{ paymentStatus }`.

---

## Экспорт документов

### PDF (PDFKit + pdf-lib)

| Маршрут | Содержание | Формат |
|---------|-----------|--------|
| `receipt.pdf` | Квитанция жителя: данные закупки, участник, позиции (таблица 5 колонок), суммы, QR | A4, DejaVu Sans |
| `export.pdf` | Агрегированная сводка: title, supplier, таблица продуктов (5 кол.), итого | A4 |
| `report.pdf` | Полный отчёт: summary box, orders table (6 кол.), top categories (15), top products (20) | A4, multi-page safe |

PDF-движок:
- `pdfDoc.js` — создание PDFDocument + встраивание шрифта DejaVu (subset)
- `pdfFont.js` — путь к TTF
- `pdfLayout.js` — A4 (595.28 × 841.89), margin top 40 / bottom 50, ensurePage(), drawLine/Center/Right, drawHRule, drawParagraph (word-wrap)
- `pdfTable.js` — полный движок таблиц: word-wrap per cell, alternating rows, styled header, auto page break, right-align support

### XLSX (ExcelJS)

| Маршрут | Листы | Содержание |
|---------|-------|-----------|
| `export.xlsx` | Aggregation | Товары: наименование, категория, ед., кол-во, сумма + итого |
| `report.xlsx` | Summary, Orders, TopCategories, TopProducts | Полный отчёт (4 листа) |
| `payments.xlsx` | Orders | Участник, телефон, суммы, статус, дата, способ, ID ЮKassa |
| `receiving.xlsx` | Receiving | Наименование, ед., ожидалось, получено, Δ (цвет), комментарий |

### CSV (UTF-8 BOM, `;` разделитель)

| Маршрут | Содержание |
|---------|-----------|
| `export.csv` | Агрегированные товары |
| `receiving.csv` | Акт приёмки |

Все экспорты пишут аудит `EXPORT_DOC` с `meta.type` (e.g. `receipt_pdf`, `export_xlsx`).

---

## Компоненты UI

### Дизайн-система (тема: Calm Fintech)

Цветовая схема: indigo accent, stone-50 bg, dark zinc-950 admin sidebar.

### `AdminSidebar.jsx` (client)
- Sticky sidebar, hidden на mobile, visible lg+
- Навигация из `ADMIN_NAV_ITEMS` фильтрованная по роли
- Иконки: Phosphor Icons (SquaresFour, Package, QrCode, UsersThree, Buildings, MapPin, BookOpenText)
- Active state: exact match для dashboard, prefix для остальных

### `MyNavLinks.jsx` (client)
- Горизонтальные pill-tabs для `/my/`
- Иконки: ShoppingCart, Package, Bell
- Unread badge на notifications (9+ если > 9)

### `CopyLinkButton.jsx` (client)
- `navigator.clipboard.writeText()` → "Скопировано" (1.8 сек) → reset

### UI-компоненты (`src/components/ui/`)

| Компонент | Тип | Описание |
|-----------|-----|---------|
| `Button` | Server | 5 variants (primary/secondary/danger/ghost/success), 3 sizes, loading dots |
| `Badge` | Server | 7 variants (success/warning/danger/neutral/info/primary/purple) |
| `Card` | Server | Card + CardHeader + CardTitle + CardBody + StatCard (6 color variants) |
| `ActionForm` | Client | ActionButtonForm (useActionState + hidden fields + confirm dialog) + ActionMessage |
| `InlineMessage` | Server | 5 types (success/error/warning/info/neutral) |
| `EmptyState` | Server | Centered: icon + title + description + action |
| `PageHeader` | Server | eyebrow + h1 + description + actions + meta |
| `Pager` | Server | Link-based pagination, preserves query params |
| `SearchInput` | Client | Controlled input with MagnifyingGlass icon |
| `RouteStatus` | Client | PageLoadingState (skeleton) + RouteErrorState (error + retry) |

---

## Библиотека (`src/lib/`)

### auth.js
- `signSession(payload)` → JWT (HS256, 7d)
- `verifySession(token)` → payload | null
- `getSession()` → payload | null (memoized via React.cache, проверяет tokenVersion в БД)
- `setSessionCookie(payload)` → httpOnly, secure, sameSite: lax, 7d
- `clearSessionCookie()` → удаляет cookie
- `invalidateAllSessions(userId)` → increment tokenVersion

### guards.js
11 функций (описаны выше в разделе авторизации).

### db.js
Singleton PrismaClient с `@prisma/adapter-pg`. В dev: `globalThis.prisma` для hot-reload.

### validation.js (Zod-схемы)
- `loginSchema` — email, password (≥ 8)
- `registerSchema` — email, password, fullName (1-120), settlementId, phone (опц., ≤ 20)
- `createOperatorSchema` — email, password, fullName, pickupPointId
- `createResidentSchema` — email, password, fullName, settlementId, phone
- `createProcurementSchema` — title (3-200), deadlineAt, minTotalSum (≥ 0), deliveryFee (≥ 0), deliverySplitMode
- `submitOrderSchema` — participantName (2-120), participantPhone (regex `^(\+7|8)\d{10}$`)
- `updatePaymentSchema` — orderId, status (UNPAID/PAID/PAY_ON_PICKUP), method (опц.)

### constants.js
- `PAYMENT_LABELS` — RU-метки для PaymentStatus
- `PAYMENT_STATUS_TRANSITIONS` — допустимые переходы
- `PAYMENT_VARIANTS` — цвета badge
- `STATUS_LABELS` / `STATUS_VARIANTS` — для ProcurementStatus
- `ROLE_LABELS` — RU-метки ролей
- `ADMIN_NAV_ITEMS` — навигация admin (href, label, icon, roles[])
- `MY_NAV_ITEMS` — навигация resident
- `PUBLIC_PROCUREMENT_ACCESS_MESSAGES` — RU-сообщения ограничения доступа
- Функции: `getAllowedPaymentStatusTransitions`, `isAllowedPaymentStatusTransition`, `getPaymentStatusTransitionError`, `isAdminWorkspaceRole`, `isResidentRole`, `getAdminNavItems`, `canAccessAdminPath`

### rateLimit.js
Два бекенда (memory Map / PostgreSQL RateLimitBucket). `isLimited(key, max=5, windowMs=5min)`, `resetRateLimit(key)`.

### deliveryShares.js
`recalcDeliveryShares(procurementId, client?)` — largest remainder method, поддержка interactive transaction.

### notifications.js
`createNotification({userId, type, title, body, linkUrl})`, `createNotificationsMany(userIds, {...})`.

### orders.js (чистые функции)
`getItemsGoodsTotal(items)`, `getOrderTotals(order)`, `getOrdersGoodsTotal(orders)`, `getOrdersGrandTotal(orders)`.

### guestCart.js
`getGuestId()`, `getOrCreateGuestId()`, `clearGuestId()`, `mergeGuestDraftOrdersIntoUser(userId)`.

### pickupCode.js
`generateUniquePickupCode(tx, maxRetries=10)` — 6-значный код (100000-999999), проверка уникальности в транзакции.

### yookassa.js
Инициализация SDK: `paymentsApi`, `refundsApi`.

### audit.js
`buildActorAuditMeta(session, meta)`, `writeProcurementAudit(...)`, `writeOrderAudit(...)`, `buildProcurementAuditWhere(...)`.

### formUtils.js
`str(fd, key)`, `num(fd, key)` (запятая → точка), `bool(fd, key)` (on/true/1), `prismaNiceError(e)` (P2002/P2003 → RU).

### zodError.js
`firstZodError(err)`, `zodFieldErrors(err)` — маппинг Zod issues.

### baseUrl.js
`getBaseUrl()` — `NEXT_PUBLIC_APP_URL` || headers x-forwarded-* || `http://localhost:3000`.

### logger.js
Pino: `{ level: LOG_LEVEL || "info", base: { app: "coopbuy" } }`.

### logoutAction.js
Server Action: invalidateAllSessions → audit LOGOUT → clearCookie → revalidatePath → redirect.

### PDF-модули
- `pdfDoc.js` — `createPdfDoc()` → `{ pdf, font }`, `toPdfResponse(bytes, filename)`
- `pdfFont.js` — `getDejaVuFontPath()` → путь к TTF
- `pdfLayout.js` — A4, margins, `ensurePage`, `drawLine/Center/Right`, `drawHRule`, `drawParagraph`
- `pdfTable.js` — `drawTable({ pdf, page, y, font, colWidths, headers, rows, ... })` — полный движок с word-wrap, alternating rows, auto page break

### exportDocuments.js
`buildProcurementDocumentFilename(code, kind, ext)`, `buildOrderDocumentFilename(id, kind, ext)`.

---

## Тестирование

**194 теста** в **23 тест-файлах** (Vitest 4). Все проходят.

```bash
npm test                # unit + integration
npm run test:unit       # только unit
npm run test:integration # только интеграционные (требует TEST_DATABASE_URL)
```

### Тесты бизнес-логики

**deliveryShares.test.js** (10 тестов):
- EQUAL: делит поровну, сумма = deliveryFee при нечётном делении
- PROPORTIONAL_SUM: пропорционально сумме (25/75%), grandTotal = goods + delivery
- PER_ITEM: пропорционально количеству товаров, несколько позиций суммируются
- Граничные: fee=0, нет заказов, закупка не найдена, update с правильным id

**orders.test.js** (3 теста):
- Сумма товаров, fallback для totals, суммирование нескольких заказов

**notifications.test.js** (7 тестов):
- createNotification с правильными полями, null для linkUrl
- createNotificationsMany: записи для каждого userId, пустой/null массив, null linkUrl

**procurementState.test.js** (2 теста):
- Активная открытая закупка, закрытие из-за недобора

### Тесты аутентификации

**auth.test.js** (10 тестов):
- getSession: null без cookie, null при невалидном JWT, payload при валидном, отклонение устаревшего tokenVersion, null при удалённом пользователе, чтение cb_session
- setSessionCookie: httpOnly true, sameSite lax, maxAge 7d, path /, подпись JWT
- invalidateAllSessions: инкремент tokenVersion

**guards.test.js** (10 тестов):
- requireAccessibleProcurement: ADMIN → любая, OPERATOR → только свой ПВЗ, чужой ПВЗ → отказ, не найдена
- getResidentProcurementAccess: разрешение, login_required, wrong_role, wrong_settlement, minimum_not_reached

**rateLimit.test.js** (8 тестов):
- Memory: N попыток OK → N+1 блок, reset очищает, разные ключи
- DB: upsert, инкремент, блокировка, обновление окна, reset + swallow ошибки

### Тесты middleware

**middleware.test.js** (9 тестов):
- /admin/*: гость → login, RESIDENT → 403, OPERATOR → pass/block, ADMIN → pass, невалидный → login
- /my/*: гость → login, RESIDENT → pass, ADMIN → 403, OPERATOR → 403

### Тесты серверных действий

**procurements/actions.test.js** (1 тест):
- OPERATOR: принудительно использует свой pickup point и settlement

**procurements/[id]/actions.test.js** (14 тестов):
- updatePaymentStatus: 7 тестов переходов (UNPAID→PAID, PAY_ON_PICKUP→UNPAID, PAID→UNPAID блок, PENDING→PAID, PENDING→UNPAID, FAILED→PAID, FAILED→PAY_ON_PICKUP)
- updateDeliverySettings: сохраняет без заказов, блокирует с SUBMITTED, блокирует для CLOSED, разрешает без изменений
- checkinOrder: выдача + уведомление, без уведомления для гостя, блок повторной выдачи, требует sessionId/orderId, UNPAID блок

**checkinGuard.test.js** (11 тестов):
- assertOrderBelongsToProcurement: совпадение, несовпадение, null, undefined
- assertOrderCanCheckin: SUBMITTED+PAID ok, +PAY_ON_PICKUP ok, DRAFT/CANCELED/UNPAID/null → throw
- assertPickupSessionCanCheckin: PLANNED/ACTIVE ok, другая закупка/CLOSED/null → throw

**import/actions.test.js** (5 тестов):
- applyBatch: snapshot previousPrice (обновление/создание)
- undoBatch: restore prices, деактивация созданных, конфликт с newer batch, не-APPLIED batch, требует ADMIN

**import/csvParser.test.js** (21 тест):
- detectDelim: ; vs ,, равенство, отсутствие ;
- parseLine: разделители, кавычки, двойные кавычки, пробелы, пустые поля
- parseCSVText: пустой, пробелы, определение ; и ,, пустые строки
- autoDetectMapping: RU/EN колонки, артикул/изображение, нераспознанные, регистр
- buildClientPreviewState, buildClientPreviewErrorState

**users/actions.test.js** (2 теста):
- Inline-ошибка для дублирующегося email оператора
- Создание жителя с settlementId и телефоном

**register/actions.test.js** (1 тест):
- Человекочитаемая ошибка при дублирующемся email

**my/orders/[orderId]/actions.test.js** (12 тестов):
- createPayment: создание + redirect, сумма в рублях, increment paymentAttempt, receipt 54-ФЗ, без доставки если 0, retry при FAILED, чужой заказ, не SUBMITTED, PENDING/PAID блок, grandTotal ≤ 0, ошибка SDK

**p/[code]/actions.test.js** (9 тестов):
- Access guards: addToCart для anonymous/wrong role/wrong settlement, submitOrder для anonymous/wrong role/wrong settlement
- Race conditions: reject при closed procurement, expired deadline, allow при valid

### Тесты API

**cron.test.js** (5 тестов):
- 500 без CRON_SECRET, 401 без header, 401 при mismatch, 200 ok, 500 при internal error

**webhooks/yookassa.test.js** (13 тестов):
- IP whitelist (403, pass, /25 range), 400 для bad fields/JSON
- payment.succeeded → PAID (идемпотентно), 200 при order not found
- payment.canceled → FAILED, не перезаписывает PAID, не дублирует FAILED
- 200 для unknown event, 500 при DB error

### Интеграционный тест

**fullFlow.test.js** (1 тест, skip если нет TEST_DATABASE_URL):
- Полный сценарий: guest → resident → order → pay → checkin

### Утилиты

**formUtils.test.js** (15 тестов), **guestCart.test.js** (2 теста), **autoCloseExpired.test.js** (4 теста), **audit.test.js** (2 теста)

---

## Seed-данные

Seed (`prisma/seed.js`, CJS, запуск: `npm run db:reset`) создаёт:

### Территории
- **Регион**: Астраханская область
- **НП**: Солнечное, Новый Берег, Заречный
- **ПВЗ**: ПВЗ Центральный (ул. Центральная, 1, без морозильника), ПВЗ Северный (пр. Северный, 12), ПВЗ Холодный (ул. Ледовая, 5, с морозильником)

### Справочники
- **Категории**: Крупы, Молочное, Напитки, Консервы, Хозтовары
- **Единицы**: шт, кг, л, уп, пач

### Поставщики
| Поставщик | Телефон | minOrderSum | isActive |
|-----------|---------|------------|---------|
| АгроОпт-Юг | +7(900)100-01-01 | 8000 | true |
| СберПоставка | +7(900)100-01-02 | 5000 | true |
| НеАктивный | +7(900)100-01-03 | 10000 | false |

Оба активных имеют зоны доставки во все 3 НП.

### Товары (20 шт.)

**АгроОпт-Юг (11)**: Гречка 800г (125₽), Рис длиннозёрный 900г (115₽), Пшено 900г (92₽), Овсянка 500г (88₽), Молоко 3.2% 1л (78₽), Кефир 2.5% 1л (82₽), Масло сливочное 200г (198₽), Сыр Российский 400г (325₽), Вода питьевая 5л (155₽), Сок яблочный 1л (97₽), Губки кухонные 5 шт (92₽)

**СберПоставка (9)**: Сок томатный 1л (91₽), Компот вишнёвый 0.5л (67₽), Тушёнка говяжья 525г (290₽), Горошек зелёный 400г (74₽), Кукуруза сладкая 340г (70₽), Фасоль красная 400г (98₽), Порошок стиральный 3кг (455₽), Средство посудное 500мл (138₽), Мыло хозяйственное 200г (46₽)

### Пользователи

| Роль | Email | Пароль | ФИО | НП |
|------|-------|--------|-----|---|
| ADMIN | admin@local.test | Admin123! | Главный Администратор | — |
| OPERATOR | operator1@local.test | Operator123! | Оператор Первый | Солнечное (ПВЗ Центральный) |
| RESIDENT | user1@local.test | User123! | Иван Иванов | Солнечное |
| RESIDENT | user2@local.test | User123! | Мария Петрова | Солнечное |
| RESIDENT | user3@local.test | User123! | Алексей Смирнов | Новый Берег |
| RESIDENT | user4@local.test | User123! | Елена Кузнецова | Новый Берег |
| RESIDENT | user5@local.test | User123! | Сергей Павлов | Солнечное |

### Закупки (3)

| inviteCode | Название | Статус | deliveryFee | splitMode | Поставщик | НП |
|-----------|---------|--------|-------------|-----------|-----------|---|
| SEED-OPEN-1 | Закупка №1 — АгроОпт (открыта) | OPEN | 1200 | PROPORTIONAL_SUM | АгроОпт-Юг | Солнечное |
| SEED-OPEN-2 | Закупка №2 — СберПоставка (открыта) | OPEN | 600 | EQUAL | СберПоставка | Новый Берег |
| SEED-CLOSED-1 | Закупка №3 — АгроОпт (завершена) | CLOSED | 500 | PER_ITEM | АгроОпт-Юг | Солнечное |

### Заказы (6, все SUBMITTED)

| Закупка | Пользователь | Товары | Оплата | Код |
|---------|-------------|--------|--------|-----|
| №1 | user1 | Гречка×2, Молоко×1, Вода×1 | PAID (перевод, 20.02) | 100001 |
| №1 | user2 | Рис×1, Кефир×2 | PAY_ON_PICKUP | 100002 |
| №1 | user5 | Пшено×3, Сок яблочный×2 | UNPAID | 100003 |
| №2 | user3 | Сок томатный×2, Компот×1, Тушёнка×1 | PAID (наличные, 22.02) | 100004 |
| №2 | user4 | Горошек×2, Кукуруза×3 | UNPAID | 100005 |
| №3 | user1 | Гречка×2, Молоко×1 | PAID (перевод, 22.01) | 100006 |

### Дополнительные данные
- **PickupSession** для закупки №3: CLOSED, с чекином user1
- **PickupSession** для закупки №1: ACTIVE, с чекином user1
- **ReceivingReport** для закупки №3: FINAL (Гречка: 10→9 "1 уп. повреждена", Молоко: 5→5)
- **Notifications**: 5 типов для user1 и user2
- **AuditLog**: 16 записей (CREATE/CLOSE/SUBMIT/CHECKIN/UPDATE/...)

---

## Развёртывание

### Docker (3 стадии)

```dockerfile
# 1. deps: node:20-alpine, libc6-compat, openssl, npm ci
# 2. builder: prisma generate + next build (standalone)
# 3. runner: node:20-alpine, user nextjs:1001, PORT=3000
```

```bash
docker build -t coopbuy .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e AUTH_SECRET="..." \
  -e CRON_SECRET="..." \
  coopbuy
```

Перед первым запуском: `npx prisma migrate deploy`.

### Vercel
- `next build` из коробки
- `vercel.json`: cron `/api/cron/auto-close` каждые 15 минут
- Переменные в Project Settings

### Cron (self-host)
```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://coopbuy.example.com/api/cron/auto-close
```
Systemd timer с `OnCalendar=*:0/15` или Windows Task Scheduler.

---

## Запуск для разработки

```bash
npm install
cp .env.example .env    # настроить DATABASE_URL, AUTH_SECRET, ...
npm run db:reset         # миграции + seed
npm run dev              # http://localhost:3000
```

---

## Переменные окружения

| Переменная | Обяз. | Назначение |
|-----------|-------|-----------|
| `DATABASE_URL` | Да | PostgreSQL connection string |
| `AUTH_SECRET` | Да | JWT secret (≥ 32 символов, `openssl rand -base64 32`) |
| `CRON_SECRET` | Да | Bearer-токен для `/api/cron/*` |
| `LOG_LEVEL` | Нет | Pino: trace/debug/info/warn/error/fatal (default: info) |
| `YOOKASSA_SHOP_ID` | Нет | ID магазина ЮKassa |
| `YOOKASSA_SECRET_KEY` | Нет | Секретный ключ ЮKassa |
| `YOOKASSA_SKIP_IP_CHECK` | Нет | `true` для отключения IP-whitelist в dev |
| `NEXT_PUBLIC_APP_URL` | Нет | Базовый URL приложения (для инвайт-ссылок) |
| `RATE_LIMIT_BACKEND` | Нет | `memory` для in-memory rate limiter |
| `TEST_DATABASE_URL` | Нет | БД для интеграционных тестов |

---

## Тестовые учётные записи

Создаются при `npm run db:reset`:

| Роль | Email | Пароль |
|------|-------|--------|
| ADMIN | admin@local.test | Admin123! |
| OPERATOR | operator1@local.test | Operator123! |
| RESIDENT | user1@local.test | User123! |
| RESIDENT | user2@local.test | User123! |
| RESIDENT | user3@local.test | User123! |
| RESIDENT | user4@local.test | User123! |
| RESIDENT | user5@local.test | User123! |

---

## Документация проекта

| Файл | Описание |
|------|---------|
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Инструкция по запуску, проверке и smoke-тестированию |
| [docs/IMPLEMENTATION_ALIGNMENT.md](docs/IMPLEMENTATION_ALIGNMENT.md) | Соответствие реализации требованиям ТЗ, ключевые дизайн-решения |
| [docs/PRD_YUKASSA.md](docs/PRD_YUKASSA.md) | Требования к интеграции ЮKassa |
| [docs/migrations.md](docs/migrations.md) | Описание миграций и процедура отката |
| [docs/coopbuy-erd.drawio](docs/coopbuy-erd.drawio) | ER-диаграмма (формат draw.io) |
| [docs/coopbuy.dbml](docs/coopbuy.dbml) | Схема БД в формате DBML |
| [docs/coopbuy.sql](docs/coopbuy.sql) | SQL-экспорт схемы |
