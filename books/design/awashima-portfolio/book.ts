import type { BookManuscript } from '../../types';
export default {
  "id": "awashima-portfolio",
  "title": "Awashima Portfolio",
  "category": "design",
  "status": "draft",
  "links": {
    "demo": "https://portfolio-silk-two-49.vercel.app",
    "github": "https://github.com/awashimakentaro/Portfolio"
  },
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
      "layout": "image-text",
      "status": "draft"
    },
    {
      "id": "context",
      "file": "./pages/03.md",
      "layout": "image-text",
      "status": "draft"
    },
    {
      "id": "process",
      "file": "./pages/04.md",
      "layout": "text",
      "status": "draft"
    },
    {
      "id": "process-after",
      "file": "./pages/15-process-after.md",
      "layout": "text",
      "status": "draft"
    },
    {
      "id": "review",
      "file": "./pages/05.md",
      "layout": "text",
      "status": "draft"
    },
    {
      "id": "outcome",
      "file": "./pages/06.md",
      "layout": "text",
      "status": "draft"
    },
    {
      "id": "tools",
      "file": "./pages/07.md",
      "layout": "text",
      "status": "draft"
    }
  ],
  "details": {
    "period": "2026年10月〜現在"
  }
} satisfies BookManuscript;
