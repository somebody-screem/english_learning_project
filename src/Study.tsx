import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  RotateCcw,
  CornerDownLeft,
  Lightbulb,
} from "lucide-react";
import { clone, grade, parseSequence, type Session, type Item } from "./domain";
import { Modal } from "./ui";
// Answers stay inside the session controller. The question UI gets only this projection.
function project(item: Item, reveal: boolean) {
  return {
    tokens: item.tokens,
    input: item.input,
    title: item.question.title,
    translation: item.question.translation,
    hint: item.hint,
    graded: item.graded,
    correct: reveal ? item.correct : undefined,
    answers: reveal ? item.question.answers : [],
    explanation: reveal ? item.question.explanation : "",
  };
}
export function Study({
  initial,
  onSave,
  onClose,
  preview = false,
}: {
  initial: Session;
  onSave: (s: Session) => Promise<void>;
  onClose: () => void;
  preview?: boolean;
}) {
  const controller = useRef(clone(initial));
  const [view, setView] = useState(() =>
    project(initial.items[initial.index], initial.items[initial.index].graded),
  );
  const [index, setIndex] = useState(initial.index);
  const [complete, setComplete] = useState(initial.status === "complete");
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const dragging = useRef<number | null>(null);
  const refresh = () => {
    const s = controller.current;
    setIndex(s.index);
    setComplete(s.status === "complete");
    setView(
      project(
        s.items[s.index],
        (s.mode === "immediate" && s.items[s.index].graded) ||
          s.status === "complete",
      ),
    );
  };
  const persist = async () => {
    if (preview) return true;
    setBusy(true);
    try {
      await onSave(clone(controller.current));
      return true;
    } catch (e) {
      setError(
        "保存できませんでした。回答は画面内に保持しています。" + String(e),
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    input.current?.focus();
  }, [index, view.graded, confirmSubmit]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (!complete) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [complete]);
  const edit = (value: string) => {
    controller.current.items[index].input = value;
    setError("");
    refresh();
  };
  const move = async (n: number) => {
    if (busy) return;
    controller.current.index = n;
    refresh();
    await persist();
  };
  const action = async () => {
    if (busy) return;
    const s = controller.current;
    const item = s.items[s.index];
    if (s.mode === "immediate" && !item.graded) {
      const p = parseSequence(item.input, item.tokens.length, true);
      if (p.error) {
        setError(p.error);
        return;
      }
      s.items[index] = grade(item);
      refresh();
      await persist();
      return;
    }
    if (s.mode === "batch") {
      const p = parseSequence(item.input, item.tokens.length, true);
      if (p.error && item.input.trim()) {
        setError(p.error);
        return;
      }
    }
    if (index < s.items.length - 1) await move(index + 1);
    else setConfirmSubmit(true);
  };
  const submit = async () => {
    const s = controller.current;
    const invalidIndex = s.items.findIndex(
      (item) =>
        item.input.trim() &&
        parseSequence(item.input, item.tokens.length, true).error,
    );
    if (invalidIndex >= 0) {
      s.index = invalidIndex;
      setConfirmSubmit(false);
      refresh();
      setError(
        `問題${invalidIndex + 1}：${parseSequence(s.items[invalidIndex].input, s.items[invalidIndex].tokens.length, true).error}`,
      );
      return;
    }
    for (let i = 0; i < s.items.length; i++)
      if (!s.items[i].graded) s.items[i] = grade(s.items[i]);
    s.status = "complete";
    s.finishedAt = new Date().toISOString();
    setConfirmSubmit(false);
    refresh();
    await persist();
  };
  const s = controller.current;
  const parsed = parseSequence(view.input, view.tokens.length);
  const numbers = parsed.numbers.filter(
    (n) => n >= 1 && n <= view.tokens.length,
  );
  const matched = view.answers.find(
    (a) =>
      a.order
        .map(
          (i) => s.items[index].question.tokens.find((t) => t.id === i)!.text,
        )
        .join(" ") === numbers.map((n) => view.tokens[n - 1].text).join(" "),
  );
  return (
    <div className="study-page">
      <header className="page-top">
        <button
          onClick={async () => {
            if (await persist()) onClose();
          }}
          disabled={busy}
        >
          <ArrowLeft size={16} />
          {complete ? "一覧へ" : "保存して終了"}
        </button>
        <span>{preview ? "プレビュー" : s.name}</span>
        <div className="spacer" />
        <span className="mode-badge">
          {s.mode === "immediate" ? "即時採点" : "まとめて採点"}
        </span>
      </header>
      {complete ? (
        <main className="results">
          <p className="eyebrow">SESSION COMPLETE</p>
          <h1>今日も、一歩前へ。</h1>
          <p className="muted">
            {s.name} · {s.items.length}問の学習が完了しました
          </p>
          <div className="result-score">
            <strong>
              {s.items.filter((i) => i.firstCorrect).length}
              <small> / {s.items.length}</small>
            </strong>
            <span>初回正解数 · 未回答は不正解として集計</span>
          </div>
          {s.items.map((item, i) => (
            <article className="result-row" key={i}>
              <span
                className={
                  "result-mark " + (item.firstCorrect ? "correct" : "incorrect")
                }
              >
                {item.firstCorrect ? "✓" : "−"}
              </span>
              <div>
                <small>
                  QUESTION {String(i + 1).padStart(2, "0")} ·{" "}
                  {item.attempts.length}回回答{item.hint ? " · ヒント使用" : ""}
                </small>
                <h3>{item.question.title}</h3>
                <p className="english">
                  {
                    (
                      item.question.answers.find(
                        (a) =>
                          a.order
                            .map(
                              (id) =>
                                item.question.tokens.find((t) => t.id === id)
                                  ?.text,
                            )
                            .join(" ") ===
                          parseSequence(item.input, item.tokens.length)
                            .numbers.map((n) => item.tokens[n - 1]?.text)
                            .join(" "),
                      ) ?? item.question.answers[0]
                    )?.sentence
                  }
                </p>
                <p className="muted">
                  あなたの回答：
                  {parseSequence(item.input, item.tokens.length)
                    .numbers.map((n) => item.tokens[n - 1]?.text ?? "?")
                    .join(" ") || "未回答"}
                </p>
                <p>{item.question.explanation}</p>
              </div>
            </article>
          ))}
        </main>
      ) : (
        <main className="study-main">
          <div className="study-meta">
            <span>
              QUESTION <b>{String(index + 1).padStart(2, "0")}</b>
              <span className="muted">
                {" "}
                / {String(s.items.length).padStart(2, "0")}
              </span>
            </span>
            <span className="muted">
              語句を並べ替えて、英文を完成させましょう
            </span>
          </div>
          <div className="progress">
            <div
              style={{ width: `${((index + 1) / s.items.length) * 100}%` }}
            />
          </div>
          <div className="study-card">
            {view.translation && s.hintMode !== "hidden" && (
              <section className="hint-block">
                <span className="eyebrow">JAPANESE HINT</span>
                {s.hintMode === "always" || view.hint ? (
                  <h2>{view.translation}</h2>
                ) : (
                  <button
                    onClick={() => {
                      s.items[index].hint = true;
                      refresh();
                    }}
                  >
                    <Lightbulb size={16} />
                    和訳を表示
                  </button>
                )}
              </section>
            )}
            <label className="answer-label" htmlFor="sequence">
              語句番号を入力<span>カンマ または 空白で区切る</span>
            </label>
            <div className={"answer-input " + (view.graded ? "locked" : "")}>
              <input
                ref={input}
                id="sequence"
                autoComplete="off"
                placeholder="例：3, 1, 4, 2"
                value={view.input}
                readOnly={view.graded && s.mode === "immediate"}
                onChange={(e) => edit(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.nativeEvent.isComposing &&
                    !e.repeat &&
                    e.keyCode !== 229
                  ) {
                    e.preventDefault();
                    void action();
                  }
                }}
              />
              <kbd>Enter ↵</kbd>
            </div>
            <div className="sentence-preview">
              <span className="eyebrow">YOUR SENTENCE</span>
              <div className="assembled">
                {numbers.length ? (
                  numbers.map((n, i) => (
                    <span
                      draggable={!view.graded}
                      onDragStart={() => {
                        dragging.current = i;
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragging.current === null || view.graded) return;
                        const order = [...numbers];
                        const [moved] = order.splice(dragging.current, 1);
                        order.splice(i, 0, moved);
                        edit(order.join(", "));
                        dragging.current = null;
                      }}
                      key={i}
                    >
                      {view.tokens[n - 1].text}
                    </span>
                  ))
                ) : (
                  <span className="placeholder">
                    ここにあなたの英文が表示されます
                  </span>
                )}
              </div>
            </div>
            <div className="list-heading">
              <h3>選ぶ語句</h3>
              <span className="muted">
                {new Set(numbers).size} / {view.tokens.length} 使用中
              </span>
            </div>
            <div className="token-grid">
              {view.tokens.map((t, i) => (
                <button
                  disabled={
                    (view.graded && s.mode === "immediate") ||
                    numbers.includes(i + 1)
                  }
                  key={t.id}
                  onClick={() => edit([...numbers, i + 1].join(", "))}
                >
                  <span>{i + 1}</span>
                  {t.text}
                </button>
              ))}
            </div>
            {!view.graded && (
              <button className="text-button" onClick={() => edit("")}>
                <RotateCcw size={14} />
                入力をクリア
              </button>
            )}
            {(error || parsed.error) && (
              <p role="alert" className="error">
                {error || parsed.error}
              </p>
            )}
            {view.graded && s.mode === "immediate" && (
              <div
                className={
                  "feedback " + (view.correct ? "correct" : "incorrect")
                }
              >
                <h3>
                  {view.correct
                    ? "✓ 正解です！"
                    : "登録された正解とは異なります"}
                </h3>
                <p className="english">
                  {matched?.sentence ?? view.answers[0]?.sentence}
                </p>
                <p>{view.explanation}</p>
                <button
                  onClick={() => {
                    s.items[index].graded = false;
                    refresh();
                  }}
                >
                  もう一度解く
                </button>
              </div>
            )}
            <div className="study-actions">
              <button
                disabled={index === 0 || busy}
                onClick={() => void move(index - 1)}
              >
                <ArrowLeft size={16} />
                前の問題
              </button>
              <span className="muted">
                {s.mode === "batch"
                  ? "正解・解説は最後の提出後に表示"
                  : "Enterで採点、そのまま次へ"}
              </span>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void action()}
              >
                {s.mode === "immediate" && !view.graded
                  ? "採点する"
                  : index === s.items.length - 1
                    ? "提出前の確認"
                    : "次の問題へ"}
                <CornerDownLeft size={17} />
              </button>
            </div>
          </div>
          <div className="question-dots">
            {s.items.map((item, i) => (
              <button
                key={i}
                className={
                  i === index ? "active" : item.input ? "answered" : ""
                }
                aria-label={`問題${i + 1}へ${item.input ? "（回答あり）" : ""}`}
                onClick={() => void move(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </main>
      )}
      {complete && error && (
        <p className="error">
          {error}
          <button onClick={() => void persist()}>保存を再試行</button>
        </p>
      )}
      {confirmSubmit && (
        <Modal
          title="学習を提出しますか？"
          onClose={() => setConfirmSubmit(false)}
        >
          <p>
            {s.items.length}問中、{s.items.filter((i) => i.input.trim()).length}
            問に回答しています。
          </p>
          <p className="muted">
            未回答の問題は初回正解数に含まれません。提出すると正解と解説を表示します。
          </p>
          <div className="modal-foot">
            <button onClick={() => setConfirmSubmit(false)}>回答に戻る</button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => void submit()}
            >
              <Check size={16} />
              提出して結果を見る
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
