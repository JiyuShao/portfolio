export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

const CATEGORY_LABELS = {
  articles: '文章 / ARTICLE',
  topics: '专题 / TOPIC',
  learning: '学习 / LEARNING',
  archive: '归档 / ARCHIVE',
};

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function glyphWidth(character) {
  if (/\s/u.test(character)) return 0.36;
  if (/^[\u0000-\u00ff]$/u.test(character)) return 0.72;
  return 1;
}

function measuredWidth(value) {
  return Array.from(value).reduce((total, character) => total + glyphWidth(character), 0);
}

export function wrapCardText(value, maxWidth, maxLines) {
  const source = String(value ?? '').trim();
  const rawTokens = source.match(/[A-Za-z0-9][A-Za-z0-9.+#³_-]*|./gu) ?? [];
  const tokens = rawTokens.flatMap(token => (
    measuredWidth(token) > maxWidth ? Array.from(token) : [token]
  ));
  if (!tokens.length) return [];

  const lines = [];
  let current = '';
  let width = 0;
  let truncated = false;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const nextWidth = width + measuredWidth(token);
    if (current && nextWidth > maxWidth) {
      if (/^[，。！？、；：,.!?;:）》】]$/u.test(token)) {
        current += token;
        width = nextWidth;
        continue;
      }
      lines.push(current.trimEnd());
      if (lines.length === maxLines) {
        truncated = true;
        break;
      }
      current = token.trimStart();
      width = measuredWidth(current);
    } else {
      current += token;
      width = nextWidth;
    }
  }
  if (lines.length < maxLines && current) lines.push(current.trimEnd());

  if (truncated && lines.length) {
    const lastIndex = lines.length - 1;
    lines[lastIndex] = `${lines[lastIndex].replace(/[，。！？、；：,.!?;:\s]+$/u, '')}…`;
  }
  return lines;
}

export function getOgImagePath(slug) {
  if (typeof slug !== 'string' || !/^\/(articles|topics|learning|archive)\/[^/?#%\\\s]+$/u.test(slug)) {
    throw new Error(`Cannot derive an OG image path from invalid slug: ${slug}`);
  }
  return `/og${slug}.png`;
}

function textLines(lines, { x, firstY, lineHeight, fontSize, fill, weight = 400 }) {
  return lines.map((line, index) => (
    `<text x="${x}" y="${firstY + index * lineHeight}" font-family="LXGW WenKai" font-size="${fontSize}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`
  )).join('');
}

export function buildOgCardSvg(item) {
  const title = String(item?.title ?? '').trim();
  if (!title) throw new Error('OG card title is required');

  const titleWidth = measuredWidth(title);
  const titleFontSize = titleWidth <= 14 ? 76 : titleWidth <= 28 ? 66 : titleWidth <= 44 ? 58 : 52;
  const titleLineHeight = Math.round(titleFontSize * 1.24);
  const titleLines = wrapCardText(title, 930 / titleFontSize, 3);
  const summaryLines = wrapCardText(item.summary, 36, 2);
  const summaryY = 190 + (titleLines.length - 1) * titleLineHeight + 70;
  const category = CATEGORY_LABELS[item.category] ?? 'NOTE';
  const date = String(item.date ?? '').replaceAll('-', '.');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}">
  <rect width="1200" height="630" fill="#faf9f7"/>
  <circle cx="1120" cy="18" r="250" fill="#ef4444" opacity="0.055"/>
  <circle cx="1120" cy="18" r="168" fill="none" stroke="#ef4444" stroke-width="2" opacity="0.13"/>
  <path d="M88 94 H150" stroke="#ef4444" stroke-width="5" stroke-linecap="round"/>
  <text x="168" y="103" font-family="LXGW WenKai" font-size="25" fill="#dc2626" letter-spacing="1.8">${escapeXml(category)} · ${escapeXml(date)}</text>
  ${textLines(titleLines, { x: 88, firstY: 190, lineHeight: titleLineHeight, fontSize: titleFontSize, fill: '#18181b' })}
  ${textLines(summaryLines, { x: 91, firstY: summaryY, lineHeight: 39, fontSize: 27, fill: '#71717a' })}
  <path d="M88 520 H1112" stroke="#d4d4d8" stroke-width="1"/>
  <text x="88" y="570" font-family="LXGW WenKai" font-size="26" fill="#3f3f46">Jiyu Shao · 啊鸡同学切利哦</text>
  <text x="1112" y="570" text-anchor="end" font-family="LXGW WenKai" font-size="25" font-style="italic" fill="#71717a">Real, Simple, Stupid.</text>
</svg>`;
}
