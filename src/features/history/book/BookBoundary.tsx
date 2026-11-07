'use client';
import { Component, useEffect, useState, type ReactNode } from 'react';
import type { BookLifecycleCallbacks } from '@/contracts/book';
import { parseBookDocument } from '@/lib/book-document.mjs';
import { BOOK_PROJECTS, type BookCategoryId } from './data/projects';
import styles from './BookExperience.module.css';
import { BookRecommendations } from './BookRecommendations';

export class BookBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** A GPU failure must release the scene lock, including pending navigation. */
export function BookFallback({ categoryId, empty = false, onStatusChange, onClosed }: BookLifecycleCallbacks & { categoryId: BookCategoryId; empty?: boolean }) {
  const books = BOOK_PROJECTS.filter(book => book.category === categoryId);
  const [selected, setSelected] = useState('');
  const [text, setText] = useState('');
  const [ready, setReady] = useState(false);
  const book = books.find(book => book.markdown === selected);
  let pages: ReturnType<typeof parseBookDocument> | null = null;
  if (ready && book?.format === 'fixed-pages') { try { pages = parseBookDocument(text); } catch { /* keep the recovery text readable */ } }
  useEffect(() => { onStatusChange?.('browsing'); onClosed?.(); }, [onStatusChange, onClosed]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setReady(false); setText('読み込み中…');
    fetch(selected, { signal: controller.signal }).then(response => { if (!response.ok) throw Error('load'); return response.text(); })
      .then(text => { if (!controller.signal.aborted) { setText(text); setReady(true); } }).catch(error => { if (error.name !== 'AbortError') setText('本文を読み込めませんでした。'); });
    return () => controller.abort();
  }, [selected]);
  return <div className={styles.fallback} role="region" aria-label="作品一覧">
    <p>{empty ? 'このカテゴリの作品は準備中です。' : '3D表示を利用できないため、作品一覧を表示しています。'}</p>
    {!selected && <BookRecommendations categoryId={categoryId} books={books} onSelect={book => setSelected(book.markdown)} />}
    {books.map(book => <div key={book.id}>
      <button onClick={() => setSelected(book.markdown)}>{book.title}</button>
      {book.demoUrl && <a href={book.demoUrl} target="_blank" rel="noopener noreferrer">Demo</a>}
      {book.githubUrl && <a href={book.githubUrl} target="_blank" rel="noopener noreferrer">GitHub</a>}
    </div>)}
    {selected && <div><button onClick={() => setSelected('')}>本文を閉じる</button>{pages ? pages.map(page => <section key={page.id} id={`fallback-${page.id}`}>
      {page.blocks.map((block, i) => block.type === 'heading' ? <h2 key={i}>{block.text}</h2> : block.type === 'image' ? <img key={i} src={block.src} alt={block.alt} style={{ maxWidth: '100%', maxHeight: 320, objectFit: 'contain' }} /> : block.action ? <p key={i}><a href={block.action.kind === 'page' ? `#fallback-${block.action.target}` : block.action.target} target={block.action.kind === 'url' ? '_blank' : undefined} rel="noopener noreferrer">{block.action.label}</a></p> : <p key={i}>{block.text}</p>)}
    </section>) : <p className={styles.fallbackText}>{text}</p>}</div>}
  </div>;
}
