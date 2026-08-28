// Markdown rendering pipeline — shared by the post page and tested in plain node.
// react-markdown is the industry-standard React renderer (~10M weekly downloads);
// remark-gfm covers GFM tables; rehype-raw + rehype-sanitize render the raw HTML
// found in exported notes (details/summary etc.) behind a whitelist; rehype-highlight
// highlights code fences (theme CSS imported in _app).
import { Children, createElement, isValidElement, useState } from 'react';
import NextImageModule from 'next/image.js';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';

const Image = NextImageModule.default ?? NextImageModule;

function allowClassNames(tagName, ...allowed) {
  const attributes = defaultSchema.attributes[tagName] ?? [];
  const previous = attributes.find((entry) => Array.isArray(entry) && entry[0] === 'className');
  return [
    ...attributes.filter((entry) => !(Array.isArray(entry) && entry[0] === 'className')),
    ['className', ...(previous?.slice(1) ?? []), ...allowed],
  ];
}

// Whitelist additions for exported-notes HTML (collapsible sections; callout boxes).
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...defaultSchema.tagNames, 'details', 'summary'],
  attributes: {
    ...defaultSchema.attributes,
    a: allowClassNames('a', 'resource-link'),
    div: [...(defaultSchema.attributes.div ?? []), 'className'],
    h1: allowClassNames('h1', 'resource-heading'),
    h2: allowClassNames('h2', 'resource-heading'),
    h3: allowClassNames('h3', 'resource-heading'),
    ul: allowClassNames('ul', 'resource-list'),
  },
};

const RESOURCE_HEADING = /^(?:references?|相关资料|参考资料|参考链接|相关链接)$/i;

function mdastText(node) {
  if (node?.type === 'text' || node?.type === 'inlineCode') return node.value ?? '';
  if (!Array.isArray(node?.children)) return '';
  return node.children.map(mdastText).join('');
}

function addNodeClass(node, className) {
  node.data = node.data ?? {};
  node.data.hProperties = node.data.hProperties ?? {};
  const previous = node.data.hProperties.className ?? [];
  const classes = Array.isArray(previous) ? previous : String(previous).split(/\s+/);
  node.data.hProperties.className = [...new Set([...classes.filter(Boolean), className])];
}

function markResourceLinks(node) {
  if (isSingleLinkParagraph(node)) {
    addNodeClass(node.children[0], 'resource-link');
    return;
  }
  if (Array.isArray(node?.children)) node.children.forEach(markResourceLinks);
}

function isSingleLinkParagraph(node) {
  return node?.type === 'paragraph' && node.children?.length === 1 && node.children[0]?.type === 'link';
}

function isResourceLinkList(node) {
  return node?.type === 'list' && node.children?.length > 0 && node.children.every((item) =>
    item?.type === 'listItem' && item.children?.length === 1 && isSingleLinkParagraph(item.children[0])
  );
}

/**
 * Notes historically use Reference, References and 相关资料, with either a
 * Markdown list or one bare link per paragraph. Normalize that published
 * shape without requiring old Manifests to be rebuilt first.
 */
function remarkResourceSections() {
  return (tree) => {
    const children = tree?.children;
    if (!Array.isArray(children)) return;

    for (let index = 0; index < children.length; index += 1) {
      const heading = children[index];
      if (heading?.type !== 'heading' || !RESOURCE_HEADING.test(mdastText(heading).trim())) continue;

      heading.children = [{ type: 'text', value: 'References' }];
      addNodeClass(heading, 'resource-heading');

      const sectionDepth = heading.depth;
      let cursor = index + 1;
      while (
        cursor < children.length &&
        !(children[cursor]?.type === 'heading' && children[cursor].depth <= sectionDepth)
      ) {
        if (isSingleLinkParagraph(children[cursor])) {
          const paragraphs = [];
          while (cursor < children.length && isSingleLinkParagraph(children[cursor])) {
            paragraphs.push(children[cursor]);
            cursor += 1;
          }
          const list = {
            type: 'list',
            ordered: false,
            spread: false,
            children: paragraphs.map((paragraph) => ({
              type: 'listItem',
              spread: false,
              children: [paragraph],
            })),
          };
          addNodeClass(list, 'resource-list');
          markResourceLinks(list);
          children.splice(cursor - paragraphs.length, paragraphs.length, list);
          cursor = cursor - paragraphs.length + 1;
          continue;
        }

        if (isResourceLinkList(children[cursor])) {
          addNodeClass(children[cursor], 'resource-list');
          markResourceLinks(children[cursor]);
        }
        cursor += 1;
      }
    }
  };
}

