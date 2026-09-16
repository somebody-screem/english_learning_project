import { test, expect } from "@playwright/test";
test("一覧、編集、保存、再読み込み、学習 A16 A21", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "すべてのセット" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/catalog.png", fullPage: true });
  await page.getByRole("button", { name: "セットを作成", exact: true }).click();
  await page
    .getByRole("textbox", { name: "セット名", exact: true })
    .fill("E2Eセット");
  await page
    .getByRole("button", { name: "問題を追加", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "正解英文", exact: true })
    .fill("I like tea.");
  await page
    .getByRole("textbox", { name: "語句分割（正解順・1行に1つの語句）" })
    .fill("I\nlike\ntea");
  await page
    .getByRole("textbox", { name: "和訳（任意）" })
    .fill("私はお茶が好きです。");
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(page.getByText("✓ 保存済み")).toBeVisible();
  await page.screenshot({ path: "test-results/editor.png", fullPage: true });
  await page.reload();
  await expect(page.getByRole("heading", { name: "E2Eセット" })).toBeVisible();
  const card = page
    .locator(".set-card")
    .filter({ has: page.getByRole("heading", { name: "E2Eセット" }) });
  await card.getByRole("button", { name: "学習する" }).click();
  await page.getByRole("button", { name: "1問の学習を開始" }).click();
  await expect(
    page.getByRole("heading", { name: "私はお茶が好きです。" }),
  ).toBeVisible();
  const labels = await page.locator(".token-grid button").allTextContents();
  const answer = ["I", "like", "tea"]
    .map((w) => labels.findIndex((s) => s.replace(/^\d+/, "").trim() === w) + 1)
    .join(", ");
  await page.getByRole("textbox", { name: "語句番号を入力" }).fill(answer);
  await page.keyboard.press("Enter");
  await expect(page.getByText("✓ 正解です！")).toBeVisible();
  await page.screenshot({ path: "test-results/study.png", fullPage: true });
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "提出して結果を見る" }).click();
  await expect(
    page.getByRole("heading", { name: "今日も、一歩前へ。" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "一覧へ" }).click();
  await page.reload();
  await page.getByRole("button", { name: "学習履歴", exact: true }).click();
  await expect(page.getByText("1 / 1問 正解")).toBeVisible();
});
test("一括採点は提出まで正解と解説を非表示 A05 A07", async ({ page }) => {
  await page.goto("/");
  await page
    .locator(".set-card")
    .filter({ has: page.getByRole("heading", { name: "日常から学ぶ英文法" }) })
    .getByRole("button", { name: "学習する" })
    .click();
  await page
    .getByRole("button", {
      name: "まとめて採点 すべて解いてから答え合わせ",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "10問の学習を開始" }).click();
  await expect(
    page.getByText(
      "習慣を表すときは現在形を使います。every morning は「毎朝」。",
      { exact: true },
    ),
  ).toHaveCount(0);
  await page.getByRole("textbox", { name: "語句番号を入力" }).fill("1, 2");
  const before = await page.locator(".token-grid").textContent();
  await page.getByRole("button", { name: "問題2へ", exact: true }).click();
  await page.getByRole("button", { name: "前の問題", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "語句番号を入力" }),
  ).toHaveValue("1, 2");
  expect(await page.locator(".token-grid").textContent()).toBe(before);
  await page
    .getByRole("textbox", { name: "語句番号を入力" })
    .fill("1, 2, 3, 4");
  await page.getByRole("button", { name: "問題10へ", exact: true }).click();
  await page.getByRole("button", { name: "提出前の確認" }).click();
  await page.getByRole("button", { name: "提出して結果を見る" }).click();
  await expect(
    page.getByRole("heading", { name: "今日も、一歩前へ。" }),
  ).toBeVisible();
});
test("CSV取り込みと抽出 A18 A19 A24", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "取り込む", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "import.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "\uFEFF問題名,正解英文,語句分割,和訳,セクション,タグ,解説\r\nテスト,We study English.,We / study / English,私たちは英語を学びます。,基本,現在形,毎日の学習\r\n",
    ),
  });
  await expect(page.getByText("✓ 取り込み可能")).toBeVisible();
  await page.getByRole("button", { name: "1問を取り込む" }).click();
  await expect(
    page.getByRole("heading", { name: "import", exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "importを選択" }).check();
  await page
    .locator(".selection-toolbar")
    .getByRole("button", { name: "合成・抽出" })
    .click();
  await page
    .getByRole("textbox", { name: "新しいセット名" })
    .fill("抽出した問題");
  await page
    .getByRole("button", { name: "新しいセットを作成", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "抽出した問題" }),
  ).toBeVisible();
});
