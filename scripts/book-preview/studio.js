import { COVER_WINDOW, COVER_SOURCE, chapterHeaders, repeatsChapterHeading, COVER_COPY, LINK_ICONS, coverPeriodLabel, COVER_DATE } from '/book-layout.mjs';
const $ = (id) => document.getElementById(id);
const state = { books: [], listErrors: [], book: null, folder: new URL(location.href).searchParams.get('folder') || '', view: new URL(location.href).searchParams.get('view') === 'pages' ? 'spread' : 'cover', page: 0, single: matchMedia('(max-width:800px)').matches, request: 0, polling: false, lastList: 0, pageWarnings: [], imageWarnings: [], overflowFrame: 0 };
const categoryNames = { apps: 'Apps', agents: 'Agents', design: 'Design', internship: 'Internship' };
let resizeObserver;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function sync(text, kind = 'ready') { $('sync').textContent = text; $('sync').dataset.state = kind; }
function showError(message) { $('error').textContent = message; $('error').hidden = !message; }
async function getJSON(path) {
  const response = await fetch(path, { cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || body.message || `読み込みに失敗しました (${response.status})`);
  return body;
}
function externalURL(value) {
  try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : null; } catch { return null; }
}
function showWarnings() {
  const messages = [...(state.book?.warnings || []), ...state.listErrors.map((entry) => `${entry.folder}: ${entry.message}`), ...state.pageWarnings, ...state.imageWarnings];
  const nodes = [...new Set(messages)].map((message) => el('div', 'notice', message));
  $('warnings').replaceChildren(...nodes);
}
function reportImageFailure(label) {
  if (!state.imageWarnings.includes(label)) state.imageWarnings.push(label);
  showWarnings();
}
function image(url, alt, onFailure) {
  const node = el('img'); node.src = url; node.alt = alt || ''; node.decoding = 'async';
  node.addEventListener('load', scheduleOverflow, { once: true });
  node.addEventListener('error', () => { reportImageFailure(`画像を表示できません: ${alt || url}`); onFailure?.(); }, { once: true });
  return node;
}
function statusLabel(status) { return status === 'ready' ? '確認済み' : '下書き'; }
function columns() { return state.single ? 1 : 2; }
function offset() { return !state.single && state.book?.pages[0]?.id === 'contents' ? 1 : 0; }
function count() { return Math.ceil(((state.book?.pages.length || 0) + offset()) / columns()); }
function startPage() { return Math.floor((state.page + offset()) / columns()) * columns() - offset(); }
function setView(view, page = state.page) {
  state.view = view;
  state.page = Math.max(0, Math.min(page, Math.max(0, (state.book?.pages.length || 0) - 1)));
  render();
}
function move(direction) {
  if (!state.book) return;
  if (state.view === 'cover') { if (direction > 0 && count()) setView('spread', 0); return; }
  const next = startPage() + direction * columns();
  if (next < 0) setView('cover');
  else if (next < state.book.pages.length) setView('spread', next);
}
function contentButton(label, subtitle, selected, symbol, action) {
  const button = el('button', 'content-button'); button.type = 'button';
  if (selected) button.setAttribute('aria-current', 'page');
  const mark = el('span', `content-symbol${symbol === 'spread' ? ' spread-symbol' : ''}`, symbol === 'spread' ? '' : 'B'); mark.setAttribute('aria-hidden', 'true');
  const copy = el('span', 'content-copy', label); copy.append(el('small', '', subtitle));
  button.append(mark, copy); button.addEventListener('click', action); return button;
}
function renderContents() {
  if (!state.book) return;
  const nodes = [contentButton('表紙', statusLabel(state.book.cover.status), state.view === 'cover', 'cover', () => setView('cover'))];
  const options = [el('option', '', '表紙')]; options[0].value = 'cover';
  const active = Math.floor((state.page + offset()) / columns());
  const first = Math.max(0, Math.min(active - 2, count() - 5));
  for (let i = 0; i < count(); i++) {
    const left = i * columns() + 1 - offset(), right = Math.min(left + columns() - 1, state.book.pages.length);
    const label = state.single ? String(left).padStart(2, '0') : `${left === 0 ? '空白' : String(left).padStart(2, '0')} / ${right === left ? '空白' : String(right).padStart(2, '0')}`;
    const option = el('option', '', `${state.single ? 'ページ' : '見開き'} ${label}`); option.value = String(Math.max(0, left - 1)); options.push(option);
    if (i >= first && i < first + 5) nodes.push(contentButton(label, state.single ? `${left}ページ` : `見開き ${i + 1}`, state.view === 'spread' && active === i, 'spread', () => setView('spread', left - 1)));
  }
  $('contents').replaceChildren(...nodes);
  $('page-select').replaceChildren(...options);
  $('page-select').value = state.view === 'cover' ? 'cover' : String(Math.max(0, startPage()));
}

