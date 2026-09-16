import { it, expect } from "vitest";
import ExcelJS from "exceljs";
import { readWorkbook, previewImport, columns } from "../src/importer";
it("XLSX: シート選択、保存済み数式結果、同じ問題モデル", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("教材");
  sheet.addRow([...columns]);
  sheet.addRow([
    "試験",
    "I study English.",
    "I / study / English",
    "英語を勉強する",
    "基本",
    "現在形",
    "説明",
    "",
  ]);
  sheet.getCell("D2").value = {
    formula: '"英語を勉強する"',
    result: "英語を勉強する",
  };
  const other = workbook.addWorksheet("別シート");
  other.addRow(["別の列"]);
  const bytes = await workbook.xlsx.writeBuffer();
  const result = await readWorkbook(
    new File([bytes as ArrayBuffer], "questions.xlsx"),
  );
  expect(Object.keys(result)).toEqual(["教材", "別シート"]);
  expect(result["教材"][1][3]).toBe("英語を勉強する");
  const mapping = Object.fromEntries(columns.map((c, i) => [c, i]));
  expect(previewImport(result["教材"], mapping)[0].errors).toEqual([]);
});
