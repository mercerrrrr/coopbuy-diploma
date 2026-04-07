// ── Payment status ────────────────────────────────────────────────────────────

export const PAYMENT_LABELS = {
  UNPAID: "Не оплачено",
  PAID: "Оплачено",
  PAY_ON_PICKUP: "Оплата при выдаче",
};

export const PAYMENT_STATUS_TRANSITIONS = {
  UNPAID: ["PAID", "PAY_ON_PICKUP"],
  PAY_ON_PICKUP: ["PAID", "UNPAID"],
  PAID: [],
};

export const PAYMENT_VARIANTS = {
  UNPAID: "danger",
  PAID: "success",
  PAY_ON_PICKUP: "info",
};

export function getAllowedPaymentStatusTransitions(status) {
  return PAYMENT_STATUS_TRANSITIONS[status] ?? [];
}

export function isAllowedPaymentStatusTransition(fromStatus, toStatus) {
  return getAllowedPaymentStatusTransitions(fromStatus).includes(toStatus);
}

export function getPaymentStatusTransitionError(fromStatus, toStatus) {
  if (!PAYMENT_LABELS[fromStatus] || !PAYMENT_LABELS[toStatus]) {
    return "Некорректный статус оплаты.";
  }
  if (fromStatus === toStatus) {
    return `Статус оплаты уже установлен: ${PAYMENT_LABELS[toStatus]}.`;
  }
  return `Нельзя изменить статус оплаты с «${PAYMENT_LABELS[fromStatus]}» на «${PAYMENT_LABELS[toStatus]}».`;
}

// ── Procurement status ────────────────────────────────────────────────────────

export const STATUS_LABELS = {
  DRAFT: "Черновик",
  OPEN: "Открыта",
  CLOSED: "Закрыта",
  CANCELED: "Отменена",
};

export const STATUS_VARIANTS = {
  DRAFT: "neutral",
  OPEN: "success",
  CLOSED: "neutral",
  CANCELED: "danger",
};

export const PUBLIC_PROCUREMENT_ACCESS_MESSAGES = {
  login_required:
    "Просмотр закупки доступен всем, но для участия нужно войти в аккаунт жителя.",
  wrong_role: "Оформление заявок доступно только пользователям с ролью жителя.",
  wrong_settlement:
    "Эта закупка доступна только жителям соответствующего населённого пункта.",
  deadline_closed: "Приём заявок завершён.",
  minimum_not_reached:
    "Минимальная сумма закупки не достигнута. Закупка закрыта и переведена в архив.",
};

// ── Roles and navigation ─────────────────────────────────────────────────────

export const ROLE_LABELS = {
  ADMIN: "Администратор",
  OPERATOR: "Оператор",
  RESIDENT: "Участник",
};

export const ADMIN_NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Обзор", icon: "SquaresFour", roles: ["ADMIN", "OPERATOR"] },
  { href: "/admin/procurements", label: "Закупки", icon: "Package", roles: ["ADMIN", "OPERATOR"] },
  { href: "/admin/users", label: "Пользователи", icon: "UsersThree", roles: ["ADMIN"] },
  { href: "/admin/suppliers", label: "Поставщики", icon: "Buildings", roles: ["ADMIN"] },
  { href: "/admin/locations", label: "Территории", icon: "MapPin", roles: ["ADMIN"] },
  { href: "/admin/dictionaries", label: "Справочники", icon: "BookOpenText", roles: ["ADMIN"] },
];

export const MY_NAV_ITEMS = [
  { href: "/my/procurements", label: "Закупки", icon: "ShoppingCart" },
  { href: "/my/orders", label: "Заказы", icon: "Package" },
  { href: "/my/notifications", label: "Уведомления", icon: "Bell" },
];

export function isAdminWorkspaceRole(role) {
  return role === "ADMIN" || role === "OPERATOR";
}

export function isResidentRole(role) {
  return role === "RESIDENT";
}

export function getAdminNavItems(role) {
  return ADMIN_NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function canAccessAdminPath(pathname, role) {
  if (!isAdminWorkspaceRole(role)) return false;

  return ADMIN_NAV_ITEMS.some((item) => {
    if (!item.roles.includes(role)) return false;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  });
}
