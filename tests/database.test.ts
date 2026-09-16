import { it, expect } from "vitest";
import { createRequire } from "node:module";
import { mkdtemp, readFile, mkdir, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { seed } from "../src/domain";
const { openStore } = createRequire(import.meta.url)(
  "../electron/database.cjs",
);
it("SQLite保存、再起動、失敗時ロールバック、前回コピー", async () => {
  const dir = await mkdtemp(join(tmpdir(), "phrase-test-"));
  const file = join(dir, "phrase.sqlite");
  let store = await openStore(file);
  const initial = JSON.stringify(seed());
  await store.save(initial);
  store.close();
  store = await openStore(file);
  expect(store.load()).toBe(initial);
  const d = JSON.parse(initial);
  d.sets[0].name = "変更済み";
  const next = JSON.stringify(d);
  await store.save(next);
  expect(store.load()).toBe(next);
  expect((await readFile(file + ".previous")).subarray(0, 15).toString()).toBe(
    "SQLite format 3",
  );
  await mkdir(file + ".tmp");
  await expect(store.save(initial)).rejects.toThrow();
  expect(store.load()).toBe(next);
  store.close();
  store = await openStore(file);
  expect(store.load()).toBe(next);
  store.close();
  const resolved = await realpath(dir);
  if (
    dirname(resolved) === (await realpath(tmpdir())) &&
    basename(resolved).startsWith("phrase-test-")
  )
    await rm(resolved, { recursive: true, force: true });
});
