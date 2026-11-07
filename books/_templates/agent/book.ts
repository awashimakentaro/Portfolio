import type { BookManuscript } from '../../types';
export default {
  "id": "your-agent",
  "title": "エージェント名を入力",
  "category": "agents",
  "status": "draft",
  "links": {},
  "pages": [
    {
      "id": "contents",
      "file": "./pages/01.md",
      "layout": "text",
      "status": "draft"
    },
    {
      "id": "about",
      "file": "./pages/02.md",
      "layout": "text",
      "status": "draft"
    },
    {
      "id": "context",
      "file": "./pages/03.md",
      "layout": "text",
      "status": "draft"
    },
    {
      "id": "review",
      "file": "./pages/04.md",
      "layout": "text",
      "status": "draft"
    },
    {
      "id": "outcome",
      "file": "./pages/05.md",
      "layout": "text",
      "status": "draft"
    }
  ]
} satisfies BookManuscript;
