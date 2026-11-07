# 期間の選択切り替えによる表紙のちらつき

## 原因と修正

BookModelで選択状態由来のshowCoverPeriodが変わると、表紙作成effectが走り、setSurface(null)によって表紙のplaneが外れた。その間に黒いボードだけが見える構造だった。またeffectのcleanupで、表示中のテクスチャを新しい表紙が準備される前に解放していた。

- showCoverPeriodを削除。期間は全位置で表示し、TERMラベルなし。Internshipは選択によって期間のテクスチャを再生成しない。
- 更新開始時の表紙消去を廃止。以前の表紙から完成した表紙へ置き換え、コミット後のsurface effect cleanupで古いテクスチャを解放。
- 読み込み完了前にキャンセルされた処理はテクスチャを作らない。unmount時は表示中surfaceのeffect cleanupで解放。
- Demo/GitHubの切り替えで以前の表紙が残る短時間は、現在propsのURLとの照合で非選択リンク起動を防止。
- Studioも期間だけの表示に揃え、本制作手順を更新。

## 確認

自身でeffect依存、古い表紙の維持、キャンセル、テクスチャの解放、リンクガードを読み取りレビュー。別エージェントは使用していない。背景、めくり、カルーセル移動アルゴリズムは変更していない。

npm run typecheck、npm run book:check16件、book-layout.test.mjs3件、対象のdiff --checkが通過。既知のブラウザー操作無効によりちらつきの実画面確認は未実施。公開・push・ビルド・GPU計測なし。
