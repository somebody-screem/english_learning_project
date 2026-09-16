import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Save,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Play,
} from "lucide-react";
import {
  clone,
  id,
  makeQuestion,
  validateQuestion,
  type Data,
  type ProblemSet,
  type Question,
} from "./domain";
import { Field, Modal, askText } from "./ui";
function AlternateAnswers({
  question,
  onChange,
}: {
  question: Question;
  onChange: (answers: Question["answers"]) => void;
}) {
  const [text, setText] = useState(() =>
    question.answers
      .slice(1)
      .map((a) =>
        a.order
          .map((i) => question.tokens.findIndex((t) => t.id === i) + 1)
          .join(" "),
      )
      .join("\n"),
  );
  return (
    <Field label="許容解答（1行に1つ・編集上の語句番号を空白区切り）">
      <textarea
        rows={2}
        placeholder="例：4 1 2 3"
        value={text}
        onChange={(e) => {
          const value = e.target.value;
          setText(value);
          onChange(
            value.trim()
              ? value
                  .split("\n")
                  .filter((l) => l.trim())
                  .map((line) => {
                    const order = line
                      .trim()
                      .split(/[,\s]+/)
                      .map(
                        (n) => question.tokens[Number(n) - 1]?.id ?? "invalid",
                      );
                    return {
                      order,
                      sentence: order
                        .map(
                          (i) =>
                            question.tokens.find((t) => t.id === i)?.text ?? "",
                        )
                        .join(" "),
                    };
                  })
              : [],
          );
        }}
      />
    </Field>
  );
}
export function Editor({
  data,
  setId,
  onSave,
  onBack,
  onPreview,
}: {
  data: Data;
  setId: string;
  onSave: (d: Data) => Promise<void>;
  onBack: () => void;
  onPreview: (d: Data, s: ProblemSet) => void;
}) {
  const [draft, setDraft] = useState(() => clone(data));
  const set = draft.sets.find((s) => s.id === setId)!;
  const [active, setActive] = useState(set.entries[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("*");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const entry = set.entries.find((e) => e.id === active);
  const q = entry ? draft.questions[entry.questionId] : undefined;
  const change = (fn: (d: Data, s: ProblemSet) => void) => {
    setDraft((prev) => {
      const d = clone(prev);
      fn(
        d,
        d.sets.find((s) => s.id === setId)!,
      );
      return d;
    });
    setDirty(true);
  };
  const changeQ = (fn: (q: Question) => void) =>
    change((d) => {
      if (q) {
        fn(d.questions[q.id]);
        d.questions[q.id].status = validateQuestion(d.questions[q.id]).length
          ? "draft"
          : "ready";
      }
    });
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const d = clone(draft);
      for (const question of Object.values(d.questions)) {
        if (
          JSON.stringify(question) !==
          JSON.stringify(data.questions[question.id])
        )
          question.revision = (data.questions[question.id]?.revision ?? 0) + 1;
      }
      d.sets.find((s) => s.id === setId)!.updatedAt = new Date().toISOString();
      await onSave(d);
      setDraft(d);
      setDirty(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!saving) void save();
      }
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("keydown", key);
    };
  });
  const leave = () => {
    if (!dirty || confirm("未保存の変更を破棄して一覧に戻りますか？")) onBack();
  };
  const add = () => {
    const nq = makeQuestion("新しい問題");
    const eid = id();
    change((d, s) => {
      d.questions[nq.id] = nq;
      s.entries.push({
        id: eid,
        questionId: nq.id,
        sectionId: section === "*" ? null : section,
      });
    });
    setActive(eid);
  };
  const shift = (offset: number) =>
    change((_, s) => {
      const i = s.entries.findIndex((e) => e.id === active),
        j = i + offset;
      if (j >= 0 && j < s.entries.length)
        [s.entries[i], s.entries[j]] = [s.entries[j], s.entries[i]];
    });
  const used = q
    ? draft.sets.filter((s) => s.entries.some((e) => e.questionId === q.id))
    : [];
  return (
    <div className="editor-page">
      <header className="page-top">
        <button onClick={leave}>
          <ArrowLeft size={16} />
          一覧へ
        </button>
        <span className="muted">セットを編集</span>
        <div className="spacer" />
        <span className={dirty ? "unsaved" : "muted"}>
          {dirty ? "● 未保存の変更" : "✓ 保存済み"}
        </span>
        <button onClick={() => setPreview(true)}>
          <Play size={16} />
          プレビュー
        </button>
        <button
          className="primary"
          disabled={saving}
          onClick={() => void save()}
        >
          <Save size={16} />
          {saving ? "保存中…" : "保存する"}
        </button>
      </header>
      {error && (
        <p role="alert" className="error">
          保存できませんでした。入力内容は保持しています。{error}
        </p>
      )}
      <div className="set-heading">
        <input
          aria-label="セット名"
          className="title-input"
          value={set.name}
          onChange={(e) =>
            change((_, s) => {
              s.name = e.target.value;
            })
          }
        />
        <input
          aria-label="セットの説明"
          placeholder="セットの説明を追加"
          value={set.description}
          onChange={(e) =>
            change((_, s) => {
              s.description = e.target.value;
            })
          }
        />
      </div>
      <div className="editor-grid">
        <aside className="section-pane">
          <p className="eyebrow">SECTIONS</p>
          <h3>セクション</h3>
          <button
            className={section === "*" ? "selected" : ""}
            onClick={() => setSection("*")}
          >
            すべての問題 <span>{set.entries.length}</span>
          </button>
          {set.sections.map((s, i) => (
            <div key={s.id}>
              <button
                className={section === s.id ? "selected" : ""}
                onClick={() => setSection(s.id)}
              >
                {s.name}
                <span>
                  {set.entries.filter((e) => e.sectionId === s.id).length}
                </span>
              </button>
              {section === s.id && (
                <div className="small-actions">
                  <button
                    aria-label="セクションを上へ"
                    disabled={i === 0}
                    onClick={() =>
                      change((_, p) => {
                        [p.sections[i - 1], p.sections[i]] = [
                          p.sections[i],
                          p.sections[i - 1],
                        ];
                      })
                    }
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    onClick={async () => {
                      const name = await askText("セクション名", s.name);
                      if (name?.trim())
                        change((_, p) => {
                          p.sections[i].name = name.trim();
                        });
                    }}
                  >
                    名前変更
                  </button>
                  <button
                    aria-label="セクションを削除"
                    onClick={() => {
                      if (
                        confirm(
                          "セクションを削除します。問題は未分類に移します。",
                        )
                      )
                        change((_, p) => {
                          p.sections = p.sections.filter((x) => x.id !== s.id);
                          p.entries.forEach((e) => {
                            if (e.sectionId === s.id) e.sectionId = null;
                          });
                          setSection("*");
                        });
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
          <button
            className="text-button"
            onClick={async () => {
              const name = await askText("セクション名");
              if (name?.trim())
                change((_, s) => {
                  s.sections.push({ id: id(), name: name.trim() });
                });
            }}
          >
            <Plus size={15} />
            セクションを追加
          </button>
        </aside>
        <section className="question-list">
          <div className="list-heading">
            <h3>
              問題 <small>{set.entries.length}</small>
            </h3>
            <button className="icon" aria-label="問題を追加" onClick={add}>
              <Plus size={19} />
            </button>
          </div>
          <input
            aria-label="問題を検索"
            placeholder="問題名・英文・和訳を検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="question-scroll">
            {set.entries
              .filter(
                (e) =>
                  (section === "*" || e.sectionId === section) &&
                  [
                    draft.questions[e.questionId].title,
                    draft.questions[e.questionId].translation,
                    ...draft.questions[e.questionId].answers.map(
                      (a) => a.sentence,
                    ),
                  ]
                    .join(" ")
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((e) => {
                const question = draft.questions[e.questionId];
                return (
                  <button
                    key={e.id}
                    className={
                      "question-row " + (e.id === active ? "active" : "")
                    }
                    onClick={() => setActive(e.id)}
                  >
                    <span className="question-no">
                      {String(set.entries.indexOf(e) + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <strong>{question.title || "無題の問題"}</strong>
                      <small>
                        {question.answers[0]?.sentence ||
                          "英文を入力してください"}
                      </small>
                      {question.status === "draft" && <em>下書き</em>}
                    </span>
                  </button>
                );
              })}
          </div>
          <button onClick={add}>
            <Plus size={16} />
            問題を追加
          </button>
        </section>
        <section className="question-editor">
          {q && entry ? (
            <>
              <div className="list-heading">
                <h3>問題の内容</h3>
                <div className="row">
                  <button
                    className="icon"
                    aria-label="問題を上へ"
                    onClick={() => shift(-1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    className="icon"
                    aria-label="問題を下へ"
                    onClick={() => shift(1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    className="icon"
                    aria-label="問題を複製"
                    onClick={() => {
                      const nq = clone(q);
                      nq.id = id();
                      nq.revision = 1;
                      const eid = id();
                      change((d, s) => {
                        d.questions[nq.id] = nq;
                        s.entries.push({
                          id: eid,
                          questionId: nq.id,
                          sectionId: entry.sectionId,
                        });
                      });
                      setActive(eid);
                    }}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    className="icon"
                    aria-label="問題を削除"
                    onClick={() => {
                      if (confirm("このセットから問題を削除しますか？")) {
                        change((_, s) => {
                          s.entries = s.entries.filter((e) => e.id !== active);
                        });
                        setActive("");
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {used.length > 1 && (
                <div className="notice">
                  共有中：{used.map((s) => s.name).join("、")}
                  。保存するとすべてに反映されます。
                  <button
                    onClick={() => {
                      const nq = clone(q);
                      nq.id = id();
                      nq.revision = 1;
                      change((d, s) => {
                        d.questions[nq.id] = nq;
                        s.entries.find((e) => e.id === active)!.questionId =
                          nq.id;
                      });
                    }}
                  >
                    コピーして編集
                  </button>
                </div>
              )}
              <Field label="問題名">
                <input
                  value={q.title}
                  onChange={(e) =>
                    changeQ((q) => {
                      q.title = e.target.value;
                    })
                  }
                />
              </Field>
              <Field label="正解英文">
                <textarea
                  rows={2}
                  value={q.answers[0]?.sentence ?? ""}
                  onChange={(e) =>
                    changeQ((q) => {
                      if (!q.answers.length)
                        q.answers.push({
                          order: q.tokens.map((t) => t.id),
                          sentence: "",
                        });
                      q.answers[0].sentence = e.target.value;
                    })
                  }
                />
              </Field>
              <Field label="語句分割（正解順・1行に1つの語句）">
                <textarea
                  className="english"
                  rows={5}
                  value={q.tokens.map((t) => t.text).join("\n")}
                  onChange={(e) =>
                    changeQ((q) => {
                      const old = q.tokens;
                      q.tokens = e.target.value
                        .split("\n")
                        .map((text, i) => ({ id: old[i]?.id ?? id(), text }));
                      if (q.answers[0])
                        q.answers[0].order = q.tokens.map((t) => t.id);
                    })
                  }
                />
              </Field>
              <button
                className="text-button"
                onClick={() => {
                  if (
                    q.tokens.length &&
                    !confirm("現在の語句分割を英文の単語ごとに置き換えますか？")
                  )
                    return;
                  changeQ((q) => {
                    q.tokens = (q.answers[0]?.sentence ?? "")
                      .replace(/[.!?]$/, "")
                      .split(/\s+/)
                      .filter(Boolean)
                      .map((text) => ({ id: id(), text }));
                    q.answers = q.answers.slice(0, 1);
                    if (q.answers[0])
                      q.answers[0].order = q.tokens.map((t) => t.id);
                  });
                }}
              >
                英文から単語に分割
              </button>
              <Field label="和訳（任意）">
                <textarea
                  rows={2}
                  value={q.translation}
                  onChange={(e) =>
                    changeQ((q) => {
                      q.translation = e.target.value;
                    })
                  }
                />
              </Field>
              <div className="two-col">
                <Field label="セクション">
                  <select
                    value={entry.sectionId ?? ""}
                    onChange={(e) =>
                      change((_, s) => {
                        s.entries.find((x) => x.id === active)!.sectionId =
                          e.target.value || null;
                      })
                    }
                  >
                    <option value="">未分類</option>
                    {set.sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="問題タグ（カンマ区切り）">
                  <input
                    value={q.tags.join(",")}
                    onChange={(e) =>
                      changeQ((q) => {
                        q.tags = e.target.value.split(/[,、]/);
                      })
                    }
                    onBlur={() =>
                      changeQ((q) => {
                        q.tags = [
                          ...new Set(
                            q.tags.map((t) => t.trim()).filter(Boolean),
                          ),
                        ];
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="解説">
                <textarea
                  rows={3}
                  value={q.explanation}
                  onChange={(e) =>
                    changeQ((q) => {
                      q.explanation = e.target.value;
                    })
                  }
                />
              </Field>
              <AlternateAnswers
                key={q.id}
                question={q}
                onChange={(answers) =>
                  changeQ((q) => {
                    q.answers = [...q.answers.slice(0, 1), ...answers];
                  })
                }
              />{" "}
              {validateQuestion(q).length ? (
                <div className="notice">
                  <strong>下書きとして保存できます</strong>
                  {validateQuestion(q).map((e) => (
                    <p key={e}>{e}</p>
                  ))}
                  <small>下書きは学習対象に含まれません。</small>
                </div>
              ) : (
                <p className="success-text">✓ この問題は出題できます</p>
              )}
            </>
          ) : (
            <div className="empty">
              <h3>問題を選択してください</h3>
              <button onClick={add}>最初の問題を追加</button>
            </div>
          )}
        </section>
      </div>
      {preview && (
        <Modal title="出題プレビュー" onClose={() => setPreview(false)}>
          <p>
            現在の編集内容で練習します。プレビューの結果は履歴に保存しません。
          </p>
          <p>
            出題可能：
            {
              set.entries.filter(
                (e) => draft.questions[e.questionId].status === "ready",
              ).length
            }
            問
          </p>
          <button
            className="primary"
            disabled={
              !set.entries.some(
                (e) => draft.questions[e.questionId].status === "ready",
              )
            }
            onClick={() => {
              setPreview(false);
              onPreview(draft, set);
            }}
          >
            プレビューを開始
          </button>
        </Modal>
      )}
    </div>
  );
}
