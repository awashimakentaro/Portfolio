# ポートフォリオ Web サイト アーキテクチャ設計

- バージョン: 1.0
- 状態表記は `requirements.md` に準拠（**確定**・**提案**・**未確認**）。

## 1. システム概要

**確定事項：** 新規のNext.js開発、TypeScriptメタデータ＋Markdown、画像要素によるキャラクター連番描画、3D BookアニメーションにReact Spring、Vercel公開、モバイルではキャラクターを静止画中心にする。最新の3D Book引き継ぎ資料ではThree.jsとReact Three Fiberを描画基盤としている。

**提案する基盤：** React、TypeScript、Next.js App Router。Next.js採用は確定、App Routerは既存Bookスターターに基づく候補として新規アプリの基盤構築時に確認する。CSS/Tailwindの選択も実装開始時に決める。3D BookはR3F/Three.jsを使う設計資料があるが、スターターは試作であり、本番移植前に仕様と依存を照合する。正確な依存バージョンは互換性を確認するまで指定しない。

```text
Next.jsページ / サーバー側コンテンツ
├── Profile / Hero（クライアント操作領域）
│   ├── CharacterController（ポインター制御と操作ロック）
│   ├── FrameSequence（img描画と先読み状態）
│   └── ScrollTransition（進捗からフレーム・姿勢を計算）
├── About（本文とキャラクター最終ポーズ）
├── Works（旧称History。カテゴリ選択と作品一覧）
│   └── BookExperience（WebGLクライアント境界）
│       ├── BookStateController（明示的な状態機械）
│       ├── React Spring（本・ページの変形）
│       ├── R3F / Three.jsのシーン・マテリアル
│       └── CanvasTextureページ描画 ← 型付きMarkdownページモデル
└── Contact（メール・GitHubリンク）

コンテンツ：型付き作品メタデータ＋Markdown
素材：キャラクター連番、本の表紙・テクスチャ、作品画像
デプロイ：Vercel
```

最新デザイン資料（2026-11-04）ではProfile / Works / Contact。以前のHistoryはWorksの旧称として扱う。詳細Book引き継ぎとスターターにR3F/Three.jsが明記されているため描画基盤の設計根拠とする。ただしCanvasTextureや変形ページメッシュは試作実装の事実であり、すべての実装詳細が最終承認済みという意味ではない。Figma原本URLが未確認のため、色値・レイアウト寸法は確定しない。

## 2. 推奨ソース構成

```text
src/
  app/
    layout.tsx
    page.tsx
    globals.css
  components/
    navigation/
    ui/
  features/
    profile/
      HeroSection.tsx
      AboutSection.tsx
    character/
      CharacterController.tsx
      CharacterRenderer.tsx
      FrameSequence.tsx
      frameLoader.ts
      useCursorFrame.ts
      useScrollTransition.ts
      characterTypes.ts
    works/
      WorksSection.tsx
      CategoryNavigation.tsx
      ProjectBook.tsx
      books/
        BookExperience.tsx
        BookStateController.tsx
        BookScene.tsx
        BookModel.tsx
        PageTexture.tsx
        bookMachine.ts
        bookTypes.ts
    contact/
      ContactSection.tsx
  content/
    works/{apps,agents,design,internship}/*.md
  data/
    projects.ts
  lib/
    content/parseProjectMarkdown.ts
    animation/progress.ts
public/
  characters/hero/
  characters/transition/
  books/
  projects/
```

配置や命名は提案であり、下記の責務を保つ限り変更できる。

## 3. コンテンツモデル

```ts
export type ProjectCategory = 'apps' | 'agents' | 'design' | 'internship';
export type BookType = 'standard'; // バリエーションはデザイン資料で必要な場合にのみ追加

export interface ProjectMetadata {
  id: string;
  title: string;
  category: ProjectCategory;
  contentPath: string;
  thumbnail?: string;
  description?: string;
  bookType?: BookType;
  demoUrl?: string;
  githubUrl?: string;
  order: number;
}

export interface ProjectPageBlock {
  kind: 'heading' | 'paragraph' | 'list' | 'image' | 'callout';
  level?: 1 | 2 | 3;
  text?: string;
  items?: string[];
  src?: string;
  alt?: string;
}

export interface ProjectBookContent {
  title: string;
  blocks: ProjectPageBlock[];
}
```

ブロック形式は実装案であり、CanvasTextureの試作は本文を選択できず、自動ページ割りを行わない。Markdown解析では許可した構文だけを扱い、シリアライズ可能なページデータを生成する。任意HTMLをCanvas描画へ渡さない。カテゴリ、タイトル、順序、外部リンクはメタデータを正とし、Markdownは作品の詳細本文を持つ。

## 4. キャラクター実行時の責務

### データの流れ

1. ポインター座標をHeroの目標フレームへ変換し、範囲内に制限する。
2. アニメーションフレームループで現在フレームを目標へ補間する。
3. ステージ位置からHero〜About間の正規化進捗 `p ∈ [0,1]` を計算する。
4. `p` から遷移フレームとキャラクターの変形（位置、サイズ、デザインに応じた不透明度）を求める。
5. 制御権を `hero-pointer` または `scroll-transition` のどちらか一方にする。
6. 引き継ぎ境界を逆方向に越えたらポインター制御へ戻す。

進捗値を唯一の基準にする。高頻度の値はrefを使うアニメーションループで扱い、読み込み中・失敗など低頻度のUI状態だけReact stateにする。同じプロパティをGSAP、React state、直接DOM更新で同時に制御しない。

### 画像シーケンス

