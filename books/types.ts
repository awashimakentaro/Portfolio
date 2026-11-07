/** 制作用のデータ契約。制作原稿と明示的な公開スナップショットを分ける。 */
export type ManuscriptStatus = 'draft' | 'ready';
export type AuthoringCategory = 'apps' | 'agents' | 'design' | 'internship';
export type PageLayout = 'text' | 'image-text' | 'statement' | 'process';
export type PagePresentation = {
  section?: string;
  callout?: string;
  facts?: readonly { label: string; value: string }[];
};

export type BookManuscript = {
  id: string;
  title: string;
  category: AuthoringCategory;
  status: ManuscriptStatus;
  links: { demo?: string; github?: string };
  /** 確認できた基本情報だけを登録。空欄や未確認値を埋めない。 */
  details?: { summary?: string; period?: string; role?: string; company?: string };
  /** 本文の順序。fileは作品フォルダからの相対パス。表紙は含めない。 */
  pages: readonly {
    id: string;
    file: string;
    layout: PageLayout;
    status: ManuscriptStatus;
    presentation?: PagePresentation;
  }[];
};

export type BookCoverDesign = {
  /** パスは作品フォルダからの相対パス。共有装丁の原本は変更しない。 */
  binding: string;
  image?: { file: string; alt: string; fit?: 'cover' | 'contain'; inset?: number; background?: string };
  titleTreatment: 'large';
  imageTreatment: 'small' | 'large';
  status: ManuscriptStatus;
};

/** 本番専用。制作中のbook.ts・表紙・ページから独立した公開契約。 */
export type BookPublication = {
  id: string;
  title: string;
  category: AuthoringCategory;
  file: './published.md';
  format?: 'fixed-pages';
  thumbnail?: string;
  thumbnailFit?: 'cover' | 'contain';
  thumbnailInset?: number;
  thumbnailBackground?: string;
  /** 表紙右下の制作・在籍時期。全カテゴリ共通。 */
  coverPeriod?: string;
  cover: string;
  order: number;
  links?: { demo?: string; github?: string };
};
