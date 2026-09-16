import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Layers,
  Folder,
  Plus,
  Search,
  Tag,
  Upload,
  ArrowUpRight,
  ArrowRight,
  SlidersHorizontal,
  History,
  HardDrive,
  MoreHorizontal,
  Pencil,
  FolderInput,
  Copy,
  Download,
  Archive,
  Check,
  Play,
  X,
  ChevronRight,
  GraduationCap,
} from "lucide-react";
import {
  clone,
  id,
  newSet,
  setTags,
  matchTags,
  startSession,
  validateData,
  type Data,
  type ProblemSet,
  type Session,
} from "./domain";
import { loadData, saveData, download } from "./storage";
import { Field, Modal, TagPicker, askText } from "./ui";
import { Editor } from "./Editor";
import { Study } from "./Study";
import { ComposeDialog, ImportDialog, MoveDialog } from "./Transfer";
export default function App() {
  const [data, setData] = useState<Data | null>(null);
  const dataRef = useRef<Data | null>(null);
  const saveQueue = useRef(Promise.resolve());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [folder, setFolder] = useState("*");
  const [page, setPage] = useState("catalog");
  const [search, setSearch] = useState("");
  const [origin, setOrigin] = useState("all");
  const [sort, setSort] = useState("updated");
  const [tags, setTagsValue] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState("or");
  const [tagOpen, setTagOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [modal, setModal] = useState("");
  const [moveIds, setMoveIds] = useState<string[]>([]);
  const [editId, setEditId] = useState("");
  const [study, setStudy] = useState<Session | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [startSet, setStartSet] = useState<ProblemSet | null>(null);
  const [mode, setMode] = useState<Session["mode"]>("immediate");
  const [hint, setHint] = useState<Session["hintMode"]>("always");
  const [studyTags, setStudyTags] = useState<string[]>([]);
  const [studyTagMode, setStudyTagMode] = useState("or");
  const [studySection, setStudySection] = useState("");
  const [studyTagOpen, setStudyTagOpen] = useState(false);
  const restoreInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    loadData()
      .then((d) => {
        dataRef.current = d;
        setData(d);
      })
      .catch((e) => setError("保存データを開けませんでした。" + String(e)));
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(t);
  }, [notice]);
  const commit = (next: Data) => {
    const task = saveQueue.current.then(async () => {
      await saveData(next);
      dataRef.current = next;
      setData(next);
    });
    saveQueue.current = task.catch(() => {});
    return task;
  };
  const mutate = async (fn: (d: Data) => void) => {
    try {
      const d = clone(dataRef.current!);
      fn(d);
      await commit(d);
      setNotice("保存しました");
    } catch (e) {
      setError("保存できませんでした。" + String(e));
    }
  };
  const saveSession = (s: Session) => {
    const task = saveQueue.current.then(async () => {
      const d = clone(dataRef.current!);
      const i = d.sessions.findIndex((x) => x.id === s.id);
      if (i < 0) d.sessions.unshift(s);
      else d.sessions[i] = s;
      await saveData(d);
      dataRef.current = d;
      setData(d);
    });
    saveQueue.current = task.catch(() => {});
    return task;
  };
  const create = async () => {
    const s = newSet("新しい問題セット");
    s.folderId = folder === "*" || folder === "" ? null : folder;
    await mutate((d) => d.sets.unshift(s));
    if (dataRef.current?.sets.some((x) => x.id === s.id)) setEditId(s.id);
  };
  const openStart = (s: ProblemSet) => {
    setStartSet(s);
    setStudyTags([]);
    setStudySection("");
  };
  if (!data)
    return (
      <div className="loading">
        <div className="brand-mark">p</div>
        <h2>Phrase</h2>
        <p>{error || "学習の準備をしています…"}</p>
        {error && <button onClick={() => location.reload()}>再試行</button>}
      </div>
    );
  const scoped = data.sets.filter(
    (s) =>
      (folder === "*" || s.folderId === (folder || null)) &&
      (origin === "all" || s.origin === origin) &&
      (s.name + " " + s.description)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const visible = scoped
    .filter((s) => matchTags(setTags(s, data), tags, tagMode))
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, "ja")
        : b.updatedAt.localeCompare(a.updatedAt),
    );
  const allTags = [
    ...new Set(Object.values(data.questions).flatMap((q) => q.tags)),
  ];
  const title =
    folder === "*"
      ? "すべてのセット"
      : folder === ""
        ? "未分類"
        : (data.folders.find((f) => f.id === folder)?.name ?? "すべてのセット");
  const finished = data.sessions.filter((s) => s.status === "complete");
  const recent = data.sessions.find((s) => s.status === "active");
  const studied = finished.reduce((sum, s) => sum + s.items.length, 0);
  const right = finished.reduce(
    (sum, s) => sum + s.items.filter((i) => i.firstCorrect).length,
    0,
  );
  const studyEntries =
    startSet?.entries.filter(
      (e) =>
        data.questions[e.questionId].status === "ready" &&
        (!studySection || e.sectionId === studySection) &&
        matchTags(data.questions[e.questionId].tags, studyTags, studyTagMode),
    ) ?? [];
  return (
    <>
      {study && (
        <Study
          initial={study}
          preview={isPreview}
          onSave={saveSession}
          onClose={() => {
            setStudy(null);
            setIsPreview(false);
          }}
        />
      )}
      <div style={{ display: study ? "none" : undefined }}>
        {editId ? (
          <Editor
            data={data}
            setId={editId}
            onSave={commit}
            onBack={() => setEditId("")}
            onPreview={(d, s) => {
              setIsPreview(true);
              setStudy(startSession(s, d, "immediate", "always"));
            }}
          />
        ) : (
          <div className="app-shell">
            <aside className="sidebar">
              <a
                className="brand"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage("catalog");
                  setFolder("*");
                }}
              >
                <span className="brand-mark">
                  p<span>·</span>
                </span>
                Phrase<span className="beta">DESKTOP</span>
              </a>
              <p className="sidebar-label">WORKSPACE</p>
              <button
                className={
                  "nav-item " +
                  (page === "catalog" && folder === "*" ? "active" : "")
                }
                onClick={() => {
                  setPage("catalog");
                  setFolder("*");
                  setSelected([]);
                }}
              >
                <Layers size={18} />
                すべてのセット<span>{data.sets.length}</span>
              </button>
              <button
                className={"nav-item " + (page === "history" ? "active" : "")}
                onClick={() => setPage("history")}
              >
                <History size={18} />
                学習履歴
              </button>
              <div className="sidebar-label folder-title">
                FOLDERS
                <button
                  aria-label="フォルダを作成"
                  onClick={async () => {
                    const name = await askText("新しいフォルダの名前");
                    if (name?.trim())
                      void mutate((d) =>
                        d.folders.push({ id: id(), name: name.trim() }),
                      );
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>
              <button
                className={
                  "nav-item " +
                  (page === "catalog" && folder === "" ? "active" : "")
                }
                onClick={() => {
                  setFolder("");
                  setPage("catalog");
                  setSelected([]);
                }}
              >
                <Archive size={17} />
                未分類
                <span>
                  {data.sets.filter((s) => s.folderId === null).length}
                </span>
              </button>
              {data.folders.map((f) => (
                <button
                  className={
                    "nav-item " +
                    (page === "catalog" && folder === f.id ? "active" : "")
                  }
                  key={f.id}
                  onClick={() => {
                    setFolder(f.id);
                    setPage("catalog");
                    setSelected([]);
                  }}
                >
                  <Folder size={17} />
                  <span className="folder-name">{f.name}</span>
                  <span>
                    {data.sets.filter((s) => s.folderId === f.id).length}
                  </span>
                </button>
              ))}
              <button
                className="nav-item add-folder"
                onClick={async () => {
                  const name = await askText("新しいフォルダの名前");
                  if (name?.trim())
                    void mutate((d) =>
                      d.folders.push({ id: id(), name: name.trim() }),
                    );
                }}
              >
                <Plus size={16} />
                フォルダを作成
              </button>
              <div className="sidebar-bottom">
                <div className="offline-card">
                  <span className="offline-dot" />
                  <strong>あなたのペースで。</strong>
                  <p>
                    毎日の小さな積み重ねが、
                    <br />
                    使える英語につながります。
                  </p>
                </div>
                <button className="nav-item" onClick={() => setModal("backup")}>
                  <HardDrive size={17} />
                  データとバックアップ
                </button>
                <div className="local-status">
                  <span />{" "}
                  {window.phrase ? "ローカルに保存" : "ブラウザプレビュー"}
                  <small>v0.1.0</small>
                </div>
              </div>
            </aside>
            <main className="main-content">
              <div className="breadcrumb">
                ワークスペース
                <ChevronRight size={13} />
                <span>{page === "history" ? "学習履歴" : title}</span>
              </div>
              {page === "catalog" ? (
                <>
                  <header className="catalog-header">
                    <div>
                      <p className="eyebrow">YOUR LEARNING LIBRARY</p>
                      <h1>
                        {title}
                        <span className="count-pill">{visible.length}</span>
                      </h1>
                      <p className="muted">
                        ことばを並べて、英語を自分のものに。
                      </p>
                    </div>
                    <div className="row">
                      <button onClick={() => setModal("import")}>
                        <Upload size={16} />
                        取り込む
                      </button>
                      <button className="primary" onClick={() => void create()}>
                        <Plus size={18} />
                        セットを作成
                      </button>
                    </div>
                  </header>
                  {folder === "*" && !search && !tags.length && (
                    <section className="welcome-banner">
                      <div>
                        <span className="banner-label">
                          <span /> LET’S BUILD YOUR ENGLISH
                        </span>
                        <h2>英文を、組み立てよう。</h2>
                        <p>
                          番号を入力して、語句をひとつずつ。
                          <br />
                          自分で考える時間が、確かな理解に変わります。
                        </p>
                        <button
                          onClick={() => {
                            if (recent) {
                              setStudy(recent);
                              setIsPreview(false);
                            } else if (data.sets[0]) openStart(data.sets[0]);
                          }}
                        >
                          {recent ? "前回の続きから" : "さっそく学習する"}
                          <ArrowRight size={17} />
                        </button>
                      </div>
                      <div className="banner-art" aria-hidden="true">
                        <span className="art-word w1">
                          <b>3</b> I
                        </span>
                        <span className="art-word w2">
                          <b>1</b> learn
                        </span>
                        <span className="art-word w3">
                          <b>2</b> every day.
                        </span>
                        <div className="art-line" />
                        <span className="art-note">
                          Small steps. Real progress.
                        </span>
                        <span className="spark">✧</span>
                      </div>
                    </section>
                  )}
                  {folder !== "*" && (
                    <div className="folder-tools">
                      <button
                        onClick={() => {
                          setMoveIds([]);
                          setModal("move");
                        }}
                      >
                        <FolderInput size={16} />
                        既存セットを追加
                      </button>
                      {folder !== "" && (
                        <>
                          <button
                            onClick={async () => {
                              const name = await askText("フォルダ名", title);
                              if (name?.trim())
                                void mutate((d) => {
                                  d.folders.find((f) => f.id === folder)!.name =
                                    name.trim();
                                });
                            }}
                          >
                            名前を変更
                          </button>
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  "フォルダを削除します。中のセットは未分類へ移動します。",
                                )
                              ) {
                                void mutate((d) => {
                                  d.folders = d.folders.filter(
                                    (f) => f.id !== folder,
                                  );
                                  d.sets.forEach((s) => {
                                    if (s.folderId === folder)
                                      s.folderId = null;
                                  });
                                });
                                setFolder("*");
                              }
                            }}
                          >
                            フォルダを削除
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  <div className="catalog-controls">
                    <div className="tabs">
                      {[
                        ["all", "すべて"],
                        ["user", "自分のセット"],
                        ["sample", "サンプル"],
                      ].map(([key, label]) => (
                        <button
                          className={origin === key ? "active" : ""}
                          key={key}
                          onClick={() => setOrigin(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setModal("compose")}
                    >
                      <Copy size={15} />
                      合成・抽出
                    </button>
                  </div>
                  <div className="filter-row">
                    <div className="search">
                      <Search size={18} />
                      <input
                        aria-label="セット名・説明を検索"
                        placeholder="セット名・説明を検索"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      {search && (
                        <button
                          aria-label="検索をクリア"
                          className="icon"
                          onClick={() => setSearch("")}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <button onClick={() => setTagOpen(true)}>
                      <Tag size={16} />
                      タグで絞り込む{tags.length > 0 && <b>{tags.length}</b>}
                    </button>
                    <div className="spacer" />
                    <SlidersHorizontal size={16} className="muted" />
                    <select
                      aria-label="並び順"
                      className="sort-select"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="updated">更新日が新しい順</option>
                      <option value="name">名前順</option>
                    </select>
                  </div>
                  {tags.length > 0 && (
                    <div className="selected-tags">
                      <small>
                        {tagMode.toUpperCase()} · セット内タグの集合
                      </small>
                      {tags.map((t) => (
                        <button
                          key={t}
                          onClick={() =>
                            setTagsValue(tags.filter((x) => x !== t))
                          }
                        >
                          {t}
                          <X size={12} />
                        </button>
                      ))}
                      <button
                        className="text-button"
                        onClick={() => setTagsValue([])}
                      >
                        全解除
                      </button>
                    </div>
                  )}
                  {selected.length > 0 && (
                    <div className="selection-toolbar">
                      <strong>{selected.length}件選択中</strong>
                      <button
                        onClick={() => {
                          setMoveIds(selected);
                          setModal("move");
                        }}
                      >
                        フォルダへ移動
                      </button>
                      <button onClick={() => setModal("compose")}>
                        合成・抽出
                      </button>
                      <button onClick={() => setSelected([])}>
                        選択を解除
                      </button>
                    </div>
                  )}
                  <div className="catalog-summary">
                    <span>{visible.length}件のセット</span>
                    <span>学びたいセットを選びましょう</span>
                  </div>
                  <div className="set-grid">
                    {visible.map((s, i) => {
                      const st = setTags(s, data);
                      const ready = s.entries.filter(
                        (e) => data.questions[e.questionId].status === "ready",
                      ).length;
                      return (
                        <article className="set-card" key={s.id}>
                          <div className="card-top">
                            <div className={"set-icon color-" + (i % 4)}>
                              <BookOpen size={23} />
                            </div>
                            <span className={"origin " + s.origin}>
                              {s.origin === "sample"
                                ? "サンプル"
                                : "マイセット"}
                            </span>
                            <div className="spacer" />
                            <input
                              aria-label={`${s.name}を選択`}
                              type="checkbox"
                              checked={selected.includes(s.id)}
                              onChange={() =>
                                setSelected(
                                  selected.includes(s.id)
                                    ? selected.filter((x) => x !== s.id)
                                    : [...selected, s.id],
                                )
                              }
                            />
                            <details className="card-menu">
                              <summary aria-label={`${s.name}の操作`}>
                                <MoreHorizontal size={20} />
                              </summary>
                              <div>
                                <button onClick={() => setEditId(s.id)}>
                                  <Pencil size={14} />
                                  編集する
                                </button>
                                <button
                                  onClick={() => {
                                    setMoveIds([s.id]);
                                    setModal("move");
                                  }}
                                >
                                  <FolderInput size={14} />
                                  フォルダへ移動
                                </button>
                                <button
                                  onClick={() => {
                                    setSelected([s.id]);
                                    setModal("compose");
                                  }}
                                >
                                  <Copy size={14} />
                                  合成・抽出
                                </button>
                                <button
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `「${s.name}」を削除しますか？ 学習履歴は保持します。`,
                                      )
                                    )
                                      void mutate((d) => {
                                        d.sets = d.sets.filter(
                                          (x) => x.id !== s.id,
                                        );
                                      });
                                  }}
                                >
                                  セットを削除
                                </button>
                              </div>
                            </details>
                          </div>
                          <h2 title={s.name}>{s.name}</h2>
                          <p className="card-description">
                            {s.description ||
                              "自分だけの問題セットで、学習をはじめましょう。"}
                          </p>
                          <div className="card-stats">
                            <span>
                              <BookOpen size={14} />
                              <b>{s.entries.length}</b>問
                            </span>
                            <span>
                              <Layers size={14} />
                              {s.sections.length}セクション
                            </span>
                          </div>
                          <div className="card-tags">
                            {st.slice(0, 3).map((t) => (
                              <span key={t}>{t}</span>
                            ))}
                            {st.length > 3 && (
                              <span title={st.slice(3).join("、")}>
                                +{st.length - 3}
                              </span>
                            )}
                          </div>
                          <div className="card-folder">
                            <Folder size={13} />
                            {data.folders.find((f) => f.id === s.folderId)
                              ?.name ?? "未分類"}
                            {ready < s.entries.length && (
                              <span> · 下書き{s.entries.length - ready}問</span>
                            )}
                          </div>
                          <footer>
                            <button onClick={() => setEditId(s.id)}>
                              <Pencil size={14} />
                              編集
                            </button>
                            <button
                              className="learn-button"
                              disabled={!ready}
                              onClick={() => openStart(s)}
                            >
                              学習する
                              <ArrowUpRight size={16} />
                            </button>
                          </footer>
                        </article>
                      );
                    })}
                    <button
                      className="new-set-card"
                      onClick={() => void create()}
                    >
                      <span>
                        <Plus size={25} />
                      </span>
                      <strong>新しいセットを作成</strong>
                      <p>
                        あなたの学びたい英文を、
                        <br />
                        あなたの教材に。
                      </p>
                    </button>
                  </div>
                  {!visible.length && (
                    <div className="empty">
                      <h3>該当するセットがありません</h3>
                      <p>
                        検索条件を変更するか、新しいセットを作成してください。
                      </p>
                      {folder !== "*" && (
                        <button
                          onClick={() => {
                            setMoveIds([]);
                            setModal("move");
                          }}
                        >
                          既存セットを追加
                        </button>
                      )}
                    </div>
                  )}
                  <div className="library-footer">
                    <span>
                      <GraduationCap size={17} />
                      ひとつずつ、わかるを増やそう。
                    </span>
                    <span>
                      {Object.keys(data.questions).length}個の問題から広がる学び
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <header className="catalog-header">
                    <div>
                      <p className="eyebrow">YOUR PROGRESS</p>
                      <h1>学習履歴</h1>
                      <p className="muted">小さな積み重ねを、振り返る。</p>
                    </div>
                  </header>
                  <div className="stats-grid">
                    <article>
                      <span>完了した学習</span>
                      <strong>
                        {finished.length}
                        <small>回</small>
                      </strong>
                    </article>
                    <article>
                      <span>取り組んだ問題</span>
                      <strong>
                        {studied}
                        <small>問</small>
                      </strong>
                    </article>
                    <article>
                      <span>初回正解率</span>
                      <strong>
                        {studied ? Math.round((right / studied) * 100) : 0}
                        <small>%</small>
                      </strong>
                    </article>
                  </div>
                  {data.sessions.map((s) => (
                    <button
                      className="history-row"
                      key={s.id}
                      onClick={() => {
                        setIsPreview(false);
                        setStudy(s);
                      }}
                    >
                      <span className="set-icon">
                        <History size={22} />
                      </span>
                      <span>
                        <strong>{s.name}</strong>
                        <small>
                          {new Date(s.startedAt).toLocaleString("ja-JP")} ·{" "}
                          {s.mode === "batch" ? "まとめて採点" : "即時採点"}
                        </small>
                      </span>
                      <div className="spacer" />
                      <span>
                        {s.status === "complete"
                          ? `${s.items.filter((i) => i.firstCorrect).length} / ${s.items.length}問 正解`
                          : "続きから再開"}
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  ))}
                  {!data.sessions.length && (
                    <div className="empty">
                      <h3>はじめの一歩を、ここから。</h3>
                      <p>学習すると、ここに結果が記録されます。</p>
                    </div>
                  )}
                </>
              )}
            </main>
          </div>
        )}
      </div>
      {notice && (
        <div role="status" className="toast">
          <Check size={16} />
          {notice}
        </div>
      )}
      {error && (
        <Modal title="処理を完了できませんでした" onClose={() => setError("")}>
          <p className="error">{error}</p>
          <button onClick={() => setError("")}>閉じる</button>
        </Modal>
      )}
      {tagOpen && (
        <TagPicker
          tags={[...new Set(scoped.flatMap((s) => setTags(s, data)))]}
          value={tags}
          mode={tagMode}
          onApply={(t, m) => {
            setTagsValue(t);
            setTagMode(m);
          }}
          onClose={() => setTagOpen(false)}
        />
      )}
      {modal === "import" && (
        <ImportDialog
          data={data}
          onCommit={commit}
          onClose={() => setModal("")}
        />
      )}
      {modal === "compose" && (
        <ComposeDialog
          data={data}
          sourceIds={selected}
          onCommit={commit}
          onClose={() => {
            setModal("");
            setSelected([]);
          }}
        />
      )}
      {modal === "move" && (
        <MoveDialog
          data={data}
          folderId={folder === "*" ? null : folder || null}
          selectedIds={moveIds}
          onCommit={commit}
          onClose={() => {
            setModal("");
            setSelected([]);
          }}
        />
      )}
      {modal === "backup" && (
        <Modal title="データとバックアップ" onClose={() => setModal("")}>
          <div className="notice">
            <HardDrive size={22} />
            <p>
              {window.phrase
                ? "問題・セット・履歴をこのPCのSQLiteファイルに保存しています。"
                : "ブラウザ確認用のデータは、このブラウザのローカルストレージに保存しています。デスクトップ版とは別の保存先です。"}
            </p>
          </div>
          <p>
            完全バックアップには問題、フォルダ、共有関係、学習履歴が含まれます。
          </p>
          <button
            className="primary"
            onClick={() =>
              download(
                `phrase-backup-${new Date().toISOString().slice(0, 10)}.json`,
                JSON.stringify(data, null, 2),
              )
            }
          >
            <Download size={16} />
            バックアップを保存
          </button>
          <h3>バックアップから復元</h3>
          <p className="muted">
            現在のデータを置き換えます。復元前のバックアップもダウンロードします。
          </p>
          <button onClick={() => restoreInput.current?.click()}>
            <Upload size={16} />
            復元するファイルを選択
          </button>
          <input
            hidden
            ref={restoreInput}
            type="file"
            accept=".json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                if (f.size > 50 * 1024 * 1024)
                  throw Error("バックアップの上限は50MBです。");
                const incoming: unknown = JSON.parse(await f.text());
                validateData(incoming);
                if (
                  !confirm(
                    `${incoming.sets.length}セットを復元し、現在のデータを置き換えますか？`,
                  )
                )
                  return;
                download(
                  `phrase-before-restore-${Date.now()}.json`,
                  JSON.stringify(data),
                );
                await commit(incoming);
                setFolder("*");
                setModal("");
                setNotice("復元しました");
              } catch (e) {
                setError(String(e));
              }
            }}
          />
        </Modal>
      )}
      {startSet && (
        <Modal title="学習をはじめる" onClose={() => setStartSet(null)}>
          <div className="start-title">
            <span className="set-icon">
              <BookOpen size={22} />
            </span>
            <div>
              <h3>{startSet.name}</h3>
              <span className="muted">{studyEntries.length}問を出題</span>
            </div>
          </div>
          <div className="field">
            <span>採点のタイミング</span>
            <div className="mode-options">
              <button
                className={mode === "immediate" ? "selected" : ""}
                onClick={() => setMode("immediate")}
              >
                <strong>1問ずつ採点</strong>
                <span>その場で正解・解説を確認</span>
              </button>
              <button
                className={mode === "batch" ? "selected" : ""}
                onClick={() => setMode("batch")}
              >
                <strong>まとめて採点</strong>
                <span>すべて解いてから答え合わせ</span>
              </button>
            </div>
          </div>
          <Field label="和訳の表示">
            <select
              value={hint}
              onChange={(e) => setHint(e.target.value as Session["hintMode"])}
            >
              <option value="always">常に表示</option>
              <option value="button">ヒントボタンで表示</option>
              <option value="hidden">表示しない</option>
            </select>
          </Field>
          <Field label="出題セクション">
            <select
              value={studySection}
              onChange={(e) => setStudySection(e.target.value)}
            >
              <option value="">すべてのセクション</option>
              {startSet.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <button onClick={() => setStudyTagOpen(true)}>
            <Tag size={15} />
            出題する問題タグ{" "}
            {studyTags.length > 0 && `(${studyTags.join("、")})`}
          </button>
          <p className="muted">
            下書きは出題しません。番号は学習中固定され、Enterキーで回答・移動できます。
          </p>
          <div className="modal-foot">
            <button onClick={() => setStartSet(null)}>キャンセル</button>
            <button
              className="primary"
              disabled={!studyEntries.length}
              onClick={async () => {
                const session = startSession(
                  startSet,
                  data,
                  mode,
                  hint,
                  studyEntries,
                );
                try {
                  await saveSession(session);
                  setIsPreview(false);
                  setStudy(session);
                  setStartSet(null);
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              <Play size={16} />
              {studyEntries.length}問の学習を開始
            </button>
          </div>
          {studyTagOpen && (
            <TagPicker
              tags={setTags(startSet, data)}
              value={studyTags}
              mode={studyTagMode}
              onApply={(t, m) => {
                setStudyTags(t);
                setStudyTagMode(m);
              }}
              onClose={() => setStudyTagOpen(false)}
            />
          )}
        </Modal>
      )}
    </>
  );
}