`FrameSequence`はフレームURL解決、総フレーム数、現在フレーム、先読み範囲、フォールバック画像を受け取り、`<img>`を描画する。セクションのレイアウトやスクロール状態は管理しない。`frameLoader`は画像リクエストを重複排除し、読み込み済み・失敗フレームを記録する。次の画像準備中も現在表示中の画像を維持する。ファイル命名規則・形式は実物確認後に決める。

### スクロール実装

`IntersectionObserver`/スクロール位置計測と単一の`requestAnimationFrame`スケジューラーを使う案。（提案）キャラクター試作はGSAPなしで動いているため、GSAPは全体の必須依存にしない。別演出で導入する場合もキャラクターのフレームや変形値を二重に制御しない。2026-11-04のアニメーション実装計画ではHero→ダンベル姿勢の遷移を採用し、Cの追加動画演出を不採用としている。

## 5. 3D Bookの実行時責務

### 描画とアニメーション

- BookシーンはR3F/Three.jsを使う設計を基準とし、クライアント専用境界に隔離する。サーバー側ではフォールバックまたは表紙表現を描画する。
- React Springは本の変形とページ送り進捗を制御する。カテゴリ・作品選択の状態は管理しない。
- R3F/Three.jsの採用根拠は2026-11-04の3D Book引き継ぎとスターター。Next.js 15 / React 19などのスターターバージョンは新規アプリの依存バージョンとしてそのまま固定しない。
- 試作のページはCanvasTexture上に描画され、メッシュ変形でめくる。SkinnedMeshや物理シミュレーションの採用は確認されていない。
- 本の選択と開閉を別状態にする。選択した本はまず閉じた表紙が正面を向き、表紙上のDemo/GitHubリンク以外を操作すると開く。開いた状態では左右ページまたはHTML操作で前後し、背景クリック/Escで閉じてカルーセルへ戻る。
- HTML操作とフォーカス可能なリンクを3D面以外にも用意し、UVクリックだけにキーボード・タッチ操作を依存させない。
- CanvasTexture生成処理は型付きページブロックから決定的なページを生成する案。文字折り返し、フォント、解像度、ページ寸法、本文の選択可能性は未確認。

### 状態機械（最低限の提案）

状態：`carousel`、`presenting`、`cover`、`opening`、`reading`、`turning`、`closing`。

イベント：`SELECT_PROJECT`、`PRESENT_SELECTED`、`OPEN`、`NEXT_PAGE`、`PREVIOUS_PAGE`、`CLOSE`、`ANIMATION_FINISHED`、`ASSET_ERROR`。

| 現在の状態 | イベント | 次の状態 | 必要な処理 |
|---|---|---|---|
| carousel | SELECT_PROJECT(id) | presenting | 選択本を正面へ回転。自動では開かない |
| presenting | ANIMATION_FINISHED | cover | 正面の表紙とリンク操作を有効化 |
| cover | OPEN | opening | 表紙を開く |
| opening | ANIMATION_FINISHED | reading | ページ操作を有効化 |
| reading | NEXT_PAGE / PREVIOUS_PAGE | turning | 有効範囲内の隣接ページへ動かす |
| turning | ANIMATION_FINISHED | reading | 現在ページ番号を確定 |
| cover / reading | CLOSE | closing | 選択本を閉じ、斜めカルーセルへ戻す |
| closing | ANIMATION_FINISHED | carousel | カルーセル操作を再開 |
| 任意 | ASSET_ERROR | 現在状態＋エラーUI | 表紙・本文の利用可能なフォールバックを維持 |

`opening`、`turning`、`closing`中の競合イベントを無視またはキューイングする。方針は操作デザイン確認後に確定する提案。状態変更は明示イベントで確定し、spring値から推測しない。作品切替・アンマウント時にリセットまたはキャンセルできるようにする。

## 6. 描画境界と耐障害性

- 意味のある本文とナビゲーションはWebGLキャンバスの外側にも置き、アクセシビリティとフォールバックを確保する。
- Worksが画面近くに来た時、または本を開く時に3Dシーンを遅延ロードする。
- WebGL非対応、コンテキスト喪失、テクスチャ読み込み失敗時は2Dの表紙・本文表示へ切り替える。
- メタデータと本文解析をクライアント描画から分離し、静的ビルドやSEOがWebGLに依存しないようにする。
- 動きの低減設定とポインター機能に配慮し、タッチ端末でホバーを必須にしない。

## 7. デプロイと設定

公開先はVercel（確定）。リポジトリのスクリプトとコミット済みロックファイルでビルドを再現する。正確なランタイム・依存バージョンは実装時に選び、本書では推測しない。初期素材は`public/`に置く案。実容量の計測後に外部素材配信の要否を判断する。秘密情報や非公開データをクライアントバンドルに含めない。

## 8. アーキテクチャ判断一覧

| 判断 | 状態 | 理由・次の確認 |
|---|---|---|
| TypeScriptメタデータ＋Markdown | 確定 | 型付きの作品情報と本文を分離 |
| キャラクター連番に画像要素 | 確定 | 試作の描画方式を移植 |
| 3D BookアニメーションにReact Spring | 確定 | ユーザーの最終技術選定 |
| Next.js | 確定 | ユーザーが新規Next.js開発を指定 |
| Next.js App Router | 提案 | 過去案とBookスターターに基づく候補。新規基盤で確認 |
| R3F/Three.jsによるBook描画 | 確定方針 | 2026-11-04の3D Book引き継ぎ資料に明記。スターター実装は検証済み完成品ではない |
| GSAP依存なしのスクロール管理 | 提案 | 試作はGSAP不要。各アニメーション値に単一の管理主体 |
| BookにReducer/状態機械 | 提案 | 遷移を明示し、完了処理を決定的にする |
| 初期素材置き場に`public/` | 提案 | 実素材を棚卸しして再評価 |
