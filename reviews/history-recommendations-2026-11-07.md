# おすすめ一覧とAgents表紙タイトル

## 実装

- data/recommendations.tsに本人指定の本idを登録：Apps=Diet App / Presence-Note、Agents=Engineering Learning、Design=Awashima Portfolio、Internship=HR Cloud。
- BookRecommendationsは作品名のボタンを一覧表示し、現在の選択はaria-currentと背景・枠で表す。データが欠けた推薦は表示しない。
- browsing中に矢印の横へ表示。本の開閉・閲覧中は表示しない。狭い画面では矢印の下へ配置。ホバーの光・focus-visible・動きを減らす設定を追加。
- 押すと既存カルーセルの論理位置を近い方向へ変更する。現在の本を押しても位置は変えない。閲覧ロック中は位置変更しない。表紙クリックで本を開く既存操作を維持。
- WebGLを使えない場合のHTML一覧にも同じおすすめ一覧を表示し、該当本文へ進める。
- 画像なし表紙のタイトルは本体・Studioとも上側へ移動。Engineering Learningは1行。画像あり表紙や期間付き表紙の位置は維持。
- 要件・デザイン仕様・本制作手順・Agents制作記録を更新。本文と背景映像は変更しない。

## 検証と読み取りレビュー

- npm run typecheck、book:check16件、book-layout3件、おすすめ3件の計22件、Studioの構文チェック、対象diff --checkが通過。
- おすすめテストで公開カタログ内のidとカテゴリ、重複なしを照合。1/3/5/10冊、負の位置と周回後を含む全位置からの最短移動と無効ターゲットを検証。
- 自身でイベントのbutton/a除外、閲覧時ガード、位置更新、idの照合、single-book時の安定、HTML退避経路を読み取り確認。別エージェントレビューなし。
- 推薦の描画とposition変更はHTMLと既存選択処理に限定し、毎フレームstateや映像アルゴリズムを追加しない。
- ブラウザー操作はWork設定で無効のため、今回のPC・小画面の見た目と実操作は未確認。実機・本番ビルド・公開サイトも未検証。push・デプロイなし。
