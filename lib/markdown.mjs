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

// Whitelist additions for exported-notes HTML (collapsible sections).
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...defaultSchema.tagNames, 'details', 'summary'],
};

/** Map a markdown body image ref to its content-addressed artifact URL. */
export function mapImageSrc(src, attachments = []) {
  const found = attachments.find((a) => a.logicalPath === src);
  return found ? '/' + found.artifactPath : src;
}

export function makeMarkdownComponents(attachments) {
  return {
    img: ({ node, ...props }) =>
      createElement('img', { ...props, src: mapImageSrc(props.src, attachments) }),
  };
}

export function renderMarkdown(markdown, attachments = []) {
  return createElement(Markdown, {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [[rehypeRaw], [rehypeSanitize, sanitizeSchema], [rehypeHighlight]],
    components: makeMarkdownComponents(attachments),
    children: markdown,
  });
}
