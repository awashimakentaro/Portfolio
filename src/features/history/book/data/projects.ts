export type BookCategoryId = 'apps' | 'agents' | 'design' | 'internship';

export type BookProject = {
  id: string;
  title: string;
  category: BookCategoryId;
  cover: string;
  markdown: string;
  demoUrl?: string;
  githubUrl?: string;
  sample?: boolean;
};

// 本文は data/content/*.md に置く。未提供の外部リンクは登録しない。
export const BOOK_PROJECTS: readonly BookProject[] = [
  { id: 'pfc-tracker', title: 'PFC Tracker', category: 'apps', cover: '/book-covers/App.png', markdown: '/book-content/pfc-tracker.md' },
  { id: 'campus-qiita', title: 'Campus Qiita', category: 'apps', cover: '/book-covers/App.png', markdown: '/book-content/campus-qiita.md' },
  { id: 'kodo', title: 'Kodo', category: 'apps', cover: '/book-covers/App.png', markdown: '/book-content/kodo.md' },
  { id: 'engineer-learning', title: 'Engineer Learning', category: 'agents', cover: '/book-covers/Agent.png', markdown: '/book-content/engineer-learning.md' },
  { id: 'awashima-portfolio', title: 'Awashima Portfolio', category: 'design', cover: '/book-covers/design.png', markdown: '/book-content/awashima-portfolio.md' },
  { id: 'pr-times', title: 'PR TIMES', category: 'internship', cover: '/book-covers/internship.png', markdown: '/book-content/pr-times.md' },
  { id: 'hr-cloud', title: 'HR Cloud', category: 'internship', cover: '/book-covers/internship.png', markdown: '/book-content/hr-cloud.md' },
];

// 冊数と操作感を確認するための架空データ。公開実績ではない。
export const APP_SAMPLE_PROJECTS: readonly BookProject[] = Array.from({ length: 7 }, (_, index) => ({
  id: `sample-app-${index + 4}`, title: `Sample App ${String(index + 4).padStart(2, '0')}`,
  category: 'apps', cover: '/book-covers/App.png', markdown: '/book-content/sample-app.md', sample: true,
}));
