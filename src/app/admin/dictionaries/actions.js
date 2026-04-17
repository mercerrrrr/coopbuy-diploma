"use server";

import { prisma } from "@/lib/db";
import { str, prismaNiceError } from "@/lib/formUtils";
import { revalidatePath } from "next/cache";
import { assertOperatorOrAdmin } from "@/lib/guards";
import { logger } from "@/lib/logger";

// ── Category ──────────────────────────────────────────────

export async function createCategory(_prev, fd) {
  await assertOperatorOrAdmin();
  const name = str(fd, "name");
  if (!name) return { ok: false, message: "Название не может быть пустым." };

  try {
    await prisma.category.create({ data: { name } });
    revalidatePath("/admin/dictionaries");
    return { ok: true, message: "Категория добавлена." };
  } catch (e) {
    logger.error({ err: e, op: "createCategory" }, "category create failed");
    return { ok: false, message: prismaNiceError(e) };
  }
}

export async function deleteCategory(_prev, fd) {
  await assertOperatorOrAdmin();
  const id = str(fd, "id");
  if (!id) return { ok: false, message: "Не передана категория." };

  try {
    await prisma.category.delete({ where: { id } });
    revalidatePath("/admin/dictionaries");
    return { ok: true, message: "Категория удалена." };
  } catch (e) {
    logger.error({ err: e, op: "deleteCategory" }, "category delete failed");
    return { ok: false, message: prismaNiceError(e) };
  }
}

// ── Unit ──────────────────────────────────────────────────

export async function createUnit(_prev, fd) {
  await assertOperatorOrAdmin();
  const name = str(fd, "name");
  if (!name) return { ok: false, message: "Название не может быть пустым." };

  try {
    await prisma.unit.create({ data: { name } });
    revalidatePath("/admin/dictionaries");
    return { ok: true, message: "Единица добавлена." };
  } catch (e) {
    logger.error({ err: e, op: "createUnit" }, "unit create failed");
    return { ok: false, message: prismaNiceError(e) };
  }
}

export async function deleteUnit(_prev, fd) {
  await assertOperatorOrAdmin();
  const id = str(fd, "id");
  if (!id) return { ok: false, message: "Не передана единица измерения." };

  try {
    await prisma.unit.delete({ where: { id } });
    revalidatePath("/admin/dictionaries");
    return { ok: true, message: "Единица измерения удалена." };
  } catch (e) {
    logger.error({ err: e, op: "deleteUnit" }, "unit delete failed");
    return { ok: false, message: prismaNiceError(e) };
  }
}
