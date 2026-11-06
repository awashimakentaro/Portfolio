# Portfolio v2.0 — 技術設計案

画面・操作の確定事項は[requirements.md](requirements.md)。本書の構造・型・ディレクトリは実装案であり、実装済みではない。

## 本番への取り込み方【技術判断】

本番は独立したNext.jsアプリとして組み、`scroll-preview`のWebP素材とフレーム接続・先読み・ループの考え方を参照する。試作の`main.js`はそのまま埋め込まない。試作にはグローバルのホイール／キー入力があり、ナビによる途中中断やBook閲覧中の入力制御、画面状態の通知口がないためである。完成済みの動きを比較対象として残し、本番の映像表示は入力と描画を分けて実装する。再生速度、境界のつながり、ループの見た目はブラウザーで試作と照合する。

3Dブックのスターターも、形状・ページめくり・リンク判定の参考として読む。現コードは中央本を`focused`として背景をロックし、追加ボタンを置き、明るい本文ページを描画し、React Springを使っていない。今回は閉じた中央本なら背景移動可能で、表紙クリックで開き、黒い紙をReact Springで動かすため、スターター全体をそのまま移植しない。

## 責務

| 部分 | 担当すること |
|---|---|
| FrameStage | 一体化したWebP映像の再生、ループ、正逆移動、指定画面への直接移動と再生 |
| PortfolioController | 現在画面、HTML UIの表示、ナビの行き先、閉じてから移動する手順 |
| InputCoordinator | ホイール・クリック等の振り分け。映像再生中やBook閲覧中の競合防止 |
| BookExperience | R3F＋React Spring、本の選択・開閉・ページ送りと内部状態 |
| HTML UI | Profile／About Me／History／Contact、ナビ、カテゴリ、外部リンク |
| 作品データ | TypeScriptメタデータ＋Markdown。仮本文と本番文面を区別 |

映像区間開始時の通知で対応UIを表示し、ループ到達後も維持する。毎フレームの映像更新をReactの画面状態に流さない。

## 外部契約の案

```ts
type SceneId = 'profile' | 'about' | 'history' | 'contact';
type FrameState = {
  scene: SceneId;
  phase: 'loading' | 'playing' | 'loop' | 'error';
};
type MoveResult = 'accepted' | 'busy' | 'boundary' | 'not-ready';
interface FrameStagePort {
  getSnapshot(): FrameState;
  subscribe(listener: (state: FrameState) => void): () => void;
  move(direction: -1 | 1): MoveResult;
  navigate(scene: SceneId): MoveResult; // 再生中でも中断し、対象区間の先頭から再生
}
type BookPublicState = 'browsing' | 'reading' | 'returning';
interface BookPort {
  getSnapshot(): BookPublicState;
  subscribe(listener: (state: BookPublicState) => void): () => void;
  close(): Promise<void>; // 同じ表紙へ完全に復帰してから完了
}
```

Profile=idle/loop-1、About Me=one/loop-2、History=two/loop-3、Contact=three/loop-4という素材対応をマニフェストに置く。画面順の番号とファイル名を分け、表示側はSceneIdだけを見る。

## Book内部状態と公開状態

| 内部状態の案 | 外部公開 | ホイールによる画面移動 |
|---|---|---|
| 一覧・中央選択済み・本の切替 | browsing | 可能。横ドラッグ等の操作自体は入力調停する |
| 開き中・見開き閲覧・ページ送り | reading | 無効 |
| 閉じ中・表紙へ復帰中 | returning | 無効。復帰完了後browsingへ |

中央に選択された本があるだけで背景移動をロックしない。外部へページ番号・Spring値・Three.jsオブジェクトを漏らさない。エラー時は操作可能な表紙／代替表示へ復旧してからロックを解除する案とする。

## 入力とナビの手順

- 閉じた本の表示中は通常の正逆移動を許可する。本を開いている間のホイールは消費し、背景移動・本の切替・後からの予約再生をしない。背景ループは止めない。
- 閲覧中のナビ操作は行き先をControllerで保持し、BookPort.close()の完了後にFrameStagePort.navigate()を一度呼ぶ。先に画面を消さない。
- 閉じている場合はナビから直接navigate()を呼ぶ。実際に受理された画面の通知でUIを切り替える。
- 再生中の追加ホイールは無視する。ナビは再生中でも現在の映像を中断して移動する。ナビ連打や閉じ中の行き先変更は、最後の指定を一つだけ保持する案とし、実装時に検証する。切替の見た目は実画面で調整する。
- リンククリックを表紙クリックに伝播させない。本の外側クリックは閉じる操作だけを行い、同時に画面を移動させない。
- 入力リスナーの所有者を一つにし、解除処理も同じ担当が持つ。

## 並列作業の境界

- Orchestrator／統合担当：src/app/**、src/contracts/**、src/features/portfolio/**。映像の実装方法、共有契約、入力調停、統合。
- UI担当：src/features/ui/**、src/features/history/ui/**。文字・ナビ・カテゴリ・専用スタイル。
- 3Dブック担当：src/features/history/book/**。本の形状、表紙、ページ、内部状態、GPU資源解放。
- コンテンツ：src/data/**、src/content/**。担当を1人に固定する。
- Tester／Reviewer／Designer：読み取り検証。共有型の変更は統合担当へ返す。

共有契約を決めた後、UIとBookを並列に進める。同じファイルを同時編集しない。Next.jsの具体構成、依存バージョン、表紙PNGを3Dの表面へ適用する方式、映像の読み込み・配信方式は未決定。

## PC土台の実装状況

リポジトリ直下にNext.js App Routerを作成。映像エンジンはsrc/features/portfolio/frame-engine.ts、入力はPortfolio.tsx、HTMLはsrc/features/ui/に分離した。素材はビルド前にscroll-preview/assets-webpからpublic/framesへコピーし、原本を保持する。状態通知は毎フレームではなく画面・再生状態の変化時のみ行う。HistoryのBookExperienceが操作とSpringを所有し、BookModelが立体本体、BookLeafが固定IDの表裏と骨による湾曲を描く。詳細はbook-rebuild-plan.mdの実装記録を参照。表紙テクスチャは指定のカテゴリ別透過PNGと作品名から生成する。Portfolioは映像の状態と文字・本の表示シーンを分け、HistoryではFrameEngineのloop通知まで表示を待ち、Contactでは0.75秒の表示待機を管理する。

Historyの表示準備は映像の再生と分離する。Portfolioはループ到達／History移動開始をprepareBooksとして通知し、BookExperienceはCanvasと表紙を先に非表示で準備する。表示条件は実際のHistory到達と現在カテゴリの準備完了の両方。Canvasは再入場時も保持し、非表示中はdemandで描画する。背景のフレーム選択・再生アルゴリズムは変更しない。
