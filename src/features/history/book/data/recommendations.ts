import type { BookCategoryId } from './projects';

/** Curated by the portfolio owner; keep stable IDs rather than carousel positions. */
export const BOOK_RECOMMENDATIONS = {
  apps: 'pfc-tracker',
  agents: 'engineer-learning',
  design: 'awashima-portfolio',
  internship: 'hr-cloud',
} as const satisfies Record<BookCategoryId, string>;
