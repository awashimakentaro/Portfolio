# アプリ全体のアーキテクチャレビュー

2026-11-07。Orchestratorが、映像・入力／3Dブック／制作・公開経路の3担当による読み取りレビューを統合した記録。対象は現在の作業ツリー（未コミットの整理を含む）。アプリ・設定・既存設計書の修正、テスト・ブラウザー再現は今回実施していない。以下の発火条件は静的調査に基づく。

## 全体判断

映像原本assets/frames、比較試作archive/scroll-preview、本の原本books、描画と操作srcという分離方針は維持できる。全面的な再構築を必要とする根拠は見つかっていない。一方、障害の隔離、0件状態、下書きと公開の検証範囲に対応不足がある。新しい紙面の3D接続前に、これらの境界を整える。

## 優先して対応する所見

### 1. P1：WebGL初期化失敗を本の領域に閉じ込められない

[BookExperience.tsx:378](../../src/features/history/book/BookExperience.tsx#L378) のCanvasを包むBook専用エラー境界・代替表示がなく、src/app/error.tsxもない。[Portfolio.tsx:159](../../src/features/portfolio/Portfolio.tsx#L159) は最初のProfileループから本を準備するため、Historyを選ぶ前にもWebGLを初期化する。

WebGLを利用できない環境や初期化時の例外で、Book以外の画面も通常利用できなくなるリスクがある。発生頻度や実機での症状は未検証。Book専用の境界とHTML作品一覧への代替を用意し、初期化失敗と実行中のcontext lossを分けて扱う。

### 2. P2：公開しない下書きの不備で本番ビルドが止まる

[prepare-books.mjs:7](../../scripts/prepare-books.mjs#L7) は全制作フォルダを検証し、1件でもエラーがあれば停止する。publicationによる公開対象の判定は13行目以降。[content.mjs:28](../../scripts/book-preview/content.mjs#L28) の検証は下書きのURL・ページ設定も対象。tsconfig.jsonのincludeも全TSを含み、制作途中の設定やテンプレートを本番の型検査へ結合している。

公開しない本のフォルダ作成途中・設定記入途中でも、既存サイトのdev/buildが止まる。直近の原本整理で残った設計不足。公開用契約と制作中原稿の検証を分離し、公開対象の不備は止めつつ、未公開本の制作途中を本番ビルドへ波及させない。型検査の対象も併せて設計する。

### 3. P2：公開0冊のカテゴリで例外になる

[BookExperience.tsx:189](../../src/features/history/book/BookExperience.tsx#L189) はカテゴリで作品を絞り、192〜193行目で件数0への剰余と選択を行う。その後selected.markdown・selected.idを無条件に参照する。カテゴリボタンは[PortfolioUI.tsx:128](../../src/features/ui/PortfolioUI.tsx#L128)で固定表示される。

現在は全カテゴリに公開本があり顕在化していないが、Agents・Design・Internshipの最後の本からpublicationを外すと起こり得る。公開0件を正常状態として表示する。Hooksの途中で条件returnせず、空表示と本体のコンポーネント境界を設ける。

### 4. P2：公開用の表紙設定が描画に反映されない

[prepare-books.mjs:16](../../scripts/prepare-books.mjs#L16) はpublication.coverを検証・生成するが、[BookExperience.tsx:165](../../src/features/history/book/BookExperience.tsx#L165) はBookModelへtitle/categoryだけを渡し、[BookModel.tsx:63](../../src/features/history/book/BookModel.tsx#L63) はカテゴリからPNGを固定選択する。

有効な別のpublication.coverを指定しても画面の表紙は変わらない。Studioの新しい装丁が未接続という既知課題とは別に、本番用設定が利用されていない。表紙URLを描画へ渡すか、常にカテゴリ固定とするなら設定側の自由なcover指定を廃止し、契約を一致させる。

### 5. P2：現行設計書の完了条件が表示仕様と矛盾する

[architecture.md:22](../architecture.md#L22) と [implementation-plan.md:23](../implementation-plan.md#L23) は区間開始から対応文字を表示する記述を残している。最新のHistoryはループ到達後、Contactは約0.75秒後、逆方向は到着待機という条件と一致しない。architecture.md冒頭の「実装済みではない」や76行目の「未決定」も、後半の実装記録と混在する。

Testerや新しい担当が古い完了条件で現在の表示を戻す危険がある。現行構成・確定契約・残作業を本文に整理し、過去案を履歴へ移す。追記だけで矛盾を残さない。

## 障害・負荷への備え

### 6. P2：素材取得が止まった場合に再試行へ進めない

[frame-assets.ts:27](../../src/features/portfolio/frame-assets.ts#L27) のfetchと本文取得には制限時間がない。[LoadingScreen.tsx:27](../../src/features/ui/LoadingScreen.tsx#L27) は失敗時だけ再試行を表示する。

通信が解決も失敗もしない状態ではロードが終わらず再試行も表示されない可能性がある。取得・本文受信を含めたタイムアウト、進捗停止からの回復導線を設ける。フレーム選択や再生速度の変更は不要。実ネットワークでの再現は未実施。

### 7. P2：長い本文で全ページ分の描画負荷が増える

[BookExperience.tsx:205](../../src/features/history/book/BookExperience.tsx#L205) 以降で全ページをテクスチャ化し、全leafをマウントする。[BookLeaf.tsx:101](../../src/features/history/book/BookLeaf.tsx#L101) 以降では静止中も骨・行列・境界を毎フレーム更新する。History中のCanvasは常時描画。

ページ数増加に伴ってGPU資源とCPU処理が増える構造。現在のFPSや許容ページ数は未計測。代表的な長い本で計測し、可視見開きと隣接ページの準備、進捗不変時の計算省略を検討する。

## 後続の設計整理

- 本番用本文とリンクの生成はpredev/prebuild時だけ。Next起動中にbooksを編集しても本番画面は更新されない。Studioの自動更新とは挙動が異なる。明示的な生成コマンドの案内か開発用watchを整える。
- BookPublicStateをPortfolio/UIがBookExperience実装からimportしている。外部公開状態・コールバック型をsrc/contractsへ置くと担当境界を明確にできる。Controllerと入力処理の全面分割は、回帰確認を用意してから判断する。
- シーン順・素材系列・121枚という定義がscene.ts、frame-engine.ts、frame-assets.ts、prepare-assets.mjsに分散している。素材差し替え時の不整合を防ぐ共通定義を検討する。
- Studioの固定ページ・画像・レイアウトをR3Fへ再現する接続は既知の未実装項目。単独のバグとして計上していない。接続時に共通の紙面データ契約とページ表裏の対応を先に確定する。
- .codex設定の公式スキーマ適合・実際のカスタム役割読み込みは今回未検証。3担当の委譲はこのセッションのサブエージェント機能で実行した。

## 維持する構造

- FrameEngineは入力リスナーを所有せず、Portfolioが背景移動を調停する。
- 描画後にシーン状態を通知し、毎フレーム値をReact stateへ流さない。
- 圧縮素材の保持と上限付きデコードキャッシュを分ける。
- 非同期開閉のoperationによる無効化、fetchのabort、イベント解除、GPU資源の解放が概ね揃う。今回、明確な解放漏れは発見していない。
- booksへの原本集約、明示的なpublication、公開生成物に制作メモを含めない方針、画像の参照範囲検証を維持する。

## 推奨する着手順

1. 現行設計書とエージェントの判断基準を揃える。
2. Bookの障害隔離と公開0冊状態を整える。
3. 下書き検証と公開ビルドを分け、表紙設定を描画まで通す。
4. 素材取得の回復経路を整える。
5. 共通の紙面契約を定めてStudio原稿を3Dへ接続し、長い本の負荷を計測する。

完成済み映像の見た目・フレーム再生アルゴリズムを一括変更する必要はない。実装時は各境界の失敗条件と既存操作の回帰確認を完了条件に含める。

## 修正結果（同日）

今回の修正はOrchestratorが引き継いで実装した。担当サブエージェントは利用上限で停止したため、独立した修正後レビューは未実施。

| 所見 | 対応 |
|---|---|
| WebGL障害の波及 | BookBoundaryを追加。初期化失敗・context lost時はHTMLの一覧・本文へ退避し、Bookの操作ロックを解除 |
| 下書きと本番の結合 | 7冊の公開設定をpublication.tsへ独立。生成はbook.tsを読み込まず、型検査はsrc中心に分離 |
| 公開0冊 | Book本体の外で空表示へ分岐。カテゴリ選択・ナビを継続可能 |
| 表紙設定 | BookModelへbook.coverを渡し、URL単位で画像を取得・キャッシュ |
| 設計書の矛盾 | architecture/implementation-planを現行構成へ整理し、AGENTSと担当設定も更新 |
| 素材取得停止 | ヘッダーと本文受信を含む20秒制限、1回再試行、失敗時は従来の再試行画面へ |
| 長本文の負荷 | 静止中は骨・境界再計算を省略。全ページのテクスチャ準備は残るため、長原稿でのメモリ・FPS計測と遅延準備は後続 |
| 起動中の本文更新 | book:syncを追加。実行後のブラウザー再読み込みを案内 |
| 共有Book型 | src/contracts/book.tsへ移動 |

実行した検証：

- Nodeテスト15件成功。下書きの不正構文・未作成設定と公開生成の独立、公開設定エラー時の生成停止、通信ヘッダー／本文停止のタイムアウトと再試行、Object URL解放を含む。
- 型検査・本番ビルド成功。既存7冊の公開本文は移動前のGit版とバイト一致。
- 実ブラウザーで通常の本の開閉、読書中ナビから閉じてContactへ移動、障害時の一覧と本文閲覧を確認。
- context lostを読書中にも注入し、代替表示後にContactへ移動できることを確認。
- WebGLを利用不可にした環境で、Historyの代替一覧とContactへの移動を確認。
- 公開表紙URLをテスト用に差し替え、指定画像URLが実際に取得されることを確認。
- ブラウザーに配信する一覧をテスト用に差し替えて公開0冊を再現し、準備中表示とContactへの移動を確認。リポジトリの公開作品は変更していない。

未完了：Studioの固定紙面・画像をR3Fへ接続、長原稿の実測・ページ単位の遅延準備、シーン素材の共通マニフェスト化。push・デプロイは実行していない。