// Notion exports turn link-preview blocks into callout blockquotes:
//
//   > [!info] <link title>
//   > <description>
//   > [<url>](<url>)
//
// remark-gfm leaves them as plain blockquotes; convert to styled callout boxes.
function remarkCallouts() {
  const html = (value) => ({ type: 'html', value });
  const transform = (node) => {
    if (node?.type !== 'blockquote') return null;
    const [firstPara, ...rest] = node.children;
    const firstText = firstPara?.type === 'paragraph' ? firstPara.children?.[0] : null;
    if (firstText?.type !== 'text') return null;
    const m = /^\[!(info|important)\][^\S\n]*(.*?)(?=\n|$)/.exec(firstText.value);
    if (!m) return null;
    const title = m[2].trim();
    const out = [html(`<div class="callout callout-${m[1]}">`)];
    if (title) {
      out.push({ type: 'paragraph', children: [{ type: 'strong', children: [{ type: 'text', value: title }] }] });
    }
    // Soft line breaks leave the rest in the same text node; hard breaks split
    // it into following nodes.
    let remainder = firstPara.children.slice(1);
    while (remainder.length && remainder[0].type === 'break') remainder = remainder.slice(1);
    const restText = firstText.value.slice(m[0].length);
    if (restText.trim()) remainder.unshift({ type: 'text', value: restText });
    if (remainder.length) out.push({ ...firstPara, children: remainder });
    out.push(...rest, html('</div>'));
    return out;
  };
  const visit = (nodes) =>
    nodes.flatMap((node) => {
      const list = transform(node) ?? [node];
      return list.map((n) => {
        if (n && Array.isArray(n.children)) n.children = visit(n.children);
        return n;
      });
    });
  return (tree) => {
    tree.children = visit(tree.children);
  };
}

/** Map a markdown attachment ref to its content-addressed artifact URL. */
export function mapAttachmentSrc(src, attachments = []) {
  const found = attachments.find((a) => a.logicalPath === src);
  return found ? '/' + found.artifactPath : src;
}

/** Kept as the image-specific public seam used by existing callers/tests. */
export function mapImageSrc(src, attachments = []) {
  return mapAttachmentSrc(src, attachments);
}

function videoMimeType(attachment) {
  if (attachment?.mediaType?.startsWith('video/')) return attachment.mediaType;
  const path = attachment?.artifactPath ?? attachment?.logicalPath ?? '';
  if (/\.webm$/i.test(path)) return 'video/webm';
  if (/\.ogg$/i.test(path)) return 'video/ogg';
  if (/\.mov$/i.test(path)) return 'video/quicktime';
  return 'video/mp4';
}

function isVideoAttachment(attachment) {
  if (!attachment) return false;
  return attachment.mediaType?.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/i.test(attachment.logicalPath);
}

function imageAttachment(attachments, logicalPath) {
  const attachment = attachments.find((item) => item.logicalPath === logicalPath);
  if (!attachment?.mediaType?.startsWith('image/')) return null;
  return attachment;
}

/**
 * Use Next's responsive image pipeline when the Manifest provides intrinsic
 * dimensions. Older artifacts and external images remain ordinary lazy images.
 */
