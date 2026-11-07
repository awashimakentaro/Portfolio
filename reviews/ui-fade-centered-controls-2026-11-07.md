# 文字のフェードとHistory操作部の中央配置

## 完了した変更

- Profileの独立見出しを削除。名前をh1にしてaria-labelledbyを維持し、font-weight:400を明示して太さを変えない。
- Profile/About/Contactはセクション単位の600msフェードイン。子要素ごとの遅延・移動・ぼかしとタイトル光沢通過を削除。退出は650msのopacityのみ。Historyの見出し・カテゴリも同じfade。本の登場・めくり・背景映像タイミングは変更しない。
- 矢印と冊数だけの幅を基準に50%へ配置。おすすめは絶対配置で右矢印の隣に付け、中央位置へ影響させない。作品名一覧を削除して「✦ おすすめ」ボタン1個へ統一。
- 各カテゴリ1冊の推薦：Apps=Diet App、Agents=Engineering Learning、Design=Awashima Portfolio、Internship=HR Cloud。Appsは先に挙げられたDiet Appを採用すると開始時に明示。押すと対応する本が中央へ移動し、表紙クリックで開く。
- 読書中は矢印・冊数・おすすめを隠す。
- 実ブラウザーで操作するとUIのoverlayが48px内部スクロールし、ヘッダーが欠ける問題を発見。overflow:hiddenからclipへ変更し、フォーカスによる内部スクロールを防止。修正後のクリックでscrollTop0、headerTop0を確認。

## 実行した確認

- typecheck、book:check16件、book-layout3件、book-recommendations3件：通過。
- CSS2ファイルをPostCSSで構文解析、対象diff --check：通過。PostCSSの最初の解決先が存在しなかったため、実在のnode_modules/postcssで再実行して通過。
- 実ブラウザー1280×720でProfileの見出しが名前だけであることを確認。独立Profile見出しなし、名前の太さ400。
- Profile→About→History→Contactへスクロール。Contact→History→About→Profileへ逆スクロールして、到着後の表示を確認。
- About/ContactのセクションanimationDuration0.6s。子の見出し・段落・リンクはanimationなし、delay0、transformなし、filterなし。まとめたfadeとして表示。
- 4カテゴリそれぞれ推薦先と1個の可視ボタンを確認。AppsはCampus QiitaからDiet App、InternshipはPR TIMESからHR Cloudへおすすめで戻ることを確認。
- 操作部と分数の中心：1280px幅=640、390px幅=195、320px幅=160。全て画面中央。おすすめは右矢印の右側に配置され、各画面内に収まる。320px幅の右端311.16、390px幅の右端373。
- 本を開いたreading状態で可視おすすめ・矢印・分数がなくなること、閉じて一覧へ戻ることを確認。
- 390×844のProfile/AboutとHistory、320×740のHistoryを実ブラウザーで確認。実機スマホではない。
- Agentsの新表紙と上側1行タイトル、Dietの全面表紙も今回の画面で確認。
- 最終console error0。既存のTHREE.Clock非推奨警告は変更対象外。

## 補足と未実行

開始時はWork設定によりブラウザー操作が無効だったが、本人の設定変更後に接続可能となり、上記を実行した。ローカルサーバーが止まっていたため3100で再起動。表示タイミング確認時の一部waitはツールの3秒期限を超えたが、後続の画面・DOMで区間の到着を確認して継続。これをアプリのエラーと扱わない。

自身で実装後の読み取りレビューを実施。別エージェントレビューなし。公開・push・本番ビルド・実機・FPS/GPU計測は実施していない。

証跡：output/playwright/ui-final-polish/。checks.jsonに配置・フェード・選択先・エラー、各画面のJPEGを保存。
