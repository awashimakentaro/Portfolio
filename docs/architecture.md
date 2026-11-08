# Portfolio — 現行アーキテクチャ

2026-11-08時点。現在の実装と残作業を示す。以前の案や未実装インターフェースを、実装済みAPIとして扱わない。

## 責務と依存

| 領域 | 実装・原本 | 責務 |
|---|---|---|
| 画面と入力の統合 | src/features/portfolio/Portfolio.tsx | 背景移動、UI表示、初回演出、Book終了後の予約ナビ |
| 映像取得 | frame-assets.ts／frame-manifest.generated.json | 区間バンドルの取得・元WebPへの分割・Object URL保持・中断・失敗復旧 |
| 映像描画 | frame-engine.ts | Canvas、前進区間再生・再生中の移動・戻り先ループへの切替・描画後通知 |
| HTML UI | src/features/ui/ | ナビ・4画面の文字・Historyカテゴリ |
| 3D Book | src/features/history/book/ | カルーセル・Spring状態・SkinnedMesh・GPU資源の管理 |
| 共通契約 | src/contracts/ | SceneId・FrameState・FrameMotion・BookPublicState・BookLifecycleCallbacks |
| 本の内容 | books/category/id/ | 制作原稿と明示的な公開スナップショット |
| 映像素材 | assets/frames/ | 8系列・968枚のWebP原本 |
| 比較用試作 | archive/scroll-preview/ | 本番から参照しない過去の試作 |

PortfolioControllerとInputCoordinatorは独立クラスとして存在せず、Portfolio内の処理として実装している。外部Book契約は公開状態とコールバックに限定し、内部Springやページ番号を統合側へ渡さない。UIはBookを動的ロードする。

## 表示と入力

Profile=idle/loop-1、About Me=one/loop-2、History=two/loop-3、Contact=three/loop-4。前進時Profile・About Meは区間開始から、Historyは前進映像の進捗42.5%のフレーム描画後、Contactは約0.75秒後に表示する。戻る場合は逆再生をせず移動先ループの先頭へ短いフェードで移り、UIはそのフレームの描画を待つ。移動元の内容は遷移開始でフェードアウトする。

FrameEngineはユーザー入力を登録しない。Portfolioが縦入力を集約し、冒頭・区間再生中でも新しい操作で移動できる。SceneWheelGestureが180ms超の静止または方向変更で操作を区切り、閾値30を超えた1操作につき1移動だけ許可する。これにより慣性で全画面を飛ばさない。移動先は表示済みstateではなく要求中のclip.destinationを基準にし、フレームのデコード待ち中も最後の入力を反映する。前方向は移動先の先頭フレームへ約220msで馴染ませ、その間はフレームを進めず、フェード後に区間を通常再生する。これにより冒頭のカメラ移動をフェードで隠さない。次区間の先頭6枚はProfile冒頭を含む再生中にもデコードしておく。戻り方向はループの先頭へ直接切り替える。ナビも同じ方向別の移動方針を使う。getDestination()で描画待ちを含む要求先を参照し、同じ行き先へのnavigateは受理だけして再生を開始し直さない。Portfolioも本の閉じる予約より前に同じ要求先を除外する。明示retryは別経路で再生を再試行できる。

初回の素材取得中・完了リングの表示中は入力を禁止し、Profileのフェード表示と映像再開が始まる時点からスクロールとHTML UIを有効にする。キー長押しのrepeatは追加移動にしない。Bookがopening/reading/dragging/turning/settling中なら公開reading、closing中はreturning。これらの間は背景移動を禁止し、ナビ指定は最後の1件を保持してBook終了後に実行する。背景ループは継続する。

モーション進捗はrefとCSS変数で渡し、毎フレームReact stateへ流さない。Historyの前進では描画後の進捗が42.5%に達した時だけ表示先を更新し、末尾69フレーム分（通常間隔33msなら約2.3秒）早く登場させる。準備完了のBookガードは維持。ループ到達通知は低モーション設定などの代替経路にも使う。

## 読み込みと障害対応

FrameAssetsは8区間のバンドルを最大6並列で取得し、完了後に元の968枚の圧縮WebPへBlob.sliceで分割する。初回は引き続き全素材の取得を待つ。進捗リングは受信バイト量を基準に更新し、全区間を検証・保持してから100%にする。1回の取得は本文受信まで60秒を上限とし、失敗時に1度再試行する。サイズ不一致も失敗として扱い、再失敗で取得を停止・解放して再試行操作へ戻す。FrameEngineは変更せず、96枚上限のデコードキャッシュを使用する。reduced-motionではバンドルを取得せず、代表4枚だけを取得する。終了時はabort→Engine.dispose→素材URLの解放。

prepare-frame-bundles.mjsが原本WebPを再圧縮せず連結し、public/frame-assetsへ生成。各区間のファイル名は内容ハッシュ付きで、同じ素材ならデプロイを跨いでURLを再利用し、変更時だけURLを変える。vercel.jsonでこの生成ディレクトリに限ってCache-Control: public, max-age=31536000, immutableを設定する。本文MarkdownやHTMLにはこの長期キャッシュを適用しない。配信は既存のVercel CDNを利用し、Cloudflare DNSはそのまま。元画像・再生アルゴリズム・画質・フレーム数は変えない。圧縮映像の合計容量は減らしていないため、初回の時間は回線速度にも依存する。

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


Book StageのGPU事前準備は、1フレーム最大2テクスチャ・経過4msを目安に小分けで進める。重い転送後は次フレームへ回し、compileAsyncと隠れたrenderを終えてからonPreparedを通知する。1冊のカテゴリはBookArrivalの登場順を0にし、複数冊の中央用の320ms待機を使わない。準備中のcategory照合・非同期中断・資源の所有と解放は維持する。


Internshipの3冊表示は、画面外の左右2枠を登場順の待機に数えない。見えている左・右・中央を0・1・2の順にし、80ms刻みの待機を0・80・160msへ短縮（以前は160・240・320ms）。5冊表示の順番と1冊表示の待機なしは維持する。