function AttachmentImage({ node, src, alt = '', ...props }, attachments) {
  const attachment = imageAttachment(attachments, src);
  const mappedSrc = mapImageSrc(src, attachments);
  const hasDimensions = Number.isInteger(attachment?.width) && attachment.width > 0 &&
    Number.isInteger(attachment?.height) && attachment.height > 0;
  const optimizable = hasDimensions && /\.(?:png|jpe?g|webp)$/i.test(attachment.artifactPath);

  if (optimizable) {
    return createElement(Image, {
      ...props,
      src: mappedSrc,
      alt,
      width: attachment.width,
      height: attachment.height,
      sizes: '(min-width: 768px) 48rem, calc(100vw - 2.5rem)',
      loading: 'lazy',
    });
  }

  return createElement('img', {
    ...props,
    src: mappedSrc,
    alt,
    loading: 'lazy',
    decoding: 'async',
    ...(hasDimensions ? { width: attachment.width, height: attachment.height } : {}),
  });
}

/**
 * Notion-style exports often place a list immediately after </summary>.
 * CommonMark treats that first marker as raw text unless a blank line separates
 * it from the HTML block, so normalize only this boundary (and never code fences).
 */
export function normalizeExportedMarkdown(markdown = '') {
  const lines = String(markdown).split(/\r?\n/);
  const normalized = [];
  let fenceCharacter = null;

  lines.forEach((line, index) => {
    const fence = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) {
      const character = fence[1][0];
      if (fenceCharacter === character) fenceCharacter = null;
      else if (!fenceCharacter) fenceCharacter = character;
    }

    normalized.push(line);
    const nextLine = lines[index + 1];
    if (
      !fenceCharacter &&
      /<\/summary>\s*$/i.test(line) &&
      /^\s*(?:[-*+] |\d+[.)] )/.test(nextLine ?? '')
    ) {
      normalized.push('');
    }
  });

  return normalized.join('\n');
}

/** Plain text of a heading's children; '' when it contains markup (then never matches). */
function plainHeadingText(children) {
  if (children == null) return '';
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children) && children.every((c) => typeof c === 'string' || typeof c === 'number')) {
    return children.join('');
  }
  return '';
}

/** Recursively collect plain text from a react-markdown child tree. */
function collectText(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(collectText).join('');
  if (node?.props) return collectText(node.props.children);
  return '';
}

/**
 * Code fences get a header bar (mac-style dots + language + copy button)
 * instead of a bare slab. Language comes from the hljs className set by
 * rehype-highlight.
 */
function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const codeEl = Array.isArray(children) ? children[0] : children;
  const lang =
    (String(codeEl?.props?.className || '').match(/language-([\w+-]+)/) || [])[1] || 'text';
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(collectText(codeEl?.props?.children));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (http / permissions) — no-op.
    }
  };
  return createElement(
    'div',
    { className: 'code-block' },
    createElement(
      'div',
      { className: 'code-block-header' },
      createElement(
        'span',
        { className: 'code-block-dots' },
        createElement('i', null),
        createElement('i', null),
        createElement('i', null)
      ),
      createElement('span', { className: 'code-block-lang' }, lang),
      createElement(
        'button',
        { type: 'button', onClick: onCopy, className: copied ? 'copied' : undefined },
        copied ? '已复制' : '复制'
      )
    ),
    // react-markdown's pre component replaces the <pre> element itself, so the
    // code element comes through unwrapped — re-wrap it here or every `pre code`
    // selector (block background, dark tokens, :not(pre code) chips) misses.
    createElement('pre', null, children)
  );
}

/** Keep summary as the first child and give all expanded content one indent context. */
function Details({ node, children, ...props }) {
  const parts = Children.toArray(children);
  const summaryIndex = parts.findIndex((part) => isValidElement(part) && part.type === 'summary');
  if (summaryIndex < 0) return createElement('details', props, children);

  const summary = parts[summaryIndex];
  const content = parts.filter((part, index) => {
    if (index === summaryIndex) return false;
    return typeof part !== 'string' || part.trim();
  });

  return createElement(
    'details',
    props,
    summary,
    createElement('div', { className: 'details-content' }, content)
  );
}

