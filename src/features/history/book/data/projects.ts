import catalog from './catalog.generated.json';

export type BookCategoryId = 'apps' | 'agents' | 'design' | 'internship';

export type BookProject = {
  id: string;
  title: string;
  category: BookCategoryId;
  cover: string;
  markdown: string;
  format?: 'fixed-pages';
  thumbnail?: string;
  thumbnailFit?: 'cover' | 'contain';
  thumbnailInset?: number;
  thumbnailBackground?: string;
  coverPeriod?: string;
  demoUrl?: string;
  githubUrl?: string;
};

// books/<category>/<id>/publication.ts と published.md が原本。npm run assetsで生成する。
export const BOOK_PROJECTS: readonly BookProject[] = catalog as BookProject[];
