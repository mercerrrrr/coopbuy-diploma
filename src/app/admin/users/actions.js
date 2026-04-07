"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/guards";
import { str } from "@/lib/formUtils";
import { createOperatorSchema, createResidentSchema } from "@/lib/validation";
import { zodFieldErrors } from "@/lib/zodError";

function fail(message, fieldErrors = {}) {
  return { ok: false, message, fieldErrors };
}

function ok(message) {
  return { ok: true, message, fieldErrors: {} };
}

export async function createOperator(_prev, fd) {
  await assertAdmin();

  const payload = {
    email: str(fd, "email").toLowerCase(),
    password: str(fd, "password"),
    fullName: str(fd, "fullName"),
    pickupPointId: str(fd, "pickupPointId"),
  };

  const parsed = createOperatorSchema.safeParse(payload);
  if (!parsed.success) {
    return fail("Проверьте заполнение формы оператора.", zodFieldErrors(parsed.error));
  }

  const { email, password, fullName, pickupPointId } = parsed.data;

  const [existingUser, pickupPoint] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.pickupPoint.findUnique({
      where: { id: pickupPointId },
      select: {
        id: true,
        name: true,
        settlementId: true,
        settlement: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  if (existingUser) {
    return fail("Не удалось создать оператора.", {
      email: "Пользователь с таким email уже существует.",
    });
  }

  if (!pickupPoint) {
    return fail("Не удалось создать оператора.", {
      pickupPointId: "Пункт выдачи не найден.",
    });
  }

  const passwordHash = await hash(password, 10);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      role: "OPERATOR",
      pickupPointId: pickupPoint.id,
      settlementId: pickupPoint.settlementId,
    },
  });

  revalidatePath("/admin/users");
  return ok(`Оператор создан и привязан к ПВЗ «${pickupPoint.name}».`);
}

export async function createResident(_prev, fd) {
  await assertAdmin();

  const payload = {
    email: str(fd, "email").toLowerCase(),
    password: str(fd, "password"),
    fullName: str(fd, "fullName"),
    settlementId: str(fd, "settlementId"),
    phone: str(fd, "phone") || undefined,
  };

  const parsed = createResidentSchema.safeParse(payload);
  if (!parsed.success) {
    return fail("Проверьте заполнение формы жителя.", zodFieldErrors(parsed.error));
  }

  const { email, password, fullName, settlementId, phone } = parsed.data;

  const [existingUser, settlement] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.settlement.findUnique({
      where: { id: settlementId },
      select: {
        id: true,
        name: true,
        region: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  if (existingUser) {
    return fail("Не удалось создать жителя.", {
      email: "Пользователь с таким email уже существует.",
    });
  }

  if (!settlement) {
    return fail("Не удалось создать жителя.", {
      settlementId: "Населённый пункт не найден.",
    });
  }

  const passwordHash = await hash(password, 10);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      phone: phone || null,
      role: "RESIDENT",
      settlementId: settlement.id,
    },
  });

  revalidatePath("/admin/users");
  return ok(`Житель создан для населённого пункта «${settlement.name}».`);
}
