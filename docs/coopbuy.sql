-- CoopBuy — доменная модель БД (для импорта в drawio)
--
-- ИМПОРТ В DRAWIO:
--   1. https://app.diagrams.net → новая пустая диаграмма
--   2. В правой панели "Упорядочить" (Arrange) нажми "+" → "Дополнительно" → SQL
--      ИЛИ через меню сверху: Дополнительно → Изменить диаграмму
--      ИЛИ: Extras → Edit Diagram (если английский интерфейс)
--   3. ВАЖНО: выбрать диалект "MySQL" в выпадающем списке наверху окна SQL
--      (у drawio MySQL-парсер надёжнее, чем PostgreSQL)
--   4. Удалить пример, вставить ВЕСЬ этот файл, нажать Insert / Вставить
--   5. Ctrl+A → Упорядочить → Макет → Органический макет
--      (Arrange → Layout → Organic Layout)

CREATE TABLE Region (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  createdAt DATETIME
);

CREATE TABLE Settlement (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  regionId VARCHAR(64) NOT NULL REFERENCES Region(id),
  createdAt DATETIME
);

CREATE TABLE PickupPoint (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  hasFreezer BOOLEAN,
  settlementId VARCHAR(64) NOT NULL REFERENCES Settlement(id)
);

CREATE TABLE Users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  passwordHash VARCHAR(255) NOT NULL,
  fullName VARCHAR(255) NOT NULL,
  phone VARCHAR(64),
  role VARCHAR(32) NOT NULL,
  settlementId VARCHAR(64) REFERENCES Settlement(id),
  pickupPointId VARCHAR(64) REFERENCES PickupPoint(id)
);

CREATE TABLE Supplier (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  minOrderSum INT,
  phone VARCHAR(64),
  email VARCHAR(255),
  isActive BOOLEAN
);

CREATE TABLE SupplierDeliveryZone (
  id VARCHAR(64) PRIMARY KEY,
  supplierId VARCHAR(64) NOT NULL REFERENCES Supplier(id),
  settlementId VARCHAR(64) NOT NULL REFERENCES Settlement(id),
  isActive BOOLEAN
);

CREATE TABLE Category (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE Unit (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE Product (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price INT NOT NULL,
  sku VARCHAR(128),
  imageUrl VARCHAR(512),
  isActive BOOLEAN,
  supplierId VARCHAR(64) NOT NULL REFERENCES Supplier(id),
  categoryId VARCHAR(64) NOT NULL REFERENCES Category(id),
  unitId VARCHAR(64) NOT NULL REFERENCES Unit(id)
);

CREATE TABLE Procurement (
  id VARCHAR(64) PRIMARY KEY,
  status VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  inviteCode VARCHAR(128) NOT NULL UNIQUE,
  deadlineAt DATETIME NOT NULL,
  minTotalSum INT,
  pickupWindowStart DATETIME,
  pickupWindowEnd DATETIME,
  deliveryFee INT,
  deliverySplitMode VARCHAR(32),
  supplierId VARCHAR(64) NOT NULL REFERENCES Supplier(id),
  settlementId VARCHAR(64) NOT NULL REFERENCES Settlement(id),
  pickupPointId VARCHAR(64) NOT NULL REFERENCES PickupPoint(id)
);

CREATE TABLE Orders (
  id VARCHAR(64) PRIMARY KEY,
  status VARCHAR(32) NOT NULL,
  guestId VARCHAR(64),
  userId VARCHAR(64) REFERENCES Users(id),
  participantName VARCHAR(255),
  participantPhone VARCHAR(64),
  procurementId VARCHAR(64) NOT NULL REFERENCES Procurement(id),
  goodsTotal INT,
  deliveryShare INT,
  grandTotal INT,
  paymentStatus VARCHAR(32),
  paidAt DATETIME,
  paymentMethod VARCHAR(64)
);

CREATE TABLE OrderItem (
  id VARCHAR(64) PRIMARY KEY,
  orderId VARCHAR(64) NOT NULL REFERENCES Orders(id),
  productId VARCHAR(64) NOT NULL REFERENCES Product(id),
  qty INT NOT NULL,
  price INT NOT NULL
);

CREATE TABLE ReceivingReport (
  id VARCHAR(64) PRIMARY KEY,
  status VARCHAR(32) NOT NULL,
  notes VARCHAR(512),
  procurementId VARCHAR(64) NOT NULL UNIQUE REFERENCES Procurement(id)
);

CREATE TABLE ReceivingLine (
  id VARCHAR(64) PRIMARY KEY,
  reportId VARCHAR(64) NOT NULL REFERENCES ReceivingReport(id),
  productId VARCHAR(64) NOT NULL REFERENCES Product(id),
  expectedQty INT NOT NULL,
  receivedQty INT NOT NULL,
  comment VARCHAR(512)
);

CREATE TABLE PickupSession (
  id VARCHAR(64) PRIMARY KEY,
  status VARCHAR(32) NOT NULL,
  startAt DATETIME,
  endAt DATETIME,
  procurementId VARCHAR(64) NOT NULL UNIQUE REFERENCES Procurement(id)
);

CREATE TABLE PickupCheckin (
  id VARCHAR(64) PRIMARY KEY,
  checkedAt DATETIME NOT NULL,
  note VARCHAR(512),
  sessionId VARCHAR(64) NOT NULL REFERENCES PickupSession(id),
  orderId VARCHAR(64) NOT NULL UNIQUE REFERENCES Orders(id),
  operatorUserId VARCHAR(64)
);
