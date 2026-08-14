// Markdown rendering pipeline — shared by the post page and tested in plain node.
// react-markdown is the industry-standard React renderer (~10M weekly downloads);
// remark-gfm covers GFM tables; rehype-raw + rehype-sanitize render the raw HTML
// found in exported notes (details/summary etc.) behind a whitelist; rehype-highlight
// highlights code fences (theme CSS imported in _app).
import { createElement } from 'react';
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

export function makeMarkdownComponents(attachments, title) {
  let sawFirstH1 = false;
  return {
    img: ({ node, ...props }) =>
      createElement('img', { ...props, src: mapImageSrc(props.src, attachments) }),
    // Many exported notes start with `# <title>` — the page header already shows
    // the title, so drop a body h1 that duplicates it (only the first one).
    h1: ({ node, children, ...props }) => {
      if (!sawFirstH1) {
        sawFirstH1 = true;
        if (title && plainHeadingText(children).trim() === String(title).trim()) return null;
      }
      return createElement('h1', props, children);
    },
  };
}

export function renderMarkdown(markdown, attachments = [], { title } = {}) {
  return createElement(Markdown, {
    remarkPlugins: [remarkGfm, remarkCallouts],
    rehypePlugins: [[rehypeRaw], [rehypeSanitize, sanitizeSchema], [rehypeHighlight]],
    components: makeMarkdownComponents(attachments, title),
    children: markdown,
  });
}
