import { z } from "zod";

const optionalPhoneSchema = z
  .string()
  .trim()
  .max(20, "Телефон слишком длинный.")
  .optional();

const createUserBaseSchema = z.object({
  email: z.string().trim().email("Некорректный email."),
  password: z.string().min(8, "Пароль должен содержать минимум 8 символов."),
  fullName: z
    .string()
    .trim()
    .min(1, "Введите полное имя.")
    .max(120, "Имя слишком длинное."),
});

// ──────────── Auth ────────────

export const loginSchema = z.object({
  email: z.string().email("Некорректный email."),
  password: z.string().min(8, "Пароль должен содержать минимум 8 символов."),
});

export const registerSchema = z.object({
  email: z.string().email("Некорректный email."),
  password: z.string().min(8, "Пароль должен содержать минимум 8 символов."),
  fullName: z
    .string()
    .trim()
    .min(1, "Введите полное имя.")
    .max(120, "Имя слишком длинное."),
  settlementId: z.string().min(1, "Выберите населённый пункт."),
  phone: optionalPhoneSchema,
});

export const createOperatorSchema = createUserBaseSchema.extend({
  pickupPointId: z.string().min(1, "Выберите пункт выдачи."),
});

export const createResidentSchema = createUserBaseSchema.extend({
  settlementId: z.string().min(1, "Выберите населённый пункт."),
  phone: optionalPhoneSchema,
});

// ──────────── Procurement ────────────

export const createProcurementSchema = z.object({
  title: z
    .string()
    .min(3, "Название должно быть не менее 3 символов.")
    .max(200, "Название слишком длинное."),
  deadlineAt: z.string().min(1, "Укажите дедлайн."),
  minTotalSum: z.number().int().min(0, "Мин. сумма должна быть ≥ 0."),
  deliveryFee: z.number().int().min(0, "Стоимость доставки должна быть ≥ 0."),
  deliverySplitMode: z.enum(
    ["PROPORTIONAL_SUM", "EQUAL", "PER_ITEM"],
    {
      errorMap: () => ({
        message: "Некорректный режим разделения доставки.",
      }),
    }
  ),
});

// ──────────── Order ────────────

const RU_PHONE_RE = /^(\+7|8)\d{10}$/;

export const submitOrderSchema = z.object({
  participantName: z
    .string()
    .trim()
    .min(2, "Укажите имя (минимум 2 символа).")
    .max(120, "Имя участника слишком длинное."),
  participantPhone: z
    .string()
    .trim()
    .min(1, "Укажите телефон.")
    .max(20, "Телефон слишком длинный.")
    .regex(RU_PHONE_RE, "Телефон: +7XXXXXXXXXX или 8XXXXXXXXXX."),
});

// ──────────── Payment ────────────

export const updatePaymentSchema = z.object({
  orderId: z.string().min(1, "Не указана заявка."),
  status: z.enum(["UNPAID", "PAID", "PAY_ON_PICKUP"], {
    errorMap: () => ({ message: "Некорректный статус оплаты." }),
  }),
  method: z.string().optional(),
});
