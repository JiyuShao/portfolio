import PropTypes from 'prop-types'
import Link from 'next/link'
import FormattedDate from '@/components/FormattedDate'
import TagItem from '@/components/TagItem'
import Toc from '@/components/Toc'
import Reveal from '@/components/Reveal'
import { renderMarkdown } from '@/lib/markdown.mjs'
import { getContentCategory, getContentCategoryHref } from '@/lib/content-categories'

/** Human-readable section name for the hero eyebrow, from the canonical slug. */
function sectionLabel(slug) {
  if (slug.startsWith('/topics')) return '专题'
  if (slug.startsWith('/learning')) return '学习'
  if (slug.startsWith('/archive')) return '归档'
  return '文章'
}

/** Rough reading duration for mixed Chinese and Latin technical writing. */
function readingMinutes(markdown) {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, '')
  const characters = withoutCode.replace(/\s/g, '').length
  return Math.max(1, Math.ceil(characters / 450))
}

/**
 * A post renderer: header metadata + markdown body.
 * With a TOC (>= 2 headings) the desktop layout widens to a two-column grid
 * (body + sticky sidebar); short posts keep the original single column.
 *
 * @param {object} props
 * @param {object} props.post        - Post metadata
 * @param {string} props.markdown    - Markdown body from the Manifest
 * @param {Array}  props.attachments - Attachment inventory for image and video refs
 * @param {Array}  props.toc         - [{ depth, text, id }] headings from getToc
 */
export default function Post({ post, markdown, attachments, toc = [] }) {
  const showToc = toc.length >= 2
  const minutes = readingMinutes(markdown)
  const category = getContentCategory(post.category)
  const titleLength = Array.from(post.title).length
  const titleClassName = titleLength > 38
    ? 'article-title article-title-extra-long'
    : titleLength > 24
      ? 'article-title article-title-long'
      : 'article-title'
  const body = (
    <Reveal className="article-body-wrap">
      <div className="article-body-inner">
        <div className="markdown-body prose prose-lg dark:prose-invert max-w-none">
          {renderMarkdown(markdown, attachments, {
            title: post.title,
            headingIds: toc.map(t => t.id)
          })}
        </div>
      </div>
    </Reveal>
  )
  const header = (
    <header className="article-hero">
      <div className="article-hero-inner">
        <Link href={getContentCategoryHref(category.key)} className="article-back-link">
          <span aria-hidden="true">←</span>
          返回{category.label}
        </Link>
        <p className="article-kicker">
          {sectionLabel(post.slug)} <span aria-hidden="true">·</span> {new Date(post.date).getFullYear()}
        </p>
        <h1 className={titleClassName}>{post.title}</h1>
        {post.summary && (
          <p className="article-summary">{post.summary}</p>
        )}
        <div className="article-meta" aria-label="文章信息">
          <span className="article-meta-item">
            <span className="article-meta-label">发布于</span>
            <FormattedDate date={post.date} />
          </span>
          <span className="article-meta-dot" aria-hidden="true" />
          <span className="article-meta-item">约 {minutes} 分钟阅读</span>
        </div>
        {post.tags?.length > 0 && (
          <div className="article-hero-tags">
            {post.tags.map(tag => (
              <TagItem key={tag} tag={tag} category={post.category} />
            ))}
          </div>
        )}
      </div>
    </header>
  )

  return (
    <article className="article-page">
      {header}
      {showToc && (
        <div className="article-mobile-toc">
          <Toc toc={toc} variant="mobile" />
        </div>
      )}
      {body}
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
