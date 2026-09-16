import { seed, validateData, type Data } from "./domain";
declare global {
  interface Window {
    phrase?: {
      load: () => Promise<string | null>;
      save: (json: string) => Promise<void>;
    };
  }
}
const key = "phrase.database.v1";
export async function loadData(): Promise<Data> {
  const raw = window.phrase
    ? await window.phrase.load()
    : localStorage.getItem(key);
  if (!raw) return seed();
  const data: unknown = JSON.parse(raw);
  validateData(data);
  return data;
}
export async function saveData(data: Data) {
  validateData(data);
  const json = JSON.stringify(data);
  if (window.phrase) await window.phrase.save(json);
  else localStorage.setItem(key, json);
}
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(new Blob([content], { type }));
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
