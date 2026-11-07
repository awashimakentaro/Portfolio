'use client';

import { BOOK_RECOMMENDATIONS } from './data/recommendations';
import type { BookCategoryId, BookProject } from './data/projects';
import styles from './BookExperience.module.css';

export function BookRecommendations({ categoryId, books, selectedId, onSelect }: {
  categoryId: BookCategoryId;
  books: readonly BookProject[];
  selectedId?: string;
  onSelect: (book: BookProject) => void;
}) {
  const recommended = books.find(book => book.id === BOOK_RECOMMENDATIONS[categoryId] && book.category === categoryId);
  if (!recommended) return null;
  return <nav className={styles.recommendations} aria-label="このカテゴリのおすすめ">
    <button type="button" className={styles.recommendationButton} aria-label={`おすすめの本: ${recommended.title}`} aria-current={selectedId === recommended.id ? 'true' : undefined} title={recommended.title} onClick={() => onSelect(recommended)}>
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m10 2 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" stroke="currentColor" strokeWidth="1.2" /></svg>
      <span>おすすめ</span>
    </button>
  </nav>;
}
