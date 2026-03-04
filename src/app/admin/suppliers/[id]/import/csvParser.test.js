import { describe, it, expect } from "vitest";
import { detectDelim, parseLine, parseCSVText, autoDetectMapping } from "./csvParser";

// ── detectDelim ──────────────────────────────────────────────────────────────

describe("detectDelim()", () => {
  it("возвращает ';' если точек с запятой больше, чем запятых", () => {
    expect(detectDelim("Название;Категория;Цена")).toBe(";");
  });

  it("возвращает ',' если запятых больше, чем точек с запятой", () => {
    expect(detectDelim("Name,Category,Price")).toBe(",");
  });

  it("возвращает ';' при равном количестве (приоритет ;)", () => {
    expect(detectDelim("a;b,c")).toBe(";");
  });

  it("возвращает ',' если точек с запятой нет", () => {
    expect(detectDelim("a,b,c,d")).toBe(",");
  });
});

// ── parseLine ────────────────────────────────────────────────────────────────

describe("parseLine()", () => {
  it("разбивает строку по запятой", () => {
    expect(parseLine("a,b,c", ",")).toEqual(["a", "b", "c"]);
  });

  it("разбивает строку по точке с запятой", () => {
    expect(parseLine("Гречка;Крупы;кг;125", ";")).toEqual(["Гречка", "Крупы", "кг", "125"]);
  });

  it("обрабатывает поле в кавычках с запятой внутри", () => {
    expect(parseLine('"Масло сливочное, 200г",Молочное,шт,195', ",")).toEqual([
      "Масло сливочное, 200г",
      "Молочное",
      "шт",
      "195",
    ]);
  });

  it("обрабатывает двойные кавычки внутри поля (экранирование)", () => {
    expect(parseLine('"Сыр ""Российский""",Молочное,шт,325', ",")).toEqual([
      'Сыр "Российский"',
      "Молочное",
      "шт",
      "325",
    ]);
  });

  it("обрезает пробелы в начале и конце поля", () => {
    expect(parseLine("  Гречка  ,  Крупы  ", ",")).toEqual(["Гречка", "Крупы"]);
  });

  it("пустое поле → пустая строка", () => {
    expect(parseLine("a,,c", ",")).toEqual(["a", "", "c"]);
  });
});

// ── parseCSVText ─────────────────────────────────────────────────────────────

describe("parseCSVText()", () => {
  it("пустой текст → headers=[], rows=[], delim=','", () => {
    const result = parseCSVText("");
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
    expect(result.delim).toBe(",");
  });

  it("только пробелы/пустые строки → пустой результат", () => {
    const result = parseCSVText("   \n  \n");
    expect(result.headers).toEqual([]);
  });

  it("определяет разделитель ; из заголовка и парсит строки", () => {
    const csv = "Название;Категория;Ед;Цена\nГречка;Крупы;кг;125\nМолоко;Молочное;л;78";
    const { headers, rows, delim } = parseCSVText(csv);
    expect(delim).toBe(";");
    expect(headers).toEqual(["Название", "Категория", "Ед", "Цена"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(["Гречка", "Крупы", "кг", "125"]);
    expect(rows[1]).toEqual(["Молоко", "Молочное", "л", "78"]);
  });

  it("определяет разделитель , и парсит строки", () => {
    const csv = "Name,Category,Unit,Price\nBuckwheat,Grains,kg,125";
    const { headers, rows, delim } = parseCSVText(csv);
    expect(delim).toBe(",");
    expect(headers).toEqual(["Name", "Category", "Unit", "Price"]);
    expect(rows[0]).toEqual(["Buckwheat", "Grains", "kg", "125"]);
  });

  it("игнорирует пустые строки в середине", () => {
    const csv = "a;b\n\nv1;v2\n\nv3;v4";
    const { rows } = parseCSVText(csv);
    expect(rows).toHaveLength(2);
  });
});

// ── autoDetectMapping ─────────────────────────────────────────────────────────

describe("autoDetectMapping()", () => {
  it("маппит русские колонки Название/Категория/Ед/Цена", () => {
    const headers = ["Название", "Категория", "Ед", "Цена"];
    const m = autoDetectMapping(headers);
    expect(m.name).toBe(0);
    expect(m.category).toBe(1);
    expect(m.unit).toBe(2);
    expect(m.price).toBe(3);
  });

  it("маппит английские колонки Name/Category/Unit/Price", () => {
    const headers = ["Name", "Category", "Unit", "Price"];
    const m = autoDetectMapping(headers);
    expect(m.name).toBe(0);
    expect(m.category).toBe(1);
    expect(m.unit).toBe(2);
    expect(m.price).toBe(3);
  });

  it("маппит артикул и изображение", () => {
    const headers = ["Название", "Категория", "Ед", "Цена", "Артикул", "Фото"];
    const m = autoDetectMapping(headers);
    expect(m.sku).toBe(4);
    expect(m.imageUrl).toBe(5);
  });

  it("возвращает пустой объект для нераспознанных заголовков", () => {
    const headers = ["Foo", "Bar", "Baz"];
    const m = autoDetectMapping(headers);
    expect(Object.keys(m)).toHaveLength(0);
  });

  it("нечувствителен к регистру и пробелам", () => {
    const headers = ["  НАЗВАНИЕ  ", " ЦЕНА "];
    const m = autoDetectMapping(headers);
    expect(m.name).toBe(0);
    expect(m.price).toBe(1);
  });
});
