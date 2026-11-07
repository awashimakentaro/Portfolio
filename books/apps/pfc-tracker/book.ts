import type { BookManuscript } from '../../types';
export default {
  "id": "pfc-tracker",
  "title": "Diet App",
  "category": "apps",
  "status": "draft",
  "links": {
    "demo": "https://diet-phi-bay.vercel.app/",
    "github": "https://github.com/awashimakentaro/diet"
  },
  "details": {
    "summary": "いつもの食事をワンタップで記録し、画像・AI入力でPFC管理の手間を減らす食事管理アプリ",
    "period": "2026年3月〜2026年4月"
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
      "layout": "image-text",
      "status": "draft"
    },
    {
      "id": "process-structure",
      "file": "./pages/process-structure.md",
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
    },
    {
      "id": "tools-quality",
      "file": "./pages/tools-quality.md",
      "layout": "text",
      "status": "draft"
    }
  ]
} satisfies BookManuscript;
