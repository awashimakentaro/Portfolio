import type { BookManuscript } from '../../types';
export default {
  "id": "campus-qiita",
  "title": "Campus Qiita",
  "category": "apps",
  "status": "draft",
  "links": {
    "demo": "https://campus-qiita-frontend.vercel.app/",
    "github": "https://github.com/awashimakentaro/campus-qiita-frontend"
  },
  "details": {
    "summary": "大学生・教職員向けに技術記事を共有するWebアプリ",
    "period": "2025年8月"
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
      "id": "review",
      "file": "./pages/review.md",
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
