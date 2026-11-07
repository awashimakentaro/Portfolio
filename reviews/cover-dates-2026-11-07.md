# 表紙右下の日付統一（2026-11-07）

## 判断と変更

- 全10冊に制作・在籍時期を表示。期間を基本とし、同年の終了年だけ省略する。継続中は現在、単月は年月。TERM等のラベル、枠、月数の推定は設けない。
- 最新回答でEngineering Learningは2026.10–11、Awashima Portfolioは2026.10–現在。HR Cloudは2026–現在で、開始月を推測しない。PR TIMESは既知の開始月を保持し2025.10–12。
- book-layout.mjsで表記と原本画像上の右下座標を共有。BookModelは透明余白をクロップした後も同じ位置へ写像する。既存の作品名・画像・リンク配置を維持するため、会社表紙の判定と日付の有無を分離。
- Studioも同じ座標を使う。小画面で44px最小高さのリンクと日付が重なったため、リンク側の位置を調整し全冊を再確認。
- book.tsとpublication.tsの期間を明示更新し、book:syncでカタログを再生成。制作中の全本文はsnapshotへ昇格していない。既存本文で矛盾するDiet App・Kodo・UTD・HR Cloudの日付文だけ訂正。
- snapshotの期間引き継ぎ、公開指定の検証、本制作Skill・表紙手順・インターンレシピ・資料・intakeを更新。

## 実行した検証

- npm run typecheck：成功。
- npm run book:check：17件成功。全カテゴリの期間を公開指定へ引き継ぎ、既存本文を保持する検証を含む。
- node --test scripts/book-layout.test.mjs scripts/book-recommendations.test.mjs：8件成功。
- Studio JS構文確認、CSS構文確認、対象差分の空白検査：成功。
- 全10冊の制作メタデータと生成カタログの期間一致を確認。
- StudioのPC表紙10表示・390px幅表紙10表示で、表紙内への収まり、タイトル／リンクとの重なりなし、画像エラーなしを確認。
- 本体1280×720でApps・Agents・Design・Internshipの3D表紙を確認。HR Cloudの開閉・一覧復帰を確認し、コンソールエラーなし。

証跡：output/playwright/cover-dates/ の各冊studio/mobile画像、apps-3d.jpg・agents-3d.jpg・design-3d.jpg・internships-3d.jpg。

## 読み取りレビュー

- 表示位置は選択状態に依存せず、日付を理由とする選択時のテクスチャ再生成を追加していない。
- タイトル位置はカテゴリで決め、新たな日付追加がApps／Agents／Designのタイトルを移動させない。
- 背景映像、シーン入力、ページめくりアルゴリズムは今回の変更対象外。
- 公開の本文全体を再生成せず、途中の制作原稿を混入させない。

スマホ実機の3D操作・FPS測定・公開環境での再検証は未実施。push・デプロイは行っていない。
