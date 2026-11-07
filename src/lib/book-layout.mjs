// Inner edge of the white window in all four supplied 1122 x 1402 cover PNGs.
// Positions are in the original artwork, before its transparent margins are cropped.
export const COVER_WINDOW = Object.freeze({ x: 239, y: 199, width: 699, height: 497 });
export const COVER_SOURCE = Object.freeze({ width: 1122, height: 1402 });

/** Map the original white window into the alpha-cropped texture without guessing percentages. */
export function coverWindowRect(crop, outputWidth, outputHeight) {
  return {
    x: (COVER_WINDOW.x - crop.left) / crop.width * outputWidth,
    y: (COVER_WINDOW.y - crop.top) / crop.height * outputHeight,
    width: COVER_WINDOW.width / crop.width * outputWidth,
    height: COVER_WINDOW.height / crop.height * outputHeight,
  };
}

/** Fill the fixed window with a central crop; never stretch or letterbox a photograph. */
export function coverCrop(imageWidth, imageHeight, windowWidth, windowHeight) {
  const scale = Math.max(windowWidth / imageWidth, windowHeight / imageHeight);
  const width = Math.min(imageWidth, windowWidth / scale), height = Math.min(imageHeight, windowHeight / scale);
  return { x: (imageWidth - width) / 2, y: (imageHeight - height) / 2, width, height };
}

/** Keep a complete logo inside the shared window, with a configurable safe margin (8% for logos by default). */
export function coverContainRect(imageWidth, imageHeight, windowWidth, windowHeight, inset = .08) {
  const available = 1 - 2 * inset;
  const scale = Math.min(windowWidth * available / imageWidth, windowHeight * available / imageHeight);
  const width = imageWidth * scale, height = imageHeight * scale;
  return { x: (windowWidth - width) / 2, y: (windowHeight - height) / 2, width, height };
}

/** A continuation page inherits the chapter selected by the contents, not its own subtitle. */
export function chapterHeaders(pageIds, entries) {
  const starts = new Map(entries.filter(entry => entry.kind === 'page').map((entry, index) => [
    entry.target, `${String(index + 1).padStart(2, '0')} ${entry.label.replace(/^\s*\d+[\s　.・]+/u, '').trim()}`,
  ]));
  let current;
  return pageIds.map(id => {
    if (starts.has(id)) current = starts.get(id);
    return id === 'contents' ? '目次' : current;
  });
}

/** Keep the running chapter label, suppress only an identical large heading. */
export function repeatsChapterHeading(heading, header) {
  if (!header) return false;
  const normalized = value => value.replace(/^\s*\d+[\s　.・]+/u, '').replace(/[\s　]/gu, '');
  return normalized(heading) === normalized(header);
}
export const COVER_COPY = Object.freeze({ titleY: .71, textOnlyTitleY: .30, periodTitleY: .625, linksY: .82, studioTitleY: .51, studioTextOnlyTitleY: .22 });
export const LINK_ICONS = Object.freeze({
  demo: { path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M2 12h20M12 2c-5 5-5 15 0 20M12 2c5 5 5 15 0 20', fill: false },
  github: { path: 'M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.76-.24.76-.54v-2.1c-3.12.68-3.78-1.32-3.78-1.32-.51-1.3-1.25-1.64-1.25-1.64-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.49-.28-5.1-1.24-5.1-5.54 0-1.23.44-2.23 1.15-3.01-.12-.29-.5-1.43.11-2.97 0 0 .94-.3 3.08 1.15a10.72 10.72 0 0 1 5.6 0c2.14-1.45 3.08-1.15 3.08-1.15.61 1.54.23 2.68.11 2.97a4.33 4.33 0 0 1 1.15 3.01c0 4.31-2.62 5.25-5.12 5.53.4.35.76 1.03.76 2.08v3.19c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z', fill: true },
});

/** The visible rounded button and its pointer hit region share the same rectangle. */
export function coverLinkRects(count, width, height) {
  return Array.from({ length: count }, (_, index) => ({
    x: width * (count === 1 ? .5 : .34 + index * .34) - width * .1465,
    y: height * COVER_COPY.linksY - height * .05,
    width: width * .293,
    height: height * .1,
  }));
}
export function coverLinkAt(rects, u, v) {
  return rects.find(rect => u >= rect.x && u <= rect.x + rect.width && v >= rect.y && v <= rect.y + rect.height);
}

/** Keep month precision only when supplied; unfamiliar text stays literal. */
export function coverPeriodParts(period) {
  const match = period.trim().match(/^(\d{4})年(?:(\d{1,2})月)?(?:[〜～~—–]\s*(?:(?:(\d{4})年)?(\d{1,2})月(頃)?|(現在)))?$/u);
  if (!match || (match[2] && (+match[2] < 1 || +match[2] > 12)) || (match[4] && (+match[4] < 1 || +match[4] > 12))) return { start: period, end: '' };
  const start = match[1] + (match[2] ? `.${match[2].padStart(2, '0')}` : '');
  const end = match[6] || (match[4] ? `${match[3] || match[1]}.${match[4].padStart(2, '0')}` : '');
  return { start, end };
}

/** Same-year ranges omit only the repeated year, never a supplied month. */
export function coverPeriodLabel(period) {
  const { start, end } = coverPeriodParts(period);
  if (!end || start === end) return start;
  const shortEnd = /^\d{4}\.\d{2}$/u.test(start) && end.startsWith(start.slice(0, 5)) ? end.slice(5) : end;
  return `${start}–${shortEnd}`;
}

// Source-art coordinates keep the date anchored consistently after alpha cropping.
export const COVER_DATE = Object.freeze({ x: 960, y: 1258, fontSize: 32, maxWidth: 700 });
export function coverDateLayout(crop, width, height) {
  return {
    x: (COVER_DATE.x - crop.left) / crop.width * width,
    y: (COVER_DATE.y - crop.top) / crop.height * height,
    fontSize: COVER_DATE.fontSize / crop.width * width,
    maxWidth: COVER_DATE.maxWidth / crop.width * width,
  };
}
