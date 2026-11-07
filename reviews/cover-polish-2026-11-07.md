# 表紙・PFC Tracker更新の検証記録

## 対象

- BookModel.tsxと新規CoverLinkFeedback.tsx：共通の3D表紙リンクのホバー。
- book-layout.mjs、Studio：勤務期間の共通書式・プレートとリンクの光。
- books/apps/pfc-tracker：添付画像、本人指定Qiitaを根拠にした本文、公開スナップショットと生成物。
- 本制作手順のreferences/cover.md：期間の統一書式とホバー反応を追記。

## 読み取りレビュー

自身で実装後に確認。別エージェントによるレビューは実施していない。

- ホバーは既存coverLinkAtの矩形を使う。追加の描画面はraycast対象外なので、既存クリックを遮らない。表紙のCanvasTextureはホバー時に作り直さない。毎フレームのReact setStateは追加していない。
- ShaderMaterialの実体uniformsへref経由で書き込む。初回確認で光が出なかった参照の問題は修正し、実画面のフレームで発光を確認した。
- 材質とジオメトリはR3F管理、matchMediaリスナーは解除。本が開く間は強調を消し、素材変更時もホバー参照を破棄する。
- 勤務期間の正本はdetails.periodのまま。表示関数のみ日付を整形。「現在」「頃」を保持し、未知・不正な書式は原文を返す。ロゴ原本と勤務期間データは変更しない。
- 添付PNGは原本を複製。画像生成・加工はしていない。旧画像も維持。
- 記事にない定量成果を追加せず、記事時点の学習中・予定を達成済みとしない。別のReact学習プロジェクトをKodoと同一視しない。記事日付と旧サイトの制作月を混同しない。
- 背景の再生アルゴリズム、素材、ページめくり制御、カルーセル制御は今回編集していない。

## 実行した確認

- npm run typecheck。
- npm run book:check：16件。
- node --test scripts/book-layout.test.mjs：期間整形と未確認書式2件。
- book-document.test.mjsのcover window / cover buttonに絞った既存2件。
- check-book.mjs apps/pfc-tracker：issuesなし、9ページ。
- Studio1280×720全5見開き、390×844全9ページ。最初に技術一覧が小画面ではみ出したため、重複説明を整理して全ページを再確認。最終結果は本文はみ出し・画像未読込なし。
- Internship3冊のStudio表紙をPC・小画面で確認。期間の横はみ出しなし。本体でもHR Cloud→PR TIMES→Eyes-Japanを確認。
- 本体で表紙を開き、目次の作品紹介をクリック、右キーで最終見開きまでめくり、一覧へ復帰。更新した全ページを表示。
- Demo/GitHubの実表紙ボタンはそれぞれ指定URLのタブを開き、本はbrowsingを維持。両ボタンの光とStudioのキーボードフォーカスも確認。
- 本体のconsole errorは最終確認で0。Three.Clockの非推奨警告は既存依存によるものとして今回の変更対象外。
- git diff --checkは今回の対象を指定して実行。

## 未実行

本番ビルド、デプロイ、公開URLの更新、外部Demoの機能テスト、実機スマホ、FPS・GPUメモリ計測、動きを減らす設定での実ブラウザー検証。縮小表示確認はStudioの390×844であり、実機検証としない。

証跡：output/playwright/cover-polish/。原稿と反映設定はdraftのまま。
