import { describe, it, expect } from "vitest";
import {
  seed,
  parseSequence,
  makeQuestion,
  validateQuestion,
  grade,
  startSession,
  clone,
  matchTags,
  validateData,
} from "../src/domain";
import {
  parseCsv,
  previewImport,
  materializeImport,
  columns,
} from "../src/importer";
describe("番号入力 A01–A04", () => {
  it.each(["1, 10, 2, 11", "1 10 2 11", "１、１０，２ １１"])(
    "整数トークンとして読む: %s",
    (s) => expect(parseSequence(s, 12).numbers).toEqual([1, 10, 2, 11]),
  );
  it("1112を分割しない", () => {
    expect(parseSequence("1112", 12).numbers).toEqual([1112]);
    expect(parseSequence("1112", 12).error).toBeTruthy();
  });
  it.each(["1,1", "0", "01", "-1", "1,x", "13", "1,,2", ",1"])(
    "不正入力 %s",
    (s) => expect(parseSequence(s, 12, true).error).toBeTruthy(),
  );
  it("編集中の末尾区切りのみ許容", () => {
    expect(parseSequence("1,", 2).error).toBeNull();
    expect(parseSequence("1,", 2, true).error).toBeTruthy();
  });
  it("全語句必須", () =>
    expect(parseSequence("1", 2, true).error).toContain("1個"));
});
describe("共通問題と採点 A05 A08 A09 A16", () => {
  it("サンプルは10問・全問ready・参照整合", () => {
    const d = seed();
    expect(Object.values(d.questions)).toHaveLength(10);
    Object.values(d.questions).forEach((q) =>
      expect(validateQuestion(q)).toEqual([]),
    );
    expect(() => validateData(d)).not.toThrow();
  });
  it("番号対応固定、問題の変更からセッションを隔離", () => {
    const d = seed();
    const s = startSession(d.sets[0], d, "batch", "always");
    const before = clone(s.items[0]);
    d.questions[s.items[0].question.id].tokens[0].text = "changed";
    expect(s.items[0]).toEqual(before);
  });
  it("同じ綴りを交換しても正解、初回結果を保持", () => {
    const q = makeQuestion("", "I think I can.", ["I", "think", "I", "can"]);
    const item = {
      question: q,
      tokens: q.tokens,
      input: "3 2 1 4",
      graded: false,
      hint: false,
      attempts: [],
    };
    const first = grade(item);
    expect(first.correct).toBe(true);
    expect(grade({ ...first, input: "1 2 4 3" }).firstCorrect).toBe(true);
  });
  it("別解と和訳なし", () => {
    const q = makeQuestion("", "I work today.", ["I", "work", "today"]);
    q.answers.push({
      order: [q.tokens[2].id, q.tokens[0].id, q.tokens[1].id],
      sentence: "today I work.",
    });
    expect(validateQuestion(q)).toEqual([]);
    expect(
      grade({
        question: q,
        tokens: q.tokens,
        input: "3 1 2",
        graded: false,
        hint: false,
        attempts: [],
      }).correct,
    ).toBe(true);
  });
  it("未回答は不正解", () => {
    const d = seed();
    expect(
      grade(startSession(d.sets[0], d, "batch", "always").items[0]).correct,
    ).toBe(false);
  });
});
describe("絞り込み・バックアップ A10 A12 A21 A23", () => {
  it("AND OR", () => {
    expect(matchTags(["a"], ["a", "b"], "and")).toBe(false);
    expect(matchTags(["a"], ["a", "b"], "or")).toBe(true);
    expect(matchTags([], [], "and")).toBe(true);
  });
  it("共有参照は同じID、バックアップ往復", () => {
    const d = seed();
    expect(d.sets[0].entries[1].questionId).toBe(
      d.sets[1].entries[0].questionId,
    );
    expect(() => validateData(JSON.parse(JSON.stringify(d)))).not.toThrow();
  });
  it("壊れた参照・版を拒否", () => {
    const d = seed();
    d.sets[0].entries[0].sectionId = "missing";
    expect(() => validateData(d)).toThrow();
    expect(() => validateData({ ...seed(), version: 2 })).toThrow();
  });
});
describe("CSVと原子的取り込み A19 A20 A24", () => {
  const mapping = Object.fromEntries(columns.map((c, i) => [c, i]));
  it("BOM、カンマ、引用符内改行、二重引用符", () =>
    expect(parseCsv('\uFEFFa,b\r\n"hello, world","a\n""quote"""\r\n')).toEqual([
      ["a", "b"],
      ["hello, world", 'a\n"quote"'],
    ]));
  it("不完全な引用符を拒否", () => expect(() => parseCsv('a,"b')).toThrow());
  it("取り込み結果が出題可能な同じ問題モデル", () => {
    const rows = [
      Array.from(columns),
      [
        "習慣",
        "I drink coffee.",
        "I / drink / coffee",
        "コーヒーを飲む",
        "基本",
        "現在形,基本",
        "解説",
        "",
      ],
    ];
    const p = previewImport(rows, mapping);
    expect(p[0].errors).toEqual([]);
    const result = materializeImport("import", p);
    const d = seed();
    d.sets.push(result.set);
    Object.assign(d.questions, result.questions);
    expect(() => validateData(d)).not.toThrow();
    expect(
      startSession(result.set, d, "batch", "always").items[0].question
        .translation,
    ).toBe("コーヒーを飲む");
  });
  it("不正行は行番号つき、全件作成を拒否", () => {
    const p = previewImport(
      [Array.from(columns), ["不完全な問題", "", ""]],
      mapping,
    );
    expect(p[0].row).toBe(2);
    expect(p[0].errors.length).toBeGreaterThan(0);
    expect(() => materializeImport("bad", p)).toThrow();
  });
});
