import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
test("Windowsデスクトップ実機: SQLiteへ保存して再起動", async () => {
  test.setTimeout(120000);
  const dir = await mkdtemp(join(tmpdir(), "phrase-desktop-test-"));
  const launch = () =>
    electron.launch({
      executablePath: resolve("release/win-unpacked/Phrase.exe"),
      args: [],
      env: { ...process.env, PHRASE_TEST_DATA: dir },
      timeout: 60000,
    });
  let app = await launch();
  let page = await app.firstWindow();
  await expect(page.locator(".local-status")).toContainText("ローカルに保存");
  await page
    .getByRole("button", { name: "フォルダを作成", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "新しいフォルダの名前" })
    .fill("デスクトップ確認");
  await page.getByRole("button", { name: "決定", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "デスクトップ確認" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "セットを作成", exact: true }).click();
  await page
    .getByRole("textbox", { name: "セット名", exact: true })
    .fill("デスクトップ保存テスト");
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(page.getByText("✓ 保存済み")).toBeVisible();
  await app.close();
  app = await launch();
  page = await app.firstWindow();
  await expect(
    page.getByRole("heading", { name: "デスクトップ保存テスト" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "デスクトップ確認" }),
  ).toBeVisible();

  await app.close();
});
