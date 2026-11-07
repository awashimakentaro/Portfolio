import type { BookCoverDesign } from '../../types';

export default {
  // カテゴリに合わせて App.png / Agent-v2.png / design.png / internship.png を選ぶ。
  binding: '../../../public/book-covers/design.png',
  // images/へ実画像を置いたら、次の行を有効にする。
  // image: { file: './images/cover-image.png', alt: '画像の説明' },
  titleTreatment: 'large',
  imageTreatment: 'large',
  status: 'draft',
} satisfies BookCoverDesign;
