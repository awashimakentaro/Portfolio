import type { BookManuscript } from '../../types';

export default {
  id: 'your-internship',
  title: '会社名を入力',
  category: 'internship',
  status: 'draft',
  links: {
    // demo: '実際のDemo URL',
    // github: '実際のGitHub URL',
  },
  pages: [
    { id: 'contents', file: './pages/01.md', layout: 'text', status: 'draft' },
    { id: 'about', file: './pages/02.md', layout: 'text', status: 'draft' },
    { id: 'responsibilities', file: './pages/03.md', layout: 'text', status: 'draft' },
    { id: 'work', file: './pages/04.md', layout: 'text', status: 'draft' },
    { id: 'decisions', file: './pages/05.md', layout: 'text', status: 'draft' },
    { id: 'outcome', file: './pages/06.md', layout: 'text', status: 'draft' },
    { id: 'reflection', file: './pages/07.md', layout: 'text', status: 'draft' },
  ],
} satisfies BookManuscript;
