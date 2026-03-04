require("dotenv/config");

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const bcrypt = require("bcryptjs");

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const region = await prisma.region.upsert({
    where: { name: "Астраханская область" },
    update: {},
    create: { name: "Астраханская область" },
  });

  const settlement = await prisma.settlement.upsert({
    where: {
      regionId_name: { regionId: region.id, name: "Новолесное" },
    },
    update: {},
    create: { name: "Новолесное", regionId: region.id },
  });

  const existingPickup = await prisma.pickupPoint.findFirst({
    where: { settlementId: settlement.id, name: "Пункт выдачи №1" },
  });

  if (!existingPickup) {
    await prisma.pickupPoint.create({
      data: {
        settlementId: settlement.id,
        name: "Пункт выдачи №1",
        address: "Центральная улица, дом 1 (ориентир: магазин)",
        hasFreezer: false,
      },
    });
  }

  let supplier = await prisma.supplier.findFirst({
    where: { name: "Оптовик-Юг" },
  });

  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: {
        name: "Оптовик-Юг",
        phone: "+7 (900) 000-00-00",
        email: "supplier@example.com",
        minOrderSum: 10000,
      },
    });
  }

  await prisma.supplierDeliveryZone.upsert({
    where: {
      supplierId_settlementId: {
        supplierId: supplier.id,
        settlementId: settlement.id,
      },
    },
    update: { isActive: true },
    create: { supplierId: supplier.id, settlementId: settlement.id },
  });

  // Seed ADMIN user
  await prisma.user.upsert({
    where: { email: "admin@local.test" },
    update: {},
    create: {
      email: "admin@local.test",
      passwordHash: await bcrypt.hash("Admin123!", 10),
      fullName: "Администратор",
      role: "ADMIN",
    },
  });

  // Seed OPERATOR user (linked to first available pickup point)
  const pp = await prisma.pickupPoint.findFirst();
  if (pp) {
    await prisma.user.upsert({
      where: { email: "operator1@local.test" },
      update: {},
      create: {
        email: "operator1@local.test",
        passwordHash: await bcrypt.hash("Operator123!", 10),
        fullName: "Оператор Один",
        role: "OPERATOR",
        pickupPointId: pp.id,
      },
    });
  }

  // Upsert Category dictionary entries
  const catKrupy = await prisma.category.upsert({
    where: { name: "Крупы" },
    update: {},
    create: { name: "Крупы" },
  });
  const catHoz = await prisma.category.upsert({
    where: { name: "Хозтовары" },
    update: {},
    create: { name: "Хозтовары" },
  });

  // Upsert Unit dictionary entry
  const unitSht = await prisma.unit.upsert({
    where: { name: "шт" },
    update: {},
    create: { name: "шт" },
  });

  await prisma.product.deleteMany({ where: { supplierId: supplier.id } });

  await prisma.product.createMany({
    data: [
      { supplierId: supplier.id, name: "Гречка 800г", categoryId: catKrupy.id, unitId: unitSht.id, price: 120 },
      { supplierId: supplier.id, name: "Рис 900г",    categoryId: catKrupy.id, unitId: unitSht.id, price: 110 },
      { supplierId: supplier.id, name: "Порошок 3кг", categoryId: catHoz.id,   unitId: unitSht.id, price: 450 },
    ],
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
