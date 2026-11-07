import type { BookManuscript } from '../../types';
export default {
  "id": "presence-note",
  "title": "Presence-Note",
  "category": "apps",
  "status": "draft",
  "links": {
    "demo": "https://www.youtube.com/shorts/9xW-BIbZ5RM",
    "github": "https://github.com/awashimakentaro/Presence-Note"
  },
  "details": {
    "summary": "スマホから送った思いを、相手の操作なしに紙へ届けるIoTギフト",
    "period": "2025年12月"
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
      "id": "process-paper",
      "file": "./pages/process-paper.md",
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
