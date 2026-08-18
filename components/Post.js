import PropTypes from 'prop-types'
import FormattedDate from '@/components/FormattedDate'
import TagItem from '@/components/TagItem'
import Toc from '@/components/Toc'
import Reveal from '@/components/Reveal'
import { renderMarkdown } from '@/lib/markdown.mjs'

/** Human-readable section name for the hero eyebrow, from the canonical slug. */
function sectionLabel(slug) {
  if (slug.startsWith('/topics')) return '专题'
  if (slug.startsWith('/learning')) return '学习'
  if (slug.startsWith('/archive')) return '归档'
  return '文章'
}

/**
 * A post renderer: header metadata + markdown body.
 * With a TOC (>= 2 headings) the desktop layout widens to a two-column grid
 * (body + sticky sidebar); short posts keep the original single column.
 *
 * @param {object} props
 * @param {object} props.post        - Post metadata
 * @param {string} props.markdown    - Markdown body from the Manifest
 * @param {Array}  props.attachments - Attachment inventory for image refs
 * @param {Array}  props.toc         - [{ depth, text, id }] headings from getToc
 */
export default function Post({ post, markdown, attachments, toc = [] }) {
  const showToc = toc.length >= 2
  const body = (
    <Reveal className="self-stretch mt-2 flex flex-col items-center">
      <div className="flex-none w-full max-w-3xl px-4">
        <div className="markdown-body prose dark:prose-invert max-w-none">
          {renderMarkdown(markdown, attachments, {
            title: post.title,
            headingIds: toc.map(t => t.id)
          })}
        </div>
      </div>
    </Reveal>
  )
  const header = (
    <>
      {/* Hero: section eyebrow, oversized title, meta row, then a red gradient
          hairline that hands off to the body. */}
      <p className="w-full max-w-3xl px-4 mb-3 text-xs font-semibold tracking-[0.25em] text-primary-500 dark:text-primary-400">
        {sectionLabel(post.slug)} · {new Date(post.date).getFullYear()}
      </p>
      <h1 className="w-full max-w-3xl px-4 font-extrabold text-5xl tracking-tighter text-black dark:text-white">
        {post.title}
      </h1>
      <nav className="w-full max-w-3xl px-4 flex mt-6 items-start text-gray-500 dark:text-gray-400">
        <div className="mr-2 mb-4 md:ml-0">
          <FormattedDate date={post.date} />
        </div>
        {post.tags && (
          <div className="flex flex-nowrap max-w-full overflow-x-auto article-tags">
            {post.tags.map(tag => (
              <TagItem key={tag} tag={tag} />
            ))}
          </div>
        )}
      </nav>
      <div className="w-full max-w-3xl px-4 mt-4 h-px bg-gradient-to-r from-primary-500/70 via-primary-500/20 to-transparent" />
      {showToc && (
        <div className="w-full max-w-3xl px-4 mb-6 mt-8 lg:hidden">
          <Toc toc={toc} variant="mobile" />
        </div>
      )}
    </>
  )

  return (
    <article className="flex flex-col items-center">
      {header}
      {body}
      {/* Floating sidebar in the right whitespace: the centered article column
          is identical with or without a TOC (see .toc-sidebar in globals.css). */}
      {showToc && (
        <aside className="toc-sidebar">
          <Toc toc={toc} />
        </aside>
      )}
    </article>
  )
}

Post.propTypes = {
  post: PropTypes.object.isRequired,
  markdown: PropTypes.string.isRequired,
  attachments: PropTypes.array,
  toc: PropTypes.array
}