function fitPreview() {
  const canvas = $('canvas'), style = getComputedStyle(canvas);
  const width = canvas.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const height = canvas.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const spread = canvas.querySelector('.spread'), cover = canvas.querySelector('.cover-board');
  if (spread) {
    const pageWidth = Math.max(1, Math.min(width / columns(), height * 768 / 1080));
    spread.style.width = `${Math.floor(pageWidth * columns())}px`;
  }
  if (cover) cover.style.width = `${Math.max(1, Math.floor(Math.min(width, height * 1122 / 1402, 620)))}px`;
}
function renderCover() {
  const book = state.book;
  const board = el('div', 'cover-board'); board.dataset.imageTreatment = book.cover.imageTreatment; board.setAttribute('aria-label', `${book.title}の表紙`);
  const binding = image(book.cover.bindingUrl, '黒い本の装丁', () => { board.prepend(el('div', 'image-failure', '装丁画像を読み込めません')); }); binding.className = 'cover-binding'; board.append(binding);
  if (book.cover.image) {
    const picture = el('div', 'cover-picture');
    picture.dataset.fit = book.cover.image.fit;
    picture.style.setProperty('--cover-inset', `${book.cover.image.inset * 100}%`);
    picture.style.backgroundColor = book.cover.image.background;
    Object.assign(picture.style, {
      left: `${COVER_WINDOW.x / COVER_SOURCE.width * 100}%`, top: `${COVER_WINDOW.y / COVER_SOURCE.height * 100}%`,
      width: `${COVER_WINDOW.width / COVER_SOURCE.width * 100}%`, height: `${COVER_WINDOW.height / COVER_SOURCE.height * 100}%`,
    });
    picture.append(image(book.cover.image.url, book.cover.image.alt, () => picture.append(el('span', 'image-failure', '画像を読み込めません')))); board.append(picture);
  }
  const hasPeriod = book.category === 'internship' && book.details?.period;
  const words = book.title.trim().split(/\s+/);
  const title = el('div', `cover-title${words.length === 1 ? ' single' : ''}${hasPeriod ? ' with-period' : ''}${!book.cover.image ? ' text-only' : ''}`);
  if (hasPeriod || !book.cover.image) title.append(el('strong', 'title-main', book.title));
  else {
    if (words.length > 1) title.append(el('span', 'title-first', words.slice(0, -1).join(' ')));
    title.append(el('strong', 'title-main', words.at(-1) || book.title));
  }
  title.style.top = `${(hasPeriod ? .565 : book.cover.image ? COVER_COPY.studioTitleY : COVER_COPY.studioTextOnlyTitleY) * 100}%`; board.append(title);
  if (book.details?.period) {
    const period = el('div', 'cover-period');
    period.setAttribute('aria-label', `${book.category === 'internship' ? '在籍期間' : '制作時期'} ${book.details.period}`);
    const dates = el('span', 'period-dates', coverPeriodLabel(book.details.period));
    period.append(dates);
    Object.assign(period.style, {
      right: `${(1 - COVER_DATE.x / COVER_SOURCE.width) * 100}%`,
      bottom: `${(1 - COVER_DATE.y / COVER_SOURCE.height) * 100}%`,
      maxWidth: `${COVER_DATE.maxWidth / COVER_SOURCE.width * 100}%`,
    });
    board.append(period);
  }
  const links = el('div', 'cover-project-links'); links.style.top = `${COVER_COPY.linksY * 100 - 4}%`;
  for (const [key, label] of [['demo', 'Demo ↗'], ['github', 'GitHub ↗']]) {
    const url=externalURL(book.links[key]); if (!url) continue; const a=el('a','');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',LINK_ICONS[key].path);path.setAttribute('fill',LINK_ICONS[key].fill?'currentColor':'none');path.setAttribute('stroke',LINK_ICONS[key].fill?'none':'currentColor');path.setAttribute('stroke-width','1.5');svg.append(path);a.append(svg,document.createTextNode(label.replace(' ↗','')));a.href=url; a.target='_blank'; a.rel='noopener noreferrer'; links.append(a);
  }
  board.append(links);
  return board;
}
function inline(node, value) {
  const source = String(value ?? '');
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    node.append(document.createTextNode(source.slice(cursor, match.index)));
    node.append(el(match[1] ? 'strong' : 'code', '', match[1] ?? match[2]));
    cursor = match.index + match[0].length;
  }
  node.append(document.createTextNode(source.slice(cursor)));
  return node;
}
function paper(page, number) {
  let chapterHeader;
  const node = el('article', `paper${!page ? ' blank' : ''}`); node.setAttribute('aria-label', page ? `本文 ${number}ページ` : '空白ページ');
  if (page) {
    node.dataset.layout = page.layout;
    const running = el('div', 'paper-running');
    const entries = state.book.pages.flatMap(item => item.blocks.filter(block => block.type === 'action' && block.kind === 'page').map(block => ({ kind: 'page', label: block.label, target: block.target })));
    const headers = chapterHeaders(state.book.pages.map(item => item.id), entries);
    chapterHeader=headers[state.book.pages.indexOf(page)] || page.presentation?.section || state.book.title;
    running.append(el('span', '', chapterHeader));
    node.append(running);
  }
  const content = el('div', 'paper-content');
  if (!page) content.append(el('span', '', '空白ページ'));
  else for (const block of page.blocks) {
    switch (block.type) {
      case 'heading': if (repeatsChapterHeading(block.text, chapterHeader)) break; content.append(inline(el(`h${Math.max(2, Math.min(6, block.level + 1))}`), block.text)); break;
      case 'paragraph': content.append(inline(el('p'), block.text)); break;
      case 'quote': content.append(inline(el('blockquote'), block.text)); break;
      case 'list': {
        const list = el(block.ordered ? 'ol' : 'ul');
        for (const item of block.items) list.append(inline(el('li'), item));
        content.append(list); break;
      }
      case 'action': {
        const action = el(block.kind === 'page' ? 'button' : 'a', 'paper-action', block.label + (block.kind === 'page' ? '　→' : '　↗'));
        if (block.kind === 'page') action.addEventListener('click', () => setView('spread', state.book.pages.findIndex(page => page.id === block.target)));
        else { action.href = externalURL(block.target); action.target = '_blank'; action.rel = 'noopener noreferrer'; }
        content.append(action); break;
      }
      case 'image': {
        const figure = el('figure'); figure.append(image(block.url, block.alt));
        content.append(figure); break;
      }
      case 'rule': content.append(el('hr')); break;
    }
  }
  if (page?.presentation?.facts?.length) {
    const facts = el('dl', 'paper-facts');
    for (const fact of page.presentation.facts) {
      const pair = el('div'); pair.append(el('dt', '', fact.label), el('dd', '', fact.value)); facts.append(pair);
    }
    content.append(facts);
  }
  if (page?.presentation?.callout) content.append(inline(el('aside', 'paper-callout'), page.presentation.callout));
  node.append(content);
  if (page) {
    content.dataset.page = String(number);
    node.append(el('span', 'paper-meta', `${page.file.replace(/^\.\//, '')} · ${statusLabel(page.status)}`));
  }
  return node;
}
function render() {
  if (!state.book) return;
  resizeObserver?.disconnect();
  state.pageWarnings = []; state.imageWarnings = [];
  const book = state.book;
  $('book-title').textContent = book.title;
  document.title = `${book.title} — Book Studio`;
  $('book-category').textContent = categoryNames[book.category] || book.category;
  $('book-status').hidden = false; $('book-status').textContent = statusLabel(book.status); $('book-status').className = `badge ${book.status === 'ready' ? 'ready' : ''}`;
  $('page-total').textContent = `${book.pages.length} PAGES`;
  $('cover-tab').setAttribute('aria-pressed', String(state.view === 'cover'));
  $('spread-tab').setAttribute('aria-pressed', String(state.view === 'spread')); $('spread-tab').disabled = !count();
  $('spread-tab').textContent = state.single ? '本文' : '見開き';
  const links = [];
  for (const [key, label] of [['demo', 'Demo'], ['github', 'GitHub']]) {
    const url = externalURL(book.links[key]); if (!url) continue;
    const anchor = el('a', '', label); anchor.href = url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.append(el('span', '', '↗')); anchor.setAttribute('aria-label', `${label}を新しいタブで開く`); links.push(anchor);
  }
  $('project-links').replaceChildren(...links);
  renderContents();
  if (state.view === 'cover') {
    $('canvas').replaceChildren(renderCover());
    resizeObserver = new ResizeObserver(scheduleOverflow);
    resizeObserver.observe(document.querySelector('.cover-board'));
    $('current-label').textContent = '表紙'; $('source-path').textContent = `books/${book.folder}/cover.ts`;
    $('position').textContent = 'COVER';
  } else {
    const spread = el('div', `spread${state.single ? ' single-page' : ''}`);
    const start = startPage();
    for (let i = 0; i < columns(); i++) spread.append(paper(book.pages[start + i], start + i + 1));
    $('canvas').replaceChildren(spread);
    $('current-label').textContent = state.single ? `${start + 1}ページ` : `見開き ${Math.floor((start + offset()) / 2) + 1}`;
    $('source-path').textContent = `books/${book.folder}/pages/`;
    $('position').textContent = `${String(Math.floor((start + offset()) / columns()) + 1).padStart(2, '0')} / ${String(count()).padStart(2, '0')}`;
    resizeObserver = new ResizeObserver(scheduleOverflow);
    document.querySelectorAll('.paper-content').forEach((node) => resizeObserver.observe(node));
  }
  $('previous').disabled = state.view === 'cover';
  $('next').disabled = !count() || (state.view === 'spread' && startPage() + columns() >= book.pages.length);
  $('previous').setAttribute('aria-label', state.single ? '前のページ' : '前の見開き');
  $('next').setAttribute('aria-label', state.single ? '次のページ' : '次の見開き');
  $('canvas').setAttribute('aria-busy', 'false');
  fitPreview(); showWarnings(); scheduleOverflow();
}
function scheduleOverflow() {
  cancelAnimationFrame(state.overflowFrame);
  state.overflowFrame = requestAnimationFrame(() => {
    state.pageWarnings = [];
    document.querySelectorAll('.paper-content[data-page]').forEach((content) => {
      const overflowing = content.scrollHeight > content.clientHeight + 2 || content.scrollWidth > content.clientWidth + 2;
      const paper = content.closest('.paper'); paper.querySelector('.overflow-tag')?.remove();
      paper.classList.toggle('is-overflowing', overflowing);
      if (overflowing) {
        paper.append(el('span', 'overflow-tag', 'この紙面は長すぎます。原稿を整理するか、ページを分けてください。'));
        state.pageWarnings.push(`${content.dataset.page}ページ: 内容が紙面に収まりません。文章を整理するかページを追加してください。`);
      }
    });
    const board = document.querySelector('.cover-board');
    const title = document.querySelector('.cover-title');
    if (board && title) {
      const boardBounds = board.getBoundingClientRect(), titleBounds = title.getBoundingClientRect();
      if (title.scrollWidth > title.clientWidth + 2 || titleBounds.bottom > boardBounds.top + boardBounds.height * .91) {
        state.pageWarnings.push('表紙: 作品名が装丁に収まりません。改行や表紙のレイアウトを調整してください。');
      }
    }
    showWarnings();
  });
}
async function loadList() {
  const payload = await getJSON('/api/books'); state.books = payload.books; state.listErrors = payload.errors || []; state.lastList = Date.now();
  const selector = $('book-select');
  selector.replaceChildren(...state.books.map((book) => {
    const option = el('option', '', `${book.category} / ${book.title}`); option.value = book.folder; return option;
  }));
  if (state.books.some((book) => book.folder === state.folder)) selector.value = state.folder;
  else if (state.books.length) {
    const option = el('option', '', `${state.folder || '選択中の本'}（読み込み不可）`); option.value = state.folder; selector.prepend(option); selector.value = state.folder;
  }
  showWarnings();
}
async function loadBook(folder, { initial = false } = {}) {
  const request = ++state.request;
  sync('読み込み中', 'busy'); $('reload').disabled = true;
  try {
    const payload = await getJSON(`/api/book?folder=${encodeURIComponent(folder)}`);
    if (request !== state.request) return;
    state.book = payload; state.folder = payload.folder; folder = payload.folder;
    state.page = Math.min(state.page, Math.max(0, payload.pages.length - 1));
    const url = new URL(location.href); url.searchParams.set('folder', folder); history.replaceState(null, '', url);
    $('book-select').value = folder;
    showError(''); render(); sync('保存内容を反映済み');
  } catch (error) {
    if (request !== state.request) return;
    showError(error.message); sync('更新を待っています', 'error');
    if (initial && !state.book) { $('canvas').replaceChildren(el('p', 'empty-state', '原稿を読み込めません。ファイルを修正すると再接続します。')); $('canvas').setAttribute('aria-busy', 'false'); }
  } finally { if (request === state.request) $('reload').disabled = false; }
}
async function refresh() {
  try {
    await loadList();
    if (!state.folder) state.folder = state.books[0]?.folder || '';
    if (state.folder) await loadBook(state.folder, { initial: true });
    else { showError('制作する本がありません。books/_templates/を複製してください。'); sync('原稿を待っています', 'error'); $('canvas').setAttribute('aria-busy', 'false'); }
  } catch (error) { showError(error.message); sync('接続を待っています', 'error'); }
}
async function poll() {
  if (document.hidden || state.polling || $('reload').disabled) return;
  state.polling = true;
  try {
    if (!state.folder || Date.now() - state.lastList > 10000) {
      await loadList();
      if (!state.folder && state.books.length) { state.folder = state.books[0].folder; await loadBook(state.folder, { initial: true }); }
    }
    if (!state.folder) return;
    const { revision } = await getJSON(`/api/revision?folder=${encodeURIComponent(state.folder)}`);
    if (revision !== state.book?.revision || !$('error').hidden) {
      await loadList();
      await loadBook(state.folder, { initial: !state.book });
    }
    else sync('保存内容を反映済み');
  } catch (error) { showError(error.message); sync('接続を待っています', 'error'); }
  finally { state.polling = false; }
}
$('book-select').addEventListener('change', (event) => {
  state.folder = event.target.value; state.view = 'cover'; state.page = 0; void loadBook(state.folder, { initial: !state.book });
});
$('cover-tab').addEventListener('click', () => setView('cover'));
$('spread-tab').addEventListener('click', () => setView('spread'));
$('page-select').addEventListener('change', (event) => {
  if (event.target.value === 'cover') setView('cover');
  else setView('spread', Number(event.target.value));
});
$('previous').addEventListener('click', () => move(-1)); $('next').addEventListener('click', () => move(1));
$('reload').addEventListener('click', () => void refresh());
document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest('select,input,textarea,[contenteditable="true"]')) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) void poll(); });
const canvasObserver = new ResizeObserver(() => { fitPreview(); scheduleOverflow(); });
canvasObserver.observe($('canvas'));
window.addEventListener('resize', () => {
  const single = matchMedia('(max-width:800px)').matches;
  if (single !== state.single) { state.single = single; render(); }
  else { fitPreview(); scheduleOverflow(); }
});
setInterval(() => void poll(), 1500);
void refresh();
