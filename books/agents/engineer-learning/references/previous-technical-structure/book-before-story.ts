import type { BookManuscript } from '../../types';
export default {
  "id": "engineer-learning",
  "title": "Engineering Learning Agent",
  "category": "agents",
  "status": "draft",
  "links": {},
  "details": {
    "summary": "派生する疑問をツリーで管理し、理解を積み上げて元の問いへ戻るためのCodex用Skill"
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
      "file": "./pages/02-about.md",
      "layout": "text",
      "status": "draft"
    },
    {
      "id": "context",
      "file": "./pages/03-context.md",
      "layout": "text",
      "status": "draft"
    },
    {
      "id": "context-questions",
      "file": "./pages/03-context-questions.md",
      "layout": "text",
      "status": "draft"
    },
    {
      "id": "process",
      "file": "./pages/04-process.md",
      "layout": "statement",
      "status": "draft"
    },
    {
      "id": "review",
      "file": "./pages/05-review.md",
      "layout": "text",
      "status": "draft"
    },
    {
      "id": "outcome",
      "file": "./pages/06-outcome.md",
      "layout": "text",
      "status": "draft"
    },
    {
      "id": "tools",
      "file": "./pages/07-tools.md",
      "layout": "text",
      "status": "draft"
    }
  ]
} satisfies BookManuscript;
