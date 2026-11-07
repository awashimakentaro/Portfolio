# 本番用の素材原本

`frames/` は背景とキャラクターを一体化したWebP連番の原本です。8系列・各121枚、計968枚をGitで管理します。2026-11-07にscroll-preview/assets-webpから内容を変えず移動しました。

`npm run assets`（dev/buildの前にも実行）が `public/frames/` へコピーします。ブラウザーの取得URLは `/frames/...` のままです。public側は生成物で、原本を直接置き換えません。

試作コードは [archive/scroll-preview](../archive/scroll-preview/README.md)、本番の再生処理は `src/features/portfolio/`。素材を作り直す作業と、フォルダ整理は区別します。
