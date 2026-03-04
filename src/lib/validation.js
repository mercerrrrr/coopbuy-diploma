import { z } from "zod";

// ──────────── Auth ────────────

export const loginSchema = z.object({
  email: z.string().email("Некорректный email."),
  password: z.string().min(1, "Введите пароль."),
});

export const registerSchema = z.object({
  email: z.string().email("Некорректный email."),
  password: z.string().min(8, "Пароль должен содержать минимум 8 символов."),
  fullName: z.string().min(1, "Введите полное имя."),
  settlementId: z.string().min(1, "Выберите населённый пункт."),
  phone: z.string().optional(),
});

// ──────────── Procurement ────────────

export const createProcurementSchema = z.object({
  title: z.string().min(3, "Название должно быть не менее 3 символов.").max(200, "Название слишком длинное."),
  deadlineAt: z.string().min(1, "Укажите дедлайн."),
  minTotalSum: z.number().int().min(0, "Мин. сумма должна быть ≥ 0."),
  deliveryFee: z.number().int().min(0, "Стоимость доставки должна быть ≥ 0."),
  deliverySplitMode: z.enum(["PROPORTIONAL_SUM", "EQUAL"], {
    errorMap: () => ({ message: "Некорректный режим разделения доставки." }),
  }),
});

// ──────────── Order ────────────

const RU_PHONE_RE = /^(\+7|8)\d{10}$/;

export const submitOrderSchema = z.object({
  participantName: z
    .string()
    .min(2, "Укажите имя (минимум 2 символа)."),
  participantPhone: z
    .string()
    .min(1, "Укажите телефон.")
    .regex(RU_PHONE_RE, "Телефон: +7XXXXXXXXXX или 8XXXXXXXXXX."),
});

// ──────────── Payment ────────────

export const updatePaymentSchema = z.object({
  orderId: z.string().min(1, "orderId обязателен."),
  status: z.enum(["UNPAID", "PAID", "WAIVED"], {
    errorMap: () => ({ message: "Некорректный статус оплаты." }),
  }),
  method: z.string().optional(),
});
