require("dotenv/config");

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

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

  await prisma.product.deleteMany({ where: { supplierId: supplier.id } });

  await prisma.product.createMany({
    data: [
      { supplierId: supplier.id, name: "Гречка 800г", category: "Крупы", unit: "шт", price: 120 },
      { supplierId: supplier.id, name: "Рис 900г", category: "Крупы", unit: "шт", price: 110 },
      { supplierId: supplier.id, name: "Порошок 3кг", category: "Хозтовары", unit: "шт", price: 450 },
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
