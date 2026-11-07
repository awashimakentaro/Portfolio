import type { BookManuscript } from '../../types';

export default {
  "id": "kodo",
  "title": "Kodo",
  "category": "apps",
  "status": "draft",
  "links": {},
  "pages": [
    {
      "id": "page-01",
      "file": "./pages/01.md",
      "layout": "text",
      "status": "draft"
    }
  ]
} satisfies BookManuscript;