/** Render local video attachments as players while ordinary links stay links. */
function AttachmentLink({ node, href, children, ...props }, attachments) {
  const attachment = attachments.find((item) => item.logicalPath === href);
  if (!isVideoAttachment(attachment)) {
    if (String(props.className ?? '').split(/\s+/).includes('resource-link')) {
      const label = collectText(children).trim();
      let host = '';
      let detail = label;
      try {
        const url = new URL(href);
        host = url.hostname.replace(/^www\./, '');
        detail = host;
        const normalizedLabel = label.replace(/\/$/, '');
        const normalizedHref = href.replace(/\/$/, '');
        if (normalizedLabel === normalizedHref) {
          detail = `${host}${url.pathname === '/' ? '' : url.pathname}`;
        }
      } catch {
        // Relative and malformed URLs keep their original label.
      }
      return createElement(
        'a',
        { ...props, href },
        createElement(
          'span',
          { className: 'resource-link-copy' },
          createElement('span', { className: 'resource-link-title' }, label === href ? host || label : label),
          host && createElement('span', { className: 'resource-link-meta' }, detail)
        ),
        createElement('span', { className: 'resource-link-arrow', 'aria-hidden': 'true' }, '\u2197')
      );
    }
    return createElement('a', { ...props, href }, children);
  }

  const src = mapAttachmentSrc(href, attachments);
  const label = collectText(children).trim() || '文章视频';
  return createElement(
    'span',
    { className: 'article-video' },
    createElement(
      'video',
      { controls: true, playsInline: true, preload: 'metadata', 'aria-label': label },
      createElement('source', { src, type: videoMimeType(attachment) }),
      '当前浏览器无法播放此视频。',
      createElement('a', { href: src }, '下载视频')
    )
  );
}

export function makeMarkdownComponents(attachments, title, headingIds = []) {
  let sawFirstH1 = false;
  let sawFirstHeading = false;
  let idCursor = 0;
  const nextId = () => (idCursor < headingIds.length ? headingIds[idCursor++] : null);
  // Headings get their precomputed anchor id plus a hover-revealed "#" link
  // (the anchor is only rendered when an id exists). The first heading that
  // actually renders (a deduped h1 never renders) is marked first-heading,
  // the visual "body starts here" anchor below the hero divider.
  const heading = (Tag, { node, children, ...props }) => {
    const id = nextId();
    const anchor = id
      ? createElement(
          'a',
          { href: `#${id}`, className: 'heading-anchor', 'aria-hidden': 'true' },
          '#'
        )
      : null;
    const className = [props.className, sawFirstHeading ? null : 'first-heading']
      .filter(Boolean)
      .join(' ') || undefined;
    sawFirstHeading = true;
    return createElement(Tag, { ...props, id, className }, anchor, children);
  };
  return {
    img: (props) => AttachmentImage(props, attachments),
    a: (props) => AttachmentLink(props, attachments),
    details: Details,
    pre: ({ node, children, ...props }) => createElement(CodeBlock, null, children),
    // Many exported notes start with `# <title>` — the page header already shows
    // the title, so drop a body h1 that duplicates it (only the first one).
    // Heading ids come from a precomputed queue (lib/toc.mjs); a dropped h1
    // must not consume its slot or every following anchor would shift.
    h1: ({ node, children, ...props }) => {
      if (!sawFirstH1) {
        sawFirstH1 = true;
        if (title && plainHeadingText(children).trim() === String(title).trim()) return null;
      }
      return heading('h2', { node, children, ...props });
    },
    // The page hero owns the only h1. Preserve source hierarchy while shifting
    // body headings down one semantic level for valid document structure.
    h2: ({ node, children, ...props }) => heading('h3', { node, children, ...props }),
    h3: ({ node, children, ...props }) => heading('h4', { node, children, ...props }),
  };
}

export function renderMarkdown(markdown, attachments = [], { title, headingIds } = {}) {
  return createElement(Markdown, {
    remarkPlugins: [remarkGfm, remarkCallouts, remarkResourceSections],
    rehypePlugins: [[rehypeRaw], [rehypeSanitize, sanitizeSchema], [rehypeHighlight]],
    components: makeMarkdownComponents(attachments, title, headingIds),
  }, normalizeExportedMarkdown(markdown));
}
