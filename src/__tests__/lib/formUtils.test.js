import { describe, it, expect } from "vitest";
import { str, num, bool, prismaNiceError } from "@/lib/formUtils";

// Helper: build FormData from plain object
function fd(data = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) {
    f.append(k, String(v));
  }
  return f;
}

// ─────────────────────────────────────────────
// str()
// ─────────────────────────────────────────────
describe("str()", () => {
  it("возвращает строку, обрезая пробелы по краям", () => {
    expect(str(fd({ name: "  привет  " }), "name")).toBe("привет");
  });

  it("возвращает пустую строку для отсутствующего ключа", () => {
    expect(str(fd(), "missing")).toBe("");
  });

  it("не трогает пробелы внутри строки", () => {
    expect(str(fd({ v: " a b c " }), "v")).toBe("a b c");
  });

  it("возвращает пустую строку для пустого значения", () => {
    expect(str(fd({ v: "" }), "v")).toBe("");
  });
});

// ─────────────────────────────────────────────
// num()
// ─────────────────────────────────────────────
describe("num()", () => {
  it("парсит целое число", () => {
    expect(num(fd({ v: "42" }), "v")).toBe(42);
  });

  it("парсит дробное с точкой", () => {
    expect(num(fd({ v: "3.14" }), "v")).toBe(3.14);
  });

  it("парсит дробное с запятой (русская локаль)", () => {
    expect(num(fd({ v: "3,14" }), "v")).toBe(3.14);
  });

  it("возвращает NaN для нечислового значения", () => {
    expect(num(fd({ v: "abc" }), "v")).toBeNaN();
  });

  it("возвращает 0 для отсутствующего ключа (пустая строка → 0)", () => {
    // Number("") === 0 — намеренное поведение функции
    expect(num(fd(), "v")).toBe(0);
  });

  it("парсит отрицательное число", () => {
    expect(num(fd({ v: "-100" }), "v")).toBe(-100);
  });
});

// ─────────────────────────────────────────────
// bool()
// ─────────────────────────────────────────────
describe("bool()", () => {
  it('"on" → true (чекбокс HTML)', () => {
    expect(bool(fd({ v: "on" }), "v")).toBe(true);
  });

  it('"true" → true', () => {
    expect(bool(fd({ v: "true" }), "v")).toBe(true);
  });

  it('"1" → true', () => {
    expect(bool(fd({ v: "1" }), "v")).toBe(true);
  });

  it('"false" → false', () => {
    expect(bool(fd({ v: "false" }), "v")).toBe(false);
  });

  it('"0" → false', () => {
    expect(bool(fd({ v: "0" }), "v")).toBe(false);
  });

  it("отсутствующий ключ → false", () => {
    expect(bool(fd(), "v")).toBe(false);
  });

  it('"yes" → false (только on/true/1)', () => {
    expect(bool(fd({ v: "yes" }), "v")).toBe(false);
  });
});

// ─────────────────────────────────────────────
// prismaNiceError()
// ─────────────────────────────────────────────
describe("prismaNiceError()", () => {
  it("P2002 → сообщение про уникальность", () => {
    const msg = prismaNiceError({ code: "P2002" });
    expect(msg).toContain("уникальность");
  });

  it("P2003 → сообщение про связанные записи", () => {
    const msg = prismaNiceError({ code: "P2003" });
    expect(msg).toContain("связанные");
  });

  it("неизвестный код → общее сообщение об ошибке БД", () => {
    const msg = prismaNiceError({ code: "P9999" });
    expect(msg).toContain("Ошибка");
  });

  it("null → общее сообщение (не выбрасывает)", () => {
    const msg = prismaNiceError(null);
    expect(msg).toContain("Ошибка");
  });

  it("без кода → общее сообщение", () => {
    const msg = prismaNiceError({ message: "something" });
    expect(msg).toContain("Ошибка");
  });
});
