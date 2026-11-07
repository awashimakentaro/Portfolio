# Portfolio — 現行アーキテクチャ

2026-11-07時点。現在の実装と残作業を示す。以前の案や未実装インターフェースを、実装済みAPIとして扱わない。

## 責務と依存

| 領域 | 実装・原本 | 責務 |
|---|---|---|
| 画面と入力の統合 | src/features/portfolio/Portfolio.tsx | 背景移動、UI表示、初回演出、Book終了後の予約ナビ |
| 映像取得 | frame-assets.ts | 全圧縮素材の取得・Object URL保持・中断・失敗復旧 |
| 映像描画 | frame-engine.ts | Canvas、区間再生・逆再生・ループ・描画後通知 |
| HTML UI | src/features/ui/ | ナビ・4画面の文字・Historyカテゴリ |
| 3D Book | src/features/history/book/ | カルーセル・Spring状態・SkinnedMesh・GPU資源の管理 |
| 共通契約 | src/contracts/ | SceneId・FrameState・FrameMotion・BookPublicState・BookLifecycleCallbacks |
| 本の内容 | books/category/id/ | 制作原稿と明示的な公開スナップショット |
| 映像素材 | assets/frames/ | 8系列・968枚のWebP原本 |
| 比較用試作 | archive/scroll-preview/ | 本番から参照しない過去の試作 |

PortfolioControllerとInputCoordinatorは独立クラスとして存在せず、Portfolio内の処理として実装している。外部Book契約は公開状態とコールバックに限定し、内部Springやページ番号を統合側へ渡さない。UIはBookを動的ロードする。

## 表示と入力

Profile=idle/loop-1、About Me=one/loop-2、History=two/loop-3、Contact=three/loop-4。前進時Profile・About Meは区間開始から、Historyは最初のループフレーム描画後、Contactは約0.75秒後に表示する。逆方向のUIは移動先ループの描画を待つ。移動元の内容は遷移開始でフェードアウトする。

FrameEngineはユーザー入力を登録しない。Portfolioが縦入力を集約し、再生中の追加移動を無視する。ナビは再生途中でも目的区間へ直接移動する。Bookがopening/reading/dragging/turning/settling中なら公開reading、closing中はreturning。これらの間は背景移動を禁止し、ナビ指定は最後の1件を保持してBook終了後に実行する。背景ループは継続する。

モーション進捗はrefとCSS変数で渡し、毎フレームReact stateへ流さない。描画後の状態通知でUI同期する。

## 読み込みと障害対応

FrameAssetsは6並列で全素材を取得し、圧縮BlobのObject URLを保持する。1回の取得は本文受信まで20秒を上限とし、失敗時に1度再試行する。再失敗で進行を停止・解放し、ローディングの再試行操作へ戻す。FrameEngineは96枚上限のデコードキャッシュを使用する。reduced-motionでは代表4枚を取得する。終了時はabort→Engine.dispose→素材URLの解放。

Book領域は専用エラー境界で障害を受け、WebGL初期化失敗・context loss時はHTML一覧と本文表示へ退避する。その際Bookの画面移動ロックと予約ナビを解放する。公開0冊も準備中の正常表示として扱う。表紙は公開データのURLをBookModelへ渡し、画像キャッシュもURL単位。ページ変形は進捗が不変なら骨・境界の再計算を省く。

## 制作と公開

制作book.ts・cover.ts・pages・imagesはBook Studioの入力。本番は独立したpublication.ts（id/title/category/file/cover/order/links）とpublished.mdだけを検証し生成する。下書きの構文・URL・ページ設定の不備を本番ビルドへ結合しない。制作TSは本番の型検査対象から外し、Studioの参照検証を利用する。

prepare-books.mjsがcatalog.generated.jsonとpublic/book-contentへ出力し、projects.tsとBookExperienceが一覧・本文を読み込む。公開本文は現3Dで自動分割してCanvasTexture化する。dev/build前に生成し、Next起動中の公開用ファイル変更はnpm run book:sync後に画面を再読み込みする。生成物を手編集しない。

readyは原稿の確認状態であり公開指示ではない。現状published.mdには既存の仮本文を保持している。Portfolioにはfixed-pages形式を追加。単独行の目次・外部リンク、画像、見出し、段落をR3F紙面に描く。Studioの全レイアウトの再現は未完了。

## 開発境界と残作業

統合担当はportfolio/app/contracts、UI担当はui、Book担当はhistory/book、制作・生成担当はbooks/scriptsを所有する。同一ファイルを同時編集しない。一般的な制御分割のために完成済み映像の再生方式を変更しない。

残作業は新紙面の3D接続、正式本文・画像の確定、長い本でのGPUメモリとFPS計測。全ページ分のテクスチャ準備は残っている。シーン・素材枚数の共通マニフェスト化は今後の素材差し替え時に検討する。

## 固定紙面と章への移動

snapshot-book.mjsが本人の明示的な反映依頼に基づきbook.tsと各Markdownからpublished.mdへページ境界付きでスナップショット化する。公開ビルドは制作book.tsを読まず、publication.tsとpublished.mdを検証する。参照画像だけをpublic/book-mediaへ出力する。

共通のbook-document.mjsでページとリンク先idを解決する。最初の本文ページは右、以降は紙の表裏に対応させる。目次のホットスポットをUVから解決し、対象見開きまでReact Springで一枚ずつめくる。operationで中断を検出し、閉じる・ナビで古い移動完了を無効化する。アクセシブルなHTMLの章ボタンも用意する。
