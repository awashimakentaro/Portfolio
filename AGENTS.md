# Portfolio v2.0 開発ルール

## 正本と優先順位

- `docs/requirements.md`、`docs/architecture.md`、`docs/design-spec.md`、`docs/implementation-plan.md` の日本語版を先に読む。2026-11-06ヒアリングを反映したrequirements.mdを画面・操作の正本とする。FigmaはUIの参考で、採用済み映像と最新回答を優先する。
- 背景＋キャラクターは統合WebP連番。`archive/scroll-preview`は映像の流れと操作感の参考試作であり、本番へのコード再利用は必須ではない。
- 映像原本は`assets/frames/`。`archive/scroll-preview/`は比較用として保存し、本番は参照しない。本番FrameStageは別に設計できる。試作の内部アルゴリズム・素材構成・補正値を本番要件として固定しない。
- 作品表示名はHistory。BookはR3F描画＋React Springアニメーション。作品データはTypeScriptメタデータ＋Markdown。文字・ナビは独立HTML UI。PC優先。
- 依存バージョン、素材容量、実在のURLを推測しない。作品本文はユーザー承認済みの差替え用仮文を使えるが、実績として確定しない。未実装の契約を実装済みと報告しない。

## Orchestrator

Orchestratorはタスクごとに仕様、依存、担当、編集ファイル、完了条件を明示する。実装済みのScene/Book公開契約と統合を管理する。入力・画面制御は現在Portfolio.tsx内にあり、独立した未実装APIを前提にしない。同一ファイルの並行編集を禁止する。独立した調査・読み取りレビューは並列化できる。

変更タスクは設計確認→実装→実行したテスト→読み取りレビュー→必要な修正の順に進める。フェーズ完了時に結果、未実行の検証、未解決事項をユーザーへ報告する。各フェーズ完了後は次フェーズの承認を待つ。2026-11-06に実装開始が承認された。PCの映像・4画面・ナビ・HTML UIの土台と検証を終え、「つづけろ」を受けてHistoryの3Dブックを進行中。

## 担当とファイル境界

- **UI担当（`ui_developer`）**：独立HTML UI、文字、ナビ、History周辺UI、PCレイアウト。提案所有範囲は`src/features/ui/**`と`src/features/history/ui/**`。FrameStage、Book内部、共有契約を編集しない。
- **3Dブック担当（`book_engineer`）**：`src/features/history/book/**`のR3F、React Spring、内部状態機械、公開`browsing/reading/returning`、資源解放。FrameStage、UI担当ファイル、共有契約を編集しない。
- **`designer`**：Figmaと実装の視覚・UX差を読み取り専用で報告。Figmaにアクセスできなければ未確認とする。
- **`tester`**：PC実ブラウザーを優先し、区間再生、ループ、閉じた中央本での移動許可、Book閲覧中のホイール無効と閉じてからナビ移動、HTML入力競合、逆方向、表示同期を検証。アプリコードを編集しない。
- **`reviewer`**：設計・コードを読み取り専用でレビュー。入力の二重登録、状態遷移、イベント解除、R3F／Three.js資源解放、性能、保護領域の差分を重点確認。
- **Orchestrator／統合担当**：`src/app/**`、`src/contracts/**`、`src/features/portfolio/**`。本番FrameStageの契約を決め、UI・Bookの統合を行う。

`developer`は汎用実装担当として残し、UIとBookの並列タスクでは上記の専用エージェントを使う。

上記`src/`にPC向けの初期実装がある。Bookはdocs/book-rebuild-plan.mdに沿って再構築した確認用の版。共有型変更が必要ならOrchestratorに提案し、別担当のファイルを直接編集しない。

## Skillと報告

作品・インターンの本を「質問に答えて作る」「続きを作る」「原稿を修正する」依頼には、プロジェクトSkill `.agents/skills/portfolio-book-authoring/SKILL.md` を読む。回答と進捗は各作品の `books/<カテゴリ>/<作品id>/intake.md` に保存し、別チャットから再開できるようにする。掲載要件は `docs/book-content-requirements.md`。Book Studioの原稿プレビューと本番3Dへの反映を区別する。既存の公開用本文は各本のpublished.md、公開指定は各本のpublication.ts（制作book.tsから独立）。catalog.generated.jsonとpublic/book-contentはassetsによる生成物で、手編集しない。制作中のpages・画像・linksを公開指定へ自動昇格しない。

本制作は共通Skillから対象カテゴリの`references/recipes/apps.md`・`agents.md`・`design.md`・`internship.md`の1つを読む。Apps・Designは共通6章、Agentsは作った経緯と変化の4章、Internshipは専用6章。Agentsに制作プロセス・技術一覧の章を戻さない。カテゴリ・レシピ・回答・次の質問をintakeへ保存し、既知の情報を再質問しない。カテゴリ別の描画や公開処理を増やさない。

共有Skillは`.agents/skills/`に置く。Designerは`design-audit`と`web-design-guidelines`、UI担当は`frontend-design`と`vercel-react-best-practices`、Book担当は`threejs-engineer`と`vercel-react-best-practices`、Testerは`playwright`、Reviewerは関連するReact・WebデザインのSkillを使う。Skillの一般論より本プロジェクトの確定仕様を優先する。`ui-designer`、`frontend-developer`、`qa-expert`、`code-reviewer`は外部Skillではなく役割名である。

実行したテストだけを結果として報告する。各報告には対象ファイル、設計判断、観測事実、未確認事項を明記する。Figma連携や実ブラウザーが利用できなければ、その制約を報告する。

## ヒアリングで確定した操作

- 前進時Profile・About Meの文字は区間開始から表示。逆方向のUIは移動先のループ到達を待つ。Historyは映像が終わってループ先頭へ入ってから本と文字を表示する。Contactは背景開始から約0.75秒遅らせる。ナビはProfile／About Me／History／Contact。目的画面へ直接移り、その映像を再生する。
- 中央の閉じた本は少し前に出てリンクを使え、表紙クリックで開く。選択だけでは画面移動を禁止しない。
- 開閉・閲覧・復帰中はホイールを無効にする。背景ループは続け、ナビ指定は本を閉じ終えてから実行する。
- Portfolioのfixed-pages本文は文章と画像・外部リンク・タッチできる目次を扱う。作品は6章が標準。左右ページクリックとドラッグで送る。最初の左ページまたは本の外側で閉じる。
- 指定の4表紙・掲載作品・Contactの確定値はrequirements.mdを参照する。Appsは実作品5冊のみで、架空サンプルを追加しない。Internshipの順はHR Cloud → PR TIMES → Eyes-Japan。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

Bookの初期化失敗・context lossはHTML一覧へ退避し、reading/returningロックと予約ナビを解放する。公開0冊は準備中として扱う。共有Book状態はsrc/contracts/book.tsが正本。公開用ファイル変更後はnpm run book:syncで再生成する。
