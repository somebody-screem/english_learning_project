import {
  makeQuestion,
  newSet,
  id,
  validateQuestion,
  type Question,
} from "./domain";
export const columns = [
  "問題名",
  "正解英文",
  "語句分割",
  "和訳",
  "セクション",
  "タグ",
  "解説",
  "許容解答",
] as const;
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === '"') {
      if (cell || closed)
        throw Error(`CSV ${rows.length + 1}行: 引用符の位置が不正です。`);
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
      closed = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      closed = false;
    } else {
      if (closed)
        throw Error(`CSV ${rows.length + 1}行: 引用符の後に文字があります。`);
      cell += c;
    }
  }
  if (quoted) throw Error("CSVの引用符が閉じられていません。");
  if (cell || row.length || closed) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
export async function readWorkbook(
  file: File,
): Promise<Record<string, string[][]>> {
  if (file.size > 10 * 1024 * 1024) throw Error("ファイルの上限は10MBです。");
  if (/\.csv$/i.test(file.name)) return { CSV: parseCsv(await file.text()) };
  if (!/\.xlsx$/i.test(file.name))
    throw Error("CSV または .xlsx を選択してください。");
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  return Object.fromEntries(
    workbook.worksheets.map((sheet) => {
      if (sheet.rowCount > 10001) throw Error("1シートの上限は10,000問です。");
      const rows: string[][] = [];
      for (let r = 1; r <= sheet.rowCount; r++) {
        const row: string[] = [];
        for (let c = 1; c <= Math.min(sheet.columnCount, 100); c++) {
          const value = sheet.getRow(r).getCell(c).value;
          row.push(
            value === null
              ? ""
              : typeof value === "object"
                ? "result" in value
                  ? String(value.result ?? "")
                  : "richText" in value
                    ? value.richText.map((t) => t.text).join("")
                    : "text" in value
                      ? value.text
                      : String(value)
                : String(value),
          );
        }
        rows.push(row);
      }
      return [sheet.name, rows];
    }),
  );
}
export function previewImport(
  rows: string[][],
  mapping: Record<string, number>,
) {
  if (rows.length > 10001) throw Error("上限は10,000問です。");
  return rows
    .slice(1)
    .map((row, i) => {
      if (row.every((c) => !c.trim())) return null;
      const get = (key: string) => row[mapping[key]]?.trim() ?? "";
      const sentence = get("正解英文");
      const phrases = get("語句分割")
        ? get("語句分割")
            .split("/")
            .map((s) => s.trim())
        : sentence
            .replace(/[.!?]$/, "")
            .split(/\s+/)
            .filter(Boolean);
      const q = makeQuestion(
        get("問題名") || sentence,
        sentence,
        phrases,
        get("和訳"),
        get("タグ")
          .split(/[,、]/)
          .map((s) => s.trim())
          .filter(Boolean),
        get("解説"),
      );
      for (const line of get("許容解答").split("\n").filter(Boolean)) {
        const pool = [...q.tokens];
        const order = line.split("/").map((s) => {
          const index = pool.findIndex((t) => t.text === s.trim());
          return index < 0 ? "invalid" : pool.splice(index, 1)[0].id;
        });
        q.answers.push({
          order,
          sentence: line
            .split("/")
            .map((s) => s.trim())
            .join(" "),
        });
      }
      const errors = validateQuestion(q);
      q.status = errors.length ? "draft" : "ready";
      return { row: i + 2, q, section: get("セクション"), errors };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
}
export function materializeImport(
  name: string,
  rows: ReturnType<typeof previewImport>,
) {
  if (!rows.length || rows.some((r) => r.errors.length))
    throw Error("行エラーを修正してから取り込んでください。");
  const set = newSet(name);
  const questions: Record<string, Question> = {};
  for (const r of rows) {
    let section = set.sections.find((s) => s.name === r.section);
    if (r.section && !section) {
      section = { id: id(), name: r.section };
      set.sections.push(section);
    }
    questions[r.q.id] = r.q;
    set.entries.push({
      id: id(),
      questionId: r.q.id,
      sectionId: section?.id ?? null,
    });
  }
  return { set, questions };
}
