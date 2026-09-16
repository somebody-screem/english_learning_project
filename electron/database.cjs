const fs = require("node:fs/promises");
const initSqlJs = require("sql.js");
async function openStore(dbPath) {
  const SQL = await initSqlJs({
    locateFile: (file) => require.resolve("sql.js/dist/" + file),
  });
  let bytes;
  try {
    bytes = await fs.readFile(dbPath);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  let db = new SQL.Database(bytes);
  const version = db.exec("PRAGMA user_version")[0].values[0][0];
  if (version > 1)
    throw Error("This database was created by a newer version of Phrase.");
  db.run(
    "CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL); PRAGMA user_version=1;",
  );
  let queue = Promise.resolve();
  return {
    load: () =>
      db.exec("SELECT json FROM app_state WHERE id=1")[0]?.values[0][0] ?? null,
    save(json) {
      const task = queue.then(async () => {
        if (
          typeof json !== "string" ||
          Buffer.byteLength(json) > 50 * 1024 * 1024
        )
          throw Error("保存データが上限を超えました。");
        const data = JSON.parse(json);
        if (data.version !== 1 || !Array.isArray(data.sets) || !data.questions)
          throw Error("保存形式が不正です。");
        const next = new SQL.Database(db.export());
        try {
          next.run("BEGIN");
          next.run(
            "INSERT INTO app_state(id,json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json",
            [json],
          );
          next.run("COMMIT");
          const handle = await fs.open(dbPath + ".tmp", "w");
          try {
            await handle.writeFile(Buffer.from(next.export()));
            await handle.sync();
          } finally {
            await handle.close();
          }
          try {
            await fs.copyFile(dbPath, dbPath + ".previous");
          } catch (e) {
            if (e.code !== "ENOENT") throw e;
          }
          await fs.rename(dbPath + ".tmp", dbPath);
          db.close();
          db = next;
        } catch (e) {
          next.close();
          throw e;
        }
      });
      queue = task.catch(() => {});
      return task;
    },
    close: () => db.close(),
  };
}
module.exports = { openStore };
