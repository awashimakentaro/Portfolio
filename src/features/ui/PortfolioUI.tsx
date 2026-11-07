'use client';

import { useCallback, useState, type RefObject } from 'react';
import dynamic from 'next/dynamic';
import type { BookCategoryId } from '../history/book/data/projects';
import type { BookPublicState } from '@/contracts/book';
import { sceneIds, sceneLabels, type FrameMotion, type SceneId } from '../../contracts/scene';
import styles from './PortfolioUI.module.css';

const BookExperience = dynamic(
  () => import('../history/book/BookExperience').then((module) => module.BookExperience),
  { ssr: false, loading: () => <p className={styles.bookLoading}>本を読み込んでいます…</p> },
);

const categories = [
  { id: 'apps', label: 'Apps' },
  { id: 'agents', label: 'Agents' },
  { id: 'design', label: 'Design' },
  { id: 'internship', label: 'Internship' },
] as const;

type PortfolioUIProps = {
  prepareBooks?: boolean;
  transitionPending?: boolean;
  scene: SceneId;
  onNavigate: (scene: SceneId) => void;
  onBookStatusChange?: (status: BookPublicState) => void;
  closeRequest?: number;
  onBookClosed?: () => void;
  motionRef?: RefObject<FrameMotion>;
};

export function PortfolioUI({ scene, onNavigate, onBookStatusChange, closeRequest, onBookClosed, motionRef, transitionPending = false, prepareBooks = false }: PortfolioUIProps) {
  const [categoryId, setCategoryId] = useState<BookCategoryId>('apps');
  const [bookStatus, setBookStatus] = useState<BookPublicState>('browsing');
  const reportBookStatus = useCallback((status: BookPublicState) => {
    setBookStatus(status);
    onBookStatusChange?.(status);
  }, [onBookStatusChange]);

  return (
    <div className={styles.overlay} data-ui-scene={scene}>
      <header className={styles.header}>
        <button className={styles.logo} onClick={() => onNavigate('profile')} aria-label="AK — Profileへ">
          AK
        </button>
        <nav className={styles.navigation} aria-label="メインナビゲーション">
          {sceneIds.map((id) => (
            <button
              key={id}
              className={styles.navItem}
              aria-current={scene === id ? 'page' : undefined}
              onClick={() => onNavigate(id)}
            >
              {sceneLabels[id]}
            </button>
          ))}
        </nav>
      </header>

      {scene !== 'history' && <section key={scene} className={`${styles.scene} ${styles[scene]}`} aria-labelledby={`${scene}-title`} inert={transitionPending} data-leaving={transitionPending}>
        {scene === 'profile' && (
          <>
            <div className={styles.profileContent}>
              <div className={styles.profileDetails}>
                <div className={styles.profileIdentity}>
                  <p className={styles.smallLabel}>名前</p>
                  <h1 id="profile-title" className={styles.name} lang="ja">淡嶋健太朗</h1>
                  <p className={styles.englishName} lang="en">Awashima Kentaro</p>
                </div>
                <div className={styles.roles}>
                  <p className={styles.smallLabel}>希望職種</p>
                  <p>ソフトウェアエンジニア</p>
                  <p>UI/UXデザイナー</p>
                </div>
              </div>
            </div>
          </>
        )}
        {scene === 'about' && (
          <div className={styles.textColumn}>
            <h1 id="about-title" className={styles.heading}><span className={styles.titleInk}>About Me</span></h1>
            <div className={styles.biography}>
              <p>会津大学でコンピュータサイエンスを学んでいます。</p>
              <p>趣味は筋トレとものづくり。将来は、エンジニアリングの知識を持ち、技術とデザインの両面から価値を生み出せるデザイナーを目指しています。</p>
              <p>技術の魅力は、頭の中にあるアイデアを実際に形にできること。</p>
              <p>そしてデザインの魅力は、論理的な視点だけでなく、遊び心や一見カオスな発想からも、人の喜びや驚きを生み出せることだと考えています。</p>
              <p>自分のつくったものが誰かの笑顔につながる。そんな瞬間を大切にしながら、自由な発想と技術を掛け合わせたものづくりを続けていきたいです。</p>
            </div>
            <dl className={styles.facts}>
              <div><dt>大学</dt><dd>会津大学</dd></div>
              <div><dt>趣味</dt><dd>筋トレ・ものづくり</dd></div>
              <div><dt>目標</dt><dd>エンジニアリングの知識を持つデザイナー</dd></div>
            </dl>
          </div>
        )}
        {scene === 'contact' && (
          <div className={styles.textColumn}>
            <h1 id="contact-title" className={styles.heading}><span className={styles.titleInk}>Contact</span></h1>
            <p className={styles.contactIntro}>ちょっとしたご質問や、ご挨拶も。<br />お気軽にご連絡いただけるとうれしいです。</p>
            <div className={styles.contactLinks}>
              <a href="https://mail.google.com/mail/?view=cm&fs=1&to=awashimanman%40gmail.com" target="_blank" rel="noopener noreferrer" className={styles.contactLink} aria-label="Gmailでメールを書く（新しいタブ）">
                <span className={styles.contactIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 6 8 7 8-7" /></svg></span>
                <span className={styles.linkCopy}><span className={styles.linkLabel}>Gmailでメールを書く</span><span className={styles.linkValue}>awashimanman@gmail.com</span></span>
                <span className={styles.arrow} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M7 7h10v10" /></svg></span>
              </a>
              <a href="https://github.com/awashimakentaro" target="_blank" rel="noopener noreferrer" className={styles.contactLink} aria-label="GitHubを見る（新しいタブ）">
                <span className={styles.contactIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.76-.24.76-.54v-2.1c-3.12.68-3.78-1.32-3.78-1.32-.51-1.3-1.25-1.64-1.25-1.64-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.49-.28-5.1-1.24-5.1-5.54 0-1.23.44-2.23 1.15-3.01-.12-.29-.5-1.43.11-2.97 0 0 .94-.3 3.08 1.15a10.72 10.72 0 0 1 5.6 0c2.14-1.45 3.08-1.15 3.08-1.15.61 1.54.23 2.68.11 2.97a4.33 4.33 0 0 1 1.15 3.01c0 4.31-2.62 5.25-5.12 5.53.4.35.76 1.03.76 2.08v3.19c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z" /></svg></span>
                <span className={styles.linkCopy}><span className={styles.linkLabel}>GitHubを見る</span><span className={styles.linkValue}>@awashimakentaro</span></span>
                <span className={styles.arrow} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M7 7h10v10" /></svg></span>
              </a>
            </div>
          </div>
        )}
      </section>}

      <section
        className={`${styles.scene} ${styles.history} ${scene !== 'history' ? styles.inactive : ''}`}
        aria-labelledby="history-title"
        aria-hidden={scene !== 'history'}
        inert={scene !== 'history' || transitionPending}
        data-leaving={scene === 'history' && transitionPending}
        data-book-focus={scene === 'history' && bookStatus !== 'browsing'}
      >
        <div className={styles.historyContent} data-book-focus={scene === 'history' && bookStatus !== 'browsing'}>
          <div key={scene === 'history' ? 'history-visible' : 'history-hidden'} className={styles.historyIntro} inert={bookStatus !== 'browsing'}>
            <h1 id="history-title" className={styles.heading}><span className={styles.titleInk}>History</span></h1>
            <div className={styles.categoryBar} role="group" aria-label="作品カテゴリ">
              {categories.map((item) => (
                <button
                  key={item.id}
                  className={styles.category}
                  aria-pressed={categoryId === item.id}
                  disabled={bookStatus !== 'browsing'}
                  onClick={() => setCategoryId(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.bookViewport}>
            <BookExperience
              categoryId={categoryId}
              prepare={prepareBooks}
              active={scene === 'history'}
              onStatusChange={reportBookStatus}
              closeRequest={closeRequest}
              onClosed={onBookClosed}
              motionRef={motionRef}
            />
          </div>
        </div>
      </section>

    </div>
  );
}
