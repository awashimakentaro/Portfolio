import type { BookManuscript } from '../../types';
export default {
  "id": "utd",
  "title": "UTD",
  "category": "apps",
  "status": "draft",
  "links": {
    "demo": "https://toilet-eta.vercel.app/",
    "github": "https://github.com/awashimakentaro/toilet"
  },
  "details": {
    "summary": "タスクをトイレに流す演出で完了する、遊び心のあるTODOアプリ",
    "period": "2025年1月"
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
      "file": "./pages/about.md",
      "layout": "image-text",
      "status": "draft"
    },
    {
      "id": "context",
      "file": "./pages/context.md",
      "layout": "text",
      "status": "draft"
    },
    {
      "id": "process",
      "file": "./pages/process.md",
      "layout": "text",
      "status": "draft"
    },
    {
      "id": "outcome",
      "file": "./pages/outcome.md",
      "layout": "text",
      "status": "draft"
    },
    {
      "id": "tools",
      "file": "./pages/tools.md",
      "layout": "text",
      "status": "draft"
    }
  ]
} satisfies BookManuscript;
