// Markdown rendering pipeline — shared by the post page and tested in plain node.
// react-markdown is the industry-standard React renderer (~10M weekly downloads);
// remark-gfm covers GFM tables; rehype-raw + rehype-sanitize render the raw HTML
// found in exported notes (details/summary etc.) behind a whitelist; rehype-highlight
// highlights code fences (theme CSS imported in _app).
import { createElement, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';

// Whitelist additions for exported-notes HTML (collapsible sections; callout boxes).
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...defaultSchema.tagNames, 'details', 'summary'],
  attributes: {
    ...defaultSchema.attributes,
    div: [...(defaultSchema.attributes.div ?? []), 'className'],
  },
};

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

/** Map a markdown body image ref to its content-addressed artifact URL. */
export function mapImageSrc(src, attachments = []) {
  const found = attachments.find((a) => a.logicalPath === src);
  return found ? '/' + found.artifactPath : src;
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

export function makeMarkdownComponents(attachments, title, headingIds = []) {
  let sawFirstH1 = false;
  let idCursor = 0;
  const nextId = () => (idCursor < headingIds.length ? headingIds[idCursor++] : null);
  // Headings get their precomputed anchor id plus a hover-revealed "#" link
  // (the anchor is only rendered when an id exists).
  const heading = (Tag, { node, children, ...props }) => {
    const id = nextId();
    const anchor = id
      ? createElement(
          'a',
          { href: `#${id}`, className: 'heading-anchor', 'aria-hidden': 'true' },
          '#'
        )
      : null;
    return createElement(Tag, { ...props, id }, anchor, children);
  };
  return {
    img: ({ node, ...props }) =>
      createElement('img', { ...props, src: mapImageSrc(props.src, attachments) }),
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
      return heading('h1', { node, children, ...props });
    },
    h2: ({ node, children, ...props }) => heading('h2', { node, children, ...props }),
    h3: ({ node, children, ...props }) => heading('h3', { node, children, ...props }),
  };
}

export function renderMarkdown(markdown, attachments = [], { title, headingIds } = {}) {
  return createElement(Markdown, {
    remarkPlugins: [remarkGfm, remarkCallouts],
    rehypePlugins: [[rehypeRaw], [rehypeSanitize, sanitizeSchema], [rehypeHighlight]],
    components: makeMarkdownComponents(attachments, title, headingIds),
    children: markdown,
  });
}
