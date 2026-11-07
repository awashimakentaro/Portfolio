<!-- page:contents -->

[01　作品について](#about)

[02　課題・背景・目標](#context)

[03　制作プロセス](#process)

[04　検証・改善](#review)

[05　成果と効果](#outcome)

[06　使用技術・ツール](#tools)


<!-- page:about -->

![Diet Appのプロダクトコンセプト](./images/pfc-tracker-cover-full.png)

AIで食事を記録し、栄養・体重・目標を管理するWeb／モバイルアプリです。テキストや画像で入力し、履歴編集や食品情報の再利用につなげます。

2026年3月から4月に制作。AIによる個人開発から始め、設計・実装を学び直しながら改善を続けています。

[Demoを開く](https://diet-phi-bay.vercel.app/)

[GitHubを見る](https://github.com/awashimakentaro/diet)


<!-- page:context -->

## 作れる楽しさと、理解の壁

React Nativeを学び始め、AIと一緒にアプリを形にできることに夢中になりました。一方で、動くコードの理由を説明できず、AIの出力が適切か判断できない不安もありました。

## 使う人の体験を考える

特に面白さを感じたのは、画面構成やボタン配置、操作の流れを考えること。食事・栄養・体重の記録をつなぎ、迷いやストレスを減らす体験を目指しています。

自分で設計・実装する基礎を学び直し、生成されたコードを理解して改善できる力を身につけることも、この制作の目標です。


<!-- page:process -->

## 入力から、記録の再利用まで

![Diet AppのAI食事入力画面](./images/diet-food-entry.png)

食事内容をテキストや画像で入力し、AIで食品情報を整理する流れを用意しました。記録した内容は履歴から編集でき、食品ライブラリを使って繰り返しの入力にもつなげます。

Web版とExpo／React Nativeのモバイル版は、同じリポジトリ内の別ディレクトリで管理しています。


<!-- page:process-structure -->

## 作り直しを、設計の学びにする

React／Next.jsの基礎、ルーティング、状態管理を学び直し、機能ごとに責務を分ける構成を取り入れました。

Git運用やコミットの切り方も見直し、保守性と拡張性を考えるようになりました。OSSのコードを読み、出会った開発手法を自分の制作へ反映しています。

![Diet Appの食事・ワークアウト履歴](./images/diet-history.png)

Clean ArchitectureやFeature-based設計など、構造から改善する取り組みを続けています。


<!-- page:review -->

## 利用者の動きを見て改善する

実際に人に使ってもらい、UIを修正しました。初めてGoogle Analyticsを使い、操作が止まる場所や、どの画面で離脱するかを見ながら改善を考えました。

見た目の好みだけでなく、使われ方を手がかりにUIを見直す経験になりました。

## 継続して品質を確かめる

作り直した実装には、PlaywrightのE2Eテストや単体・結合テスト、CI、ログ・例外監視を取り入れています。

[制作中の振り返りを読む（Qiita）](https://qiita.com/awashimakentaro/private/8feb5597d26ec907dc4b)


<!-- page:outcome -->

## UIを、改善できる品質として捉える

人に使ってもらい、操作や離脱を見て直す経験を通じて、UIは感覚だけでなく、観察して改善できるものだと気づきました。

## AIを使うために、基礎を身につける

アプリが動くことと、自分が理解していることは別でした。AIの出力を判断し、変更していくには、設計や実装の基礎が欠かせないと実感しました。

振り返りの記事を書いた時点では、AIに頼りすぎない小さなReactアプリづくりも始めています。理解して作る経験を積み重ね、このアプリの改善にもつなげていきたいです。


<!-- page:tools -->

## Web・モバイル

- Next.js / React — Web画面とAPI Routes
- TypeScript — 型を使った実装
- Expo / React Native — モバイルアプリ
- Expo Router — モバイルの画面遷移
- React Hook Form / Zod — フォームと入力検証
- SWR / Zustand — データ取得と状態管理

## データ・UI

- Supabase Auth — 認証
- PostgreSQL / Prisma — データ管理
- Tailwind CSS / Radix UI — 画面部品
- Framer Motion — UIアニメーション


<!-- page:tools-quality -->

## 品質と運用

- Google Analytics — 利用行動・離脱の確認
- Playwright — E2Eテスト
- GitHub Actions — CI
- Pino — 構造化ログ
- Sentry — 例外監視
- Git / GitHub — コード・変更の管理
- Xcode / EAS Build — モバイルのビルド
