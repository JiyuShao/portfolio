import FormattedDate from '@/components/FormattedDate'
import TagItem from '@/components/TagItem'
import Reveal from '@/components/Reveal'
import Link from 'next/link'
import { getContentCategory, getContentCategoryHref } from '@/lib/content-categories'

const BlogPost = ({ post, index, currentTag, query }) => {
  const category = getContentCategory(post.category)
  return (
    <Reveal>
      <article className="home-post-card">
        <div className="home-post-meta">
          {index && <span className="home-post-index">{String(index).padStart(2, '0')}</span>}
          <time className="text-sm font-medium text-gray-500 dark:text-zinc-500">
            <FormattedDate date={post.date} />
          </time>
          {post.category && (
            <Link
              href={getContentCategoryHref(post.category, { tag: currentTag, query })}
              className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-primary-500 transition hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
            >
              {category.label}
            </Link>
          )}
        </div>
        <div className="min-w-0">
          <Link href={post.slug} aria-label={`阅读《${post.title}》`} className="group/title">
            <h2 className="font-serif text-2xl font-normal leading-snug tracking-tight text-gray-950 transition-colors group-hover/title:text-primary-600 dark:text-zinc-50 dark:group-hover/title:text-primary-400 md:text-[1.7rem]">
              {post.title}
            </h2>
          </Link>
          {post.tags?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {post.tags.map(tag => (
                <TagItem key={tag} tag={tag} category={post.category} query={query} />
              ))}
            </div>
          )}
          <p className="mt-4 line-clamp-2 max-w-2xl text-sm leading-7 text-gray-500 dark:text-zinc-400 md:text-base">
            {post.summary}
          </p>
        </div>
        <Link
          className="home-post-arrow"
          href={post.slug}
          aria-label={`继续阅读《${post.title}》`}
        >
          <span aria-hidden="true">→</span>
        </Link>
      </article>
    </Reveal>
  )
}

export default BlogPost
