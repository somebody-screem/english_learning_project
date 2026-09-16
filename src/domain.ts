export type Token = { id: string; text: string };
export type Answer = { order: string[]; sentence: string };
export type Question = {
  id: string;
  revision: number;
  title: string;
  translation: string;
  explanation: string;
  tokens: Token[];
  answers: Answer[];
  tags: string[];
  status: "draft" | "ready";
};
export type Entry = {
  id: string;
  questionId: string;
  sectionId: string | null;
};
export type ProblemSet = {
  id: string;
  name: string;
  description: string;
  folderId: string | null;
  origin: "sample" | "user";
  sections: { id: string; name: string }[];
  entries: Entry[];
  updatedAt: string;
};
export type Item = {
  question: Question;
  tokens: Token[];
  input: string;
  graded: boolean;
  correct?: boolean;
  firstCorrect?: boolean;
  hint: boolean;
  attempts: { input: string; correct: boolean; at: string }[];
};
export type Session = {
  id: string;
  setId: string;
  name: string;
  mode: "immediate" | "batch";
  hintMode: "always" | "button" | "hidden";
  items: Item[];
  index: number;
  status: "active" | "complete";
  startedAt: string;
  finishedAt?: string;
};
export type Data = {
  version: 1;
  folders: { id: string; name: string }[];
  sets: ProblemSet[];
  questions: Record<string, Question>;
  sessions: Session[];
};
export const id = () => crypto.randomUUID();
export const clone = <T>(v: T): T => structuredClone(v);
export const normalizeInput = (v: string) =>
  v.normalize("NFKC").replace(/、/g, ",");
