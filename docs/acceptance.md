# 受け入れシナリオ対応

自動テストと実装箇所の対応表。実装済みは、すべての端末・入力方法で検証済みという意味ではない。

| ID | 実装 | 検証 |
| --- | --- | --- |
| A01–A04 | domain.parseSequence / Study | 区切り、多桁、非分割、全角、範囲・重複・先頭0・空トークンの単体テスト |
| A05 | Session内の固定tokens/input | E2Eで番号対応と入力の復元 |
| A06 | StudyのEnter / repeat / isComposingガード | 即時採点から次へ進むE2E。実IMEは未検証 |
| A07 | Studyで未提出の解説・正解非描画 | 一括採点のDOM・提出操作E2E。ローカル開発者ツールに対する秘匿は未対応 |
| A08–A09 | 任意translation・複数answers | 和訳なし・別解・同語句交換の単体テスト |
| A10–A12 | catalog / TagPicker / matchTags | AND/OR単体テスト。1000タグの性能試験は未実施 |
| A13–A14 | MoveDialog / Folder管理 | 機能実装、個別フォルダ作成はdesktop E2E対象 |
| A15 | Editor.sections / Entry.sectionId | 追加・並べ替え・移動UIと保存時参照検証 |
| A16 | Editorから共通Data保存 | 作成→編集→再読み込み→出題→履歴E2E |
| A17–A18 | ComposeDialog | コピー抽出E2E、ID重複除去・元セット保持 |
| A19–A20 | importer + ImportDialog | CSV引用符/BOM/改行・エラー行・原子的作成の単体テストとCSV E2E |
| A21 | storage / electron.database | SQLite再起動・保存失敗・previousコピーの統合テストとbrowser永続E2E |
| A22 | 標準フォーム・dialog・focus復帰 | Enter E2E。スクリーンリーダーと実IMEの網羅検証は未実施 |
| A23 | 同じQuestion ID参照 / 独立コピー | seed共有IDとclone隔離の単体テスト、共有影響先UI |
| A24 | 共通Dataを全機能が利用 | CSV→一覧→抽出、および編集→学習→履歴E2E |

## 残るリリースゲート

- macOS/Linux、クリーンWindowsへのインストール・アンインストール試験。
- 署名・公証、SBOM、GitHub CIとレビュー承認。
- 旧製品版からのマイグレーション（現時点で旧版なし）、電源断・実ディスク障害の網羅試験。
- 100セット/1万問/1000タグの速度測定、OSのIMEと支援技術での手動確認。
- UIプロセスとは分離した採点サービスの設計・移行。
