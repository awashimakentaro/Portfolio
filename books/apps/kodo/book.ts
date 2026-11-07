import type { BookManuscript } from '../../types';
export default {
  "id": "kodo",
  "title": "Kodo",
  "category": "apps",
  "status": "draft",
  "links": {
    "demo": "https://kodo-plum.vercel.app/",
    "github": "https://github.com/awashimakentaro/kodo"
  },
  "details": {
    "summary": "日々の目標と振り返りを記録する、自分で設計・実装を学んだアプリ",
    "period": "2026年2月"
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