export function parseSequence(
  input: string,
  count: number,
  submit = false,
): { numbers: number[]; error: string | null } {
  const normalized = normalizeInput(input).trim();
  if (!normalized)
    return {
      numbers: [],
      error: submit ? "すべての語句番号を入力してください。" : null,
    };
  const pieces = normalized.split(/[,\s]+/).filter(Boolean);
  const numbers = pieces.filter((x) => /^\d+$/.test(x)).map(Number);
  let error: string | null = null;
  if (pieces.some((x) => !/^[1-9]\d*$/.test(x)))
    error = "番号は1以上の整数で入力してください（先頭の0は使えません）。";
  else if (/,\s*,|^,/.test(normalized) || (submit && /,$/.test(normalized)))
    error = "空の番号があります。区切りを確認してください。";
  else if (numbers.some((n) => !Number.isSafeInteger(n) || n > count))
    error = `番号は1〜${count}の範囲で入力してください。`;
  else if (new Set(numbers).size !== numbers.length)
    error = "同じ番号が重複しています。各語句を1回ずつ使ってください。";
  else if (submit && numbers.length !== count)
    error = `まだ${count - numbers.length}個の語句が使われていません。`;
  return { numbers, error };
}
export const words = (s: string) => s.trim().replace(/\s+/g, " ");
export function validateQuestion(q: Question): string[] {
  const errors: string[] = [];
  if (!q.tokens.length || q.tokens.some((t) => !t.text.trim()))
    errors.push("語句を1つ以上入力してください。");
  if (new Set(q.tokens.map((t) => t.id)).size !== q.tokens.length)
    errors.push("語句IDが重複しています。");
  if (!q.answers.length) errors.push("正解英文が必要です。");
  const tokenIds = q.tokens
    .map((t) => t.id)
    .sort()
    .join("|");
  for (const a of q.answers) {
    if ([...a.order].sort().join("|") !== tokenIds)
      errors.push("正解・別解ではすべての語句を1回ずつ使ってください。");
    const assembled = a.order
      .map((i) => q.tokens.find((t) => t.id === i)?.text ?? "")
      .join(" ");
    // Only terminal sentence punctuation may be supplied by the display sentence.
    const comparable = (s: string) => words(s).replace(/[.!?。]$/, "");
    if (comparable(assembled) !== comparable(a.sentence))
      errors.push(
        "正解英文と語句の並びが一致しません（大文字・句読点も確認）。",
      );
  }
  return [...new Set(errors)];
}
export function makeQuestion(
  title = "",
  sentence = "",
  phrases: string[] = [],
  translation = "",
  tags: string[] = [],
  explanation = "",
): Question {
  const tokens = phrases.map((text) => ({ id: id(), text }));
  const q: Question = {
    id: id(),
    revision: 1,
    title,
    translation,
    explanation,
    tokens,
    answers: sentence ? [{ order: tokens.map((t) => t.id), sentence }] : [],
    tags,
    status: "draft",
  };
  q.status = validateQuestion(q).length ? "draft" : "ready";
  return q;
}
export function matchTags(tags: string[], selected: string[], mode: string) {
  return (
    !selected.length ||
    (mode === "and"
      ? selected.every((t) => tags.includes(t))
      : selected.some((t) => tags.includes(t)))
  );
}
export const setTags = (s: ProblemSet, d: Data) => [
  ...new Set(s.entries.flatMap((e) => d.questions[e.questionId]?.tags ?? [])),
];
export function newSet(name: string): ProblemSet {
  return {
    id: id(),
    name,
    description: "",
    folderId: null,
    origin: "user",
    sections: [],
    entries: [],
    updatedAt: new Date().toISOString(),
  };
}
export function startSession(
  set: ProblemSet,
  d: Data,
  mode: Session["mode"],
  hintMode: Session["hintMode"],
  entries = set.entries,
): Session {
  const items = entries
    .map((e) => d.questions[e.questionId])
    .filter((q) => q.status === "ready")
    .map((q) => {
      const tokens = clone(q.tokens);
      for (let i = tokens.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tokens[i], tokens[j]] = [tokens[j], tokens[i]];
      }
      return {
        question: clone(q),
        tokens,
        input: "",
        graded: false,
        hint: false,
        attempts: [],
      } as Item;
    });
  return {
    id: id(),
    setId: set.id,
    name: set.name,
    mode,
    hintMode,
    items,
    index: 0,
    status: "active",
    startedAt: new Date().toISOString(),
  };
}
export function grade(item: Item): Item {
  const parsed = parseSequence(item.input, item.tokens.length, true);
  const texts = parsed.numbers.map((n) => item.tokens[n - 1]?.text);
  const correct =
    !parsed.error &&
    item.question.answers.some((a) =>
      a.order
        .map((i) => item.question.tokens.find((t) => t.id === i)!.text)
        .every((t, i) => t === texts[i]),
    );
  return {
    ...item,
    graded: true,
    correct,
    firstCorrect: item.firstCorrect ?? correct,
    attempts: [
      ...item.attempts,
      { input: item.input, correct, at: new Date().toISOString() },
    ],
  };
}
export function seed(): Data {
  const rows: [string, string, string[], string, string[], string][] = [
    [
      "朝の一杯",
      "I drink coffee every morning.",
      ["I", "drink", "coffee", "every morning"],
      "私は毎朝コーヒーを飲みます。",
      ["現在形", "基本文型"],
      "習慣を表すときは現在形を使います。every morning は「毎朝」。",
    ],
    [
      "週末の予定",
      "We are going to visit Kyoto this weekend.",
      ["We", "are going to", "visit", "Kyoto", "this weekend"],
      "私たちは今週末、京都を訪れる予定です。",
      ["未来表現", "旅行"],
      "be going to は予定や意図を表します。",
    ],
    [
      "読書の時間",
      "She is reading a book in the park.",
      ["She", "is reading", "a book", "in the park"],
      "彼女は公園で本を読んでいます。",
      ["現在進行形"],
      "be + 動詞のing形で、今していることを表します。",
    ],
    [
      "はじめての訪問",
      "Have you ever been to Japan?",
      ["Have", "you", "ever", "been", "to Japan"],
      "日本へ行ったことはありますか。",
      ["現在完了", "疑問文", "旅行"],
      "Have you ever ...? で経験を尋ねます。",
    ],
    [
      "雨の日",
      "If it rains tomorrow, we will stay home.",
      ["If", "it rains", "tomorrow,", "we", "will stay", "home"],
      "明日雨が降ったら、家にいます。",
      ["条件文", "未来表現"],
      "条件を表すif節では、未来のことも現在形を使います。",
    ],
    [
      "待ち合わせ",
      "Could you tell me the way to the station?",
      ["Could", "you", "tell me", "the way", "to the station"],
      "駅への道を教えていただけますか。",
      ["疑問文", "旅行"],
      "Could you ...? は丁寧な依頼です。",
    ],
    [
      "大切な友人",
      "This is the friend who helped me yesterday.",
      ["This", "is", "the friend", "who", "helped me", "yesterday"],
      "こちらが昨日私を助けてくれた友人です。",
      ["関係代名詞", "過去形"],
      "who 以下が the friend を説明しています。",
    ],
    [
      "新しい挑戦",
      "I look forward to seeing you again.",
      ["I", "look forward to", "seeing", "you", "again"],
      "またお会いできるのを楽しみにしています。",
      ["動名詞", "熟語"],
      "look forward to の to は前置詞なので動名詞を続けます。",
    ],
    [
      "比べてみよう",
      "This book is more interesting than that one.",
      ["This book", "is", "more interesting", "than", "that one"],
      "この本はあの本より面白いです。",
      ["比較級"],
      "more ... than で比較します。",
    ],
    [
      "12語のチャレンジ",
      "I would like to learn something new every single day this year.",
      [
        "I",
        "would",
        "like",
        "to",
        "learn",
        "something",
        "new",
        "every",
        "single",
        "day",
        "this",
        "year",
      ],
      "今年は毎日何か新しいことを学びたいです。",
      ["不定詞", "チャレンジ"],
      "10以上の番号も、1つの番号としてカンマや空白で区切ります。",
    ],
  ];
  const qs = rows.map((r) => makeQuestion(...r));
  const folder = { id: id(), name: "日々の英語" };
  const all = newSet("日常から学ぶ英文法");
  all.description = "身近なシーンを通して、英文の組み立て方を身につけよう。";
  all.origin = "sample";
  all.folderId = folder.id;
  all.sections = [
    { id: id(), name: "基本の表現" },
    { id: id(), name: "一歩先の英文法" },
  ];
  all.entries = qs.map((q, i) => ({
    id: id(),
    questionId: q.id,
    sectionId: all.sections[i < 5 ? 0 : 1].id,
  }));
  const travel = newSet("旅先で使えるひとこと");
  travel.origin = "sample";
  travel.description = "道案内から旅の予定まで。次の旅行に役立つ英語。";
  travel.entries = [1, 3, 5].map((i) => ({
    id: id(),
    questionId: qs[i].id,
    sectionId: null,
  }));
  return {
    version: 1,
    folders: [folder],
    sets: [all, travel],
    questions: Object.fromEntries(qs.map((q) => [q.id, q])),
    sessions: [],
  };
}
export function validateData(value: unknown): asserts value is Data {
  if (!value || typeof value !== "object")
    throw Error("バックアップの形式が正しくありません。");
  const d = value as Data;
  if (
    d.version !== 1 ||
    !Array.isArray(d.sets) ||
    !Array.isArray(d.folders) ||
    !Array.isArray(d.sessions) ||
    !d.questions ||
    typeof d.questions !== "object"
  )
    throw Error("未対応のバックアップ形式です。");
  const unique = (arr: string[]) => new Set(arr).size === arr.length;
  if (!unique(d.sets.map((s) => s.id)) || !unique(d.folders.map((f) => f.id)))
    throw Error("IDが重複しています。");
  for (const f of d.folders)
    if (typeof f.id !== "string" || typeof f.name !== "string")
      throw Error("フォルダが不正です。");
  for (const [key, q] of Object.entries(d.questions)) {
    if (
      key !== q.id ||
      !Number.isInteger(q.revision) ||
      q.revision < 1 ||
      !["draft", "ready"].includes(q.status) ||
      !Array.isArray(q.tags) ||
      q.tags.some((t) => typeof t !== "string") ||
      [q.title, q.translation, q.explanation].some(
        (s) => typeof s !== "string",
      ) ||
      !Array.isArray(q.tokens) ||
      q.tokens.some(
        (t) => typeof t.id !== "string" || typeof t.text !== "string",
      ) ||
      !Array.isArray(q.answers) ||
      q.answers.some(
        (a) =>
          typeof a.sentence !== "string" ||
          !Array.isArray(a.order) ||
          a.order.some((i) => typeof i !== "string"),
      )
    )
      throw Error("問題の形式が不正です。");
    if (q.status === "ready" && validateQuestion(q).length)
      throw Error("出題可能な問題に不整合があります。");
  }
  for (const s of d.sets) {
    if (
      typeof s.id !== "string" ||
      typeof s.name !== "string" ||
      typeof s.description !== "string" ||
      !Array.isArray(s.sections) ||
      !Array.isArray(s.entries) ||
      !["sample", "user"].includes(s.origin) ||
      typeof s.updatedAt !== "string" ||
      !unique(s.sections.map((x) => x.id)) ||
      !unique(s.entries.map((e) => e.id))
    )
      throw Error("セットの形式が不正です。");
    if (s.folderId !== null && !d.folders.some((f) => f.id === s.folderId))
      throw Error("所属フォルダが見つかりません。");
    for (const e of s.entries)
      if (
        !d.questions[e.questionId] ||
        (e.sectionId !== null && !s.sections.some((c) => c.id === e.sectionId))
      )
        throw Error("問題またはセクションの参照が不正です。");
  }
  for (const s of d.sessions) {
    if (
      !["active", "complete"].includes(s.status) ||
      !["batch", "immediate"].includes(s.mode) ||
      !["always", "button", "hidden"].includes(s.hintMode) ||
      !Array.isArray(s.items) ||
      !s.items.length ||
      !Number.isInteger(s.index) ||
      s.index < 0 ||
      s.index >= s.items.length
    )
      throw Error("学習履歴が不正です。");
    for (const i of s.items) {
      if (
        typeof i.input !== "string" ||
        !Array.isArray(i.tokens) ||
        !Array.isArray(i.attempts) ||
        validateQuestion(i.question).length ||
        i.tokens.length !== i.question.tokens.length ||
        !unique(i.tokens.map((t) => t.id)) ||
        i.tokens.some(
          (t) =>
            !i.question.tokens.some((q) => q.id === t.id && q.text === t.text),
        )
      )
        throw Error("学習回答が不正です。");
    }
  }
}
