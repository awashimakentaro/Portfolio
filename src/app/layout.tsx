import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '淡嶋健太朗 — Portfolio', description: 'Awashima Kentaro — ソフトウェアエンジニア / UI・UXデザイン' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
