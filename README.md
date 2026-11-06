# Awashima Kentaro — Portfolio

PC向けNext.jsポートフォリオの実装中です。映像・4画面・HTMLナビと、Historyの3D本・見開き閲覧の試作を実装しています。本の表紙は指定のカテゴリ別透過PNGを使用し、本体と紙は3D形状で描画します。正面表示で、回転操作は設けません。本文の紙はSkinnedMeshで湾曲させ、クリックとドラッグでめくれます。作品の正式本文は今後の作業です。

2026-11-06の再構築では、面取りした本体・布の凹凸・背景になじませる局所的な陰影を追加しました。ページは固定IDの表裏を持つ紙として保持し、開閉とめくりをSpringの完了に合わせて確定します。設計と実行した確認は[本の再構築方針](docs/book-rebuild-plan.md)を参照してください。

Appsは10冊固定です。追加の7冊はSample Appと明示した架空データで、正式作品とは別管理です。初回登場の時間差落下・反発・光粒を残し、横送りで入る本は画面外からスライドします。横ドラッグは離すと1冊送り、一覧全体を引っ張って戻す動きは付けません。

## 起動

Node.js 20.9以上（開発時22.17.1）。リポジトリ直下で実行します。

```sh
npm ci
npm run dev
```

ブラウザーで http://localhost:3000 を開きます。試作は `scroll-preview/` に独立して残しています。

## 確認・本番ビルド

```sh
npm run typecheck
npm run build
npm start
```

Next.js/React/TypeScriptの実バージョンはpackage.jsonとpackage-lock.jsonで固定しています。導入手順は[Next.js公式](https://nextjs.org/docs/app/getting-started/installation)を参照。

## 操作

- 初回はProfileを再生し、終点でループします。
- 縦ホイール／上下キーで次・前の映像区間へ移動します。再生中の追加ホイールは無視します。
- 上部ナビは再生途中でも目的の画面へ直接移動します。
- Historyは4カテゴリ7冊。本の左右選択、中央表紙クリックで開く、左右ページのクリックと端のドラッグでページを送る操作ができます。カテゴリと中央の本は画面を離れても保持します。
- 本を読んでいる間の縦ホイール移動を止めます。ナビを押すと本を閉じてから目的画面へ進みます。
- 動きを減らす設定ではループの代表フレームを表示します。

## ファイル

- `src/features/portfolio/`：映像描画と入力制御
- `src/features/ui/`：ナビ・4画面のHTML UI
- `src/features/history/book/`：3D表紙・閲覧UI・TypeScript作品情報・Markdown仮本文
- `src/contracts/`：画面IDなどの共有型
- `scroll-preview/assets-webp/`：採用映像の原本（968枚）
- `scripts/prepare-assets.mjs`：起動／ビルド前に原本を `public/frames/` へコピー。生成先はGit管理外
- [資料の入口](docs/README.md)：現行仕様と過去資料への案内

公開URL：<https://portfolio-silk-two-49.vercel.app>

Vercelの`portfolio`プロジェクトにGitHubリポジトリを接続済みです。`main`へのpushで本番を自動更新します。ルートはリポジトリ直下、インストールは`npm ci`、ビルドは`npm run build`（`vercel.json`で指定）。`prebuild`が映像素材を配置するため、`scroll-preview/assets-webp/`を残してください。

公開後、認証なしのHTTPアクセスとPCブラウザーで映像・Historyの本の開閉／ページ送り・Contactを確認しました。
