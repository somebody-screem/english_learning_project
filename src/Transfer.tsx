import { useMemo, useState } from "react";
import { Upload, Download, Tag } from "lucide-react";
import {
  clone,
  id,
  matchTags,
  newSet,
  setTags,
  type Data,
  type ProblemSet,
  type Entry,
} from "./domain";
import {
  columns,
  readWorkbook,
  previewImport,
  materializeImport,
} from "./importer";
import { download } from "./storage";
import { Field, Modal, TagPicker } from "./ui";
export function ImportDialog({
  data,
  onCommit,
  onClose,
}: {
  data: Data;
  onCommit: (d: Data) => Promise<void>;
  onClose: () => void;
}) {
  const [book, setBook] = useState<Record<string, string[][]>>({});
  const [sheet, setSheet] = useState("");
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [name, setName] = useState("取り込んだ問題セット");
  const [folder, setFolder] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = book[sheet] ?? [];
  const preview = useMemo(() => {
    try {
      return { items: previewImport(rows, mapping), error: "" };
    } catch (e) {
      return { items: [], error: String(e) };
    }
  }, [rows, mapping]);
  const choose = (b: Record<string, string[][]>, s: string) => {
    setBook(b);
    setSheet(s);
    setMapping(
      Object.fromEntries(
        columns.map((c) => [
          c,
          b[s]?.[0]?.findIndex((x) => x.trim() === c) ?? -1,
        ]),
      ),
    );
  };
  const commit = async () => {
    setBusy(true);
    try {
      const imported = materializeImport(name.trim(), preview.items);
      imported.set.folderId = folder || null;
      const d = clone(data);
      d.sets.push(imported.set);
      Object.assign(d.questions, imported.questions);
      await onCommit(d);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="CSV / Excelから取り込む" onClose={onClose} wide>
      <p className="muted">
        ファイルの内容を確認してから、新しい問題セットを作成します。
      </p>
      <label className="upload-zone">
        <Upload size={28} />
        <strong>CSV または Excelファイルを選択</strong>
        <span>UTF-8 CSV / .xlsx · 10MBまで</span>
        <input
          type="file"
          accept=".csv,.xlsx"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setError("");
            try {
              const b = await readWorkbook(file);
              choose(b, Object.keys(b)[0]);
              setName(file.name.replace(/\.[^.]+$/, ""));
            } catch (err) {
              setError(String(err));
              setBook({});
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <button
        className="text-button"
        onClick={() =>
          download(
            "phrase-template.csv",
            "\uFEFF" +
              columns.join(",") +
              '\r\n毎朝の習慣,I drink coffee every morning.,I / drink / coffee / every morning,私は毎朝コーヒーを飲みます。,基本文型,"現在形,基本文型",習慣を表す現在形です。,\r\n',
            "text/csv;charset=utf-8",
          )
        }
      >
        <Download size={15} />
        記入用テンプレート
      </button>
      {Object.keys(book).length > 0 && (
        <>
          <div className="two-col">
            <Field label="対象シート">
              <select
                value={sheet}
                onChange={(e) => choose(book, e.target.value)}
              >
                {Object.keys(book).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="新しいセット名">
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <Field label="所属フォルダ">
            <select value={folder} onChange={(e) => setFolder(e.target.value)}>
              <option value="">未分類</option>
              {data.folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <h3>列の対応</h3>
          <div className="mapping-grid">
            {columns.map((c) => (
              <Field key={c} label={c + (c === "正解英文" ? " *" : "")}>
                <select
                  value={mapping[c] ?? -1}
                  onChange={(e) =>
                    setMapping({ ...mapping, [c]: Number(e.target.value) })
                  }
                >
                  <option value={-1}>使用しない</option>
                  {rows[0]?.map((col, i) => (
                    <option value={i} key={i}>
                      {col || `列${i + 1}`}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <p className="muted">
            語句は /、タグはカンマ、別解は1行に1つ（語句を /
            で区切る）。語句分割が空なら英文を単語分割します。
          </p>
          <h3>プレビュー · {preview.items.length}問</h3>
          <div className="import-preview">
            {preview.items.map((r) => (
              <div key={r.row} className={r.errors.length ? "error-row" : ""}>
                <small>{r.row}行目</small>
                <strong>{r.q.answers[0]?.sentence || "正解英文なし"}</strong>
                <span>{r.errors.join(" / ") || "✓ 取り込み可能"}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {(error || preview.error) && (
        <p className="error" role="alert">
          {error || preview.error}
        </p>
      )}
      <div className="modal-foot">
        <button onClick={onClose}>キャンセル</button>
        <button
          className="primary"
          disabled={
            busy ||
            !name.trim() ||
            !preview.items.length ||
            preview.items.some((r) => r.errors.length > 0) ||
            !!preview.error
          }
          onClick={() => void commit()}
        >
          {busy ? "処理中…" : `${preview.items.length}問を取り込む`}
        </button>
      </div>
    </Modal>
  );
}
export function ComposeDialog({
  data,
  sourceIds,
  onCommit,
  onClose,
}: {
  data: Data;
  sourceIds: string[];
  onCommit: (d: Data) => Promise<void>;
  onClose: () => void;
}) {
  const [sources, setSources] = useState(sourceIds);
  const [name, setName] = useState("まとめた問題セット");
  const [copyMode, setCopyMode] = useState("copy");
  const [tags, setTagsValue] = useState<string[]>([]);
  const [op, setOp] = useState("or");
  const [tagOpen, setTagOpen] = useState(false);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const chosen = data.sets.filter((s) => sources.includes(s.id));
  const all = chosen
    .flatMap((s) => s.entries.map((e) => ({ s, e })))
    .filter(({ e }) => data.questions[e.questionId].status === "ready");
  const seen = new Set<string>();
  const unique = all.filter(({ e }) => {
    if (seen.has(e.questionId)) return false;
    seen.add(e.questionId);
    return true;
  });
  const matching = all.filter(
    ({ e, s }) =>
      matchTags(data.questions[e.questionId].tags, tags, op) &&
      (!sections.length || sections.includes(`${s.id}:${e.sectionId ?? ""}`)),
  );
  const candidateIds = new Set<string>();
  const candidates = matching.filter(({ e }) => {
    if (candidateIds.has(e.questionId)) return false;
    candidateIds.add(e.questionId);
    return true;
  });
  const picked = candidates.filter(({ e }) => !excluded.includes(e.questionId));
  const commit = async () => {
    setBusy(true);
    try {
      const d = clone(data);
      const target = newSet(name.trim());
      const sectionMap = new Map<string, string>();
      for (const { s, e } of picked) {
        let sectionId: string | null = null;
        const section = s.sections.find((c) => c.id === e.sectionId);
        if (section) {
          const key = s.id + section.id;
          if (!sectionMap.has(key)) {
            const sid = id();
            sectionMap.set(key, sid);
            target.sections.push({
              id: sid,
              name: `${s.name} / ${section.name}`,
            });
          }
          sectionId = sectionMap.get(key)!;
        }
        let qid = e.questionId;
        if (copyMode === "copy") {
          const q = clone(d.questions[qid]);
          q.id = id();
          q.revision = 1;
          d.questions[q.id] = q;
          qid = q.id;
        }
        target.entries.push({ id: id(), questionId: qid, sectionId });
      }
      d.sets.push(target);
      await onCommit(d);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="セットを合成・抽出" onClose={onClose} wide>
      <p className="muted">
        元のセットを残して、選んだ問題から新しいセットを作ります。
      </p>
      <h3>1. 元のセット</h3>
      <div className="selection-box">
        {data.sets.map((s) => (
          <label className="check-row" key={s.id}>
            <input
              type="checkbox"
              checked={sources.includes(s.id)}
              onChange={() =>
                setSources(
                  sources.includes(s.id)
                    ? sources.filter((x) => x !== s.id)
                    : [...sources, s.id],
                )
              }
            />
            {s.name}
            <span className="muted">{s.entries.length}問</span>
          </label>
        ))}
      </div>
      <h3>2. 出題可能な問題を絞り込む</h3>
      <button onClick={() => setTagOpen(true)}>
        <Tag size={15} />
        問題タグ{" "}
        {tags.length > 0 && `(${tags.join("、")} / ${op.toUpperCase()})`}
      </button>
      <div className="selection-box">
        {chosen.flatMap((s) =>
          [...s.sections, { id: "", name: "未分類" }].map((c) => {
            const key = `${s.id}:${c.id}`;
            return (
              <label key={key} className="check-row">
                <input
                  type="checkbox"
                  checked={sections.includes(key)}
                  onChange={() =>
                    setSections(
                      sections.includes(key)
                        ? sections.filter((x) => x !== key)
                        : [...sections, key],
                    )
                  }
                />
                {s.name} / {c.name}
              </label>
            );
          }),
        )}
      </div>
      <small className="muted">
        セクション未選択時はすべてが対象です。同じ問題IDは1件にまとめます。
      </small>
      <div className="selection-box">
        {candidates.map(({ e }) => (
          <label key={e.questionId} className="check-row">
            <input
              type="checkbox"
              checked={!excluded.includes(e.questionId)}
              onChange={() =>
                setExcluded(
                  excluded.includes(e.questionId)
                    ? excluded.filter((x) => x !== e.questionId)
                    : [...excluded, e.questionId],
                )
              }
            />
            {data.questions[e.questionId].title}
          </label>
        ))}
      </div>
      <p>
        <strong>{picked.length}問</strong>を作成 · 元の{all.length}
        件のうちID重複{all.length - unique.length}件
      </p>
      <div className="two-col">
        <Field label="新しいセット名">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="問題の扱い">
          <select
            value={copyMode}
            onChange={(e) => setCopyMode(e.target.value)}
          >
            <option value="copy">独立コピー（このセットだけで編集）</option>
            <option value="shared">共有参照（元セットと編集を共有）</option>
          </select>
        </Field>
      </div>
      {copyMode === "shared" && (
        <p className="notice">
          共有した問題の編集は元のセットにも反映されます。
        </p>
      )}
      {error && <p className="error">{error}</p>}
      <div className="modal-foot">
        <button onClick={onClose}>キャンセル</button>
        <button
          className="primary"
          disabled={busy || !picked.length || !name.trim()}
          onClick={() => void commit()}
        >
          新しいセットを作成
        </button>
      </div>
      {tagOpen && (
        <TagPicker
          tags={[
            ...new Set(
              unique.flatMap(({ e }) => data.questions[e.questionId].tags),
            ),
          ]}
          value={tags}
          mode={op}
          onApply={(t, m) => {
            setTagsValue(t);
            setOp(m);
          }}
          onClose={() => setTagOpen(false)}
        />
      )}
    </Modal>
  );
}
export function MoveDialog({
  data,
  folderId,
  selectedIds,
  onCommit,
  onClose,
}: {
  data: Data;
  folderId: string | null;
  selectedIds: string[];
  onCommit: (d: Data) => Promise<void>;
  onClose: () => void;
}) {
  const [target, setTarget] = useState(folderId ?? "");
  const [selected, select] = useState(selectedIds);
  const [keyword, setKeyword] = useState("");
  const [tags, setTagsValue] = useState<string[]>([]);
  const [mode, setMode] = useState("or");
  const [tagOpen, setTagOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const visible = data.sets.filter(
    (s) =>
      (s.name + " " + s.description)
        .toLowerCase()
        .includes(keyword.toLowerCase()) &&
      matchTags(setTags(s, data), tags, mode),
  );
  return (
    <Modal title="既存セットをフォルダへ移動" onClose={onClose}>
      <Field label="移動先">
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">未分類</option>
          {data.folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </Field>
      <input
        aria-label="全フォルダからセットを検索"
        placeholder="すべてのフォルダから名前・説明を検索"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />
      <button onClick={() => setTagOpen(true)}>
        <Tag size={15} />
        タグで絞り込む {tags.length ? `(${tags.length})` : ""}
      </button>
      <div className="selection-box">
        {visible.map((s) => (
          <label className="check-row" key={s.id}>
            <input
              type="checkbox"
              disabled={s.folderId === (target || null)}
              checked={selected.includes(s.id)}
              onChange={() =>
                select(
                  selected.includes(s.id)
                    ? selected.filter((x) => x !== s.id)
                    : [...selected, s.id],
                )
              }
            />
            <span>
              {s.name}
              <small className="block muted">
                {s.entries.length}問 · 現在：
                {data.folders.find((f) => f.id === s.folderId)?.name ??
                  "未分類"}{" "}
                {s.folderId === (target || null) ? "（追加済み）" : ""}
              </small>
            </span>
          </label>
        ))}
      </div>
      <p className="muted">
        選択したセットはコピーではなく移動します。検索条件を変えても選択は保持されます。
      </p>
      {error && <p className="error">{error}</p>}
      <div className="modal-foot">
        <span>{selected.length}件選択</span>
        <button
          className="primary"
          disabled={busy || !selected.length}
          onClick={async () => {
            setBusy(true);
            try {
              const d = clone(data);
              d.sets.forEach((s) => {
                if (selected.includes(s.id)) s.folderId = target || null;
              });
              await onCommit(d);
              onClose();
            } catch (e) {
              setError(String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          このフォルダへ移動
        </button>
      </div>
      {tagOpen && (
        <TagPicker
          tags={[
            ...new Set(Object.values(data.questions).flatMap((q) => q.tags)),
          ]}
          value={tags}
          mode={mode}
          onApply={(t, m) => {
            setTagsValue(t);
            setMode(m);
          }}
          onClose={() => setTagOpen(false)}
        />
      )}
    </Modal>
  );
}
