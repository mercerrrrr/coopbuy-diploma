"use server";

import { prisma } from "@/lib/db";
import { str, prismaNiceError } from "@/lib/formUtils";
import { revalidatePath } from "next/cache";

// ── Category ──────────────────────────────────────────────

export async function createCategory(_prev, fd) {
  const name = str(fd, "name");
  if (!name) return { ok: false, message: "Название не может быть пустым." };

  try {
    await prisma.category.create({ data: { name } });
    revalidatePath("/admin/dictionaries");
    return { ok: true, message: "Категория добавлена." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: prismaNiceError(e) };
  }
}

export async function deleteCategory(fd) {
  const id = str(fd, "id");
  if (!id) throw new Error("id не передан.");

  try {
    await prisma.category.delete({ where: { id } });
    revalidatePath("/admin/dictionaries");
  } catch (e) {
    console.error(e);
    throw new Error(prismaNiceError(e));
  }
}

// ── Unit ──────────────────────────────────────────────────

export async function createUnit(_prev, fd) {
  const name = str(fd, "name");
  if (!name) return { ok: false, message: "Название не может быть пустым." };

  try {
    await prisma.unit.create({ data: { name } });
    revalidatePath("/admin/dictionaries");
    return { ok: true, message: "Единица добавлена." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: prismaNiceError(e) };
  }
}

export async function deleteUnit(fd) {
  const id = str(fd, "id");
  if (!id) throw new Error("id не передан.");

  try {
    await prisma.unit.delete({ where: { id } });
    revalidatePath("/admin/dictionaries");
  } catch (e) {
    console.error(e);
    throw new Error(prismaNiceError(e));
  }
}
