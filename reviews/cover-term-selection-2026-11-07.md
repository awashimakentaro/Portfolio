# TERMと選択中の期間表示・Diet画像差し替え

- BookExperienceからselectedをshowCoverPeriodへ渡し、期間の描画だけを中央本へ限定。coverPeriodそのものは残しているため、タイトルの位置は選択前後で変わらない。既存Demo/GitHubボタンと同じ選択条件を使用。
- BookModelとStudioのラベルをTERM:へ統一。年月表示は既存の短い~を保持。制作手順も更新。
- Diet Appは今回の添付画像を新しいファイル名へ原本コピー。coverで中央トリミングし、既存の固定枠全体を埋める。本文の作品紹介も画像参照を更新。元画像は保存。snapshot→book:syncで公開用ファイルをローカル生成。
- 自身の読み取りレビューで、showCoverPeriodがテクスチャ作成の依存に含まれること、選択変更で期間描画が切り替わること、会社名配置が維持されることを確認。別エージェントレビューは実施していない。
- npm run typecheck、book:check16件、book-layout3件、book-documentの表紙画像・クリック判定2件の計21件が通過。対象のdiff --checkも通過。
- ブラウザー操作はWork設定で無効。今回の実画面、実機、ビルド、公開サイトは未確認。push・デプロイなし。
