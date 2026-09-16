import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, Search } from "lucide-react";
export function askText(title: string, initial = ""): Promise<string | null> {
  return new Promise((resolve) => {
    const previous = document.activeElement as HTMLElement;
    const dialog = document.createElement("dialog");
    const heading = document.createElement("h2");
    heading.textContent = title;
    const input = document.createElement("input");
    input.value = initial;
    input.setAttribute("aria-label", title);
    const form = document.createElement("form");
    const actions = document.createElement("div");
    actions.className = "modal-foot";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "キャンセル";
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "primary";
    submit.textContent = "決定";
    const finish = (value: string | null) => {
      dialog.close();
      dialog.remove();
      previous?.focus();
      resolve(value);
    };
    cancel.onclick = () => finish(null);
    form.onsubmit = (e) => {
      e.preventDefault();
      if (input.value.trim()) finish(input.value);
    };
    dialog.oncancel = (e) => {
      e.preventDefault();
      finish(null);
    };
    actions.append(cancel, submit);
    form.append(heading, input, actions);
    dialog.append(form);
    document.body.append(dialog);
    dialog.showModal();
    input.focus();
    input.select();
  });
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "wide" : ""}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon" aria-label="閉じる" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function TagPicker({
  tags,
  value,
  mode,
  onApply,
  onClose,
}: {
  tags: string[];
  value: string[];
  mode: string;
  onApply: (tags: string[], mode: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, select] = useState(value);
  const [op, setOp] = useState(mode);
  return (
    <Modal title="問題タグで絞り込む" onClose={onClose}>
      <p className="muted">
        キーワード検索とは別に、問題に付いたタグで絞り込みます。
      </p>
      <div className="search">
        <Search size={18} />
        <input
          aria-label="タグ名を検索"
          placeholder="タグ名を検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Field label="条件">
        <select value={op} onChange={(e) => setOp(e.target.value)}>
          <option value="or">いずれかを含む（OR）</option>
          <option value="and">すべてを含む（AND）</option>
        </select>
      </Field>
      <div className="tag-options">
        {tags
          .filter((t) => t.includes(search))
          .sort()
          .map((t) => (
            <label className="check-row" key={t}>
              <input
                type="checkbox"
                checked={selected.includes(t)}
                onChange={() =>
                  select(
                    selected.includes(t)
                      ? selected.filter((x) => x !== t)
                      : [...selected, t],
                  )
                }
              />
              {t}
            </label>
          ))}
        {!tags.length && <p>まだタグがありません。</p>}
      </div>
      <div className="modal-foot">
        <button onClick={() => select([])}>全解除</button>
        <span>{selected.length}件選択</span>
        <button
          className="primary"
          onClick={() => {
            onApply(selected, op);
            onClose();
          }}
        >
          適用する
        </button>
      </div>
    </Modal>
  );
}
