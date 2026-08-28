// TOC extraction from note bodies, mirroring the markdown renderer's rules:
// h1-h3 headings get anchors, a leading h1 duplicating the page title is
// skipped (the renderer drops it), and ids are assigned in document order
// with -2/-3 suffixes for duplicates. Heading ids are consumed as a queue by
// the renderer (lib/markdown.mjs), so both sides must skip/order identically.
//
// Line-based instead of mdast: unified/remark-parse are not hoisted by pnpm
// and this repo adds no dependencies for a ~60-line parser.

/** GitHub-style slug that keeps CJK characters; '' only for pure punctuation. */
export function slugifyHeading(text) {
  const slug = String(text)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'section'
}

/** Plain-text label of a heading line: images dropped, links/text/code unwrapped. */
function stripInline(line) {
  return line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/[*_~]/g, '')
    .trim()
}

const RESOURCE_HEADING = /^(?:references?|相关资料|参考资料|参考链接|相关链接)$/i

/** Keep historical source headings consistent in the rendered TOC. */
export function normalizeTocHeading(text) {
  return RESOURCE_HEADING.test(String(text).trim()) ? 'References' : text
}

// Block-level tags that start a raw-HTML block in CommonMark; `#` lines inside
// them are HTML content, not headings. Inline tags stay out so `<a>` lines
// don't swallow real headings.
const HTML_BLOCK_TAGS =
  /^(address|article|aside|base|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)$/i

/**
 * Extract [{ depth, text, id }] for h1-h3 headings.
 * @param {string} markdown
 * @param {{ title?: string }} [options] page title used for the leading-h1 skip
 */
export function getToc(markdown, { title } = {}) {
  const headings = []
  const seen = new Map()
  let inFence = false
  let inHtml = null // tag name when inside a raw HTML block, else null
  let sawFirstH1 = false

  for (const line of String(markdown ?? '').split('\n')) {
    const fence = /^\s*(```+|~~~+)/.exec(line)
    if (fence) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    if (inHtml) {
      if (!line.trim() || line.includes(`</${inHtml}`)) inHtml = null
      continue
    }
    const openTag = /^\s*<([a-zA-Z][a-zA-Z0-9-]*)>?\s/.exec(line) ||
      /^\s*<([a-zA-Z][a-zA-Z0-9-]*)(?:\s|>|$)/.exec(line)
    if (openTag && HTML_BLOCK_TAGS.test(openTag[1]) && !line.includes(`</${openTag[1]}`)) {
      inHtml = openTag[1]
      continue
    }

    const m = /^(#{1,3})\s+(.+?)\s*$/.exec(line)
    if (!m) continue
    const depth = m[1].length
    const raw = m[2].trim()
    // Skip a leading h1 that duplicates the page title — same rule as the
    // renderer (plain text only; markup headings are never deduped there).
    if (depth === 1 && !sawFirstH1) {
      sawFirstH1 = true
      if (title && !/[`*_[\]!~]/.test(raw) && raw === String(title).trim()) continue
    }
    const text = normalizeTocHeading(stripInline(raw))
    if (!text) continue

    const slug = slugifyHeading(text)
    const n = (seen.get(slug) ?? 0) + 1
    seen.set(slug, n)
    headings.push({ depth, text, id: n === 1 ? slug : `${slug}-${n}` })
  }
  return headings
}
