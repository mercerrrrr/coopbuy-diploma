export function str(fd, key) {
  return String(fd.get(key) ?? "").trim();
}

export function num(fd, key) {
  const raw = str(fd, key).replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

export function bool(fd, key) {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function prismaNiceError(e) {
  const code = e?.code;
  if (code === "P2002") return "Уже существует запись с таким значением (уникальность).";
  if (code === "P2003") return "Нельзя выполнить: есть связанные записи.";
  return "Ошибка базы данных. Подробности в терминале.";
}
