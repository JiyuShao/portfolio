import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import BlogPost from '@/components/BlogPost'
import Container from '@/components/Container'
import Tags from '@/components/Tags'
import PropTypes from 'prop-types'
import { CONTENT_CATEGORIES, getContentCategory, getContentCategoryHref } from '@/lib/content-categories'
import { countContentByCategory, filterContentPosts, normalizeQueryValue } from '@/lib/content-query.mjs'

const SearchLayout = ({ tags, posts, currentTag, categoryCounts }) => {
  const router = useRouter()
  const categoryQuery = normalizeQueryValue(router.query.category)
  const activeTag = currentTag || normalizeQueryValue(router.query.tag)
  const queryFromUrl = normalizeQueryValue(router.query.q) || ''
  const [searchValue, setSearchValue] = useState(queryFromUrl)
  const searchInputRef = useRef(null)
  const activeCategory = getContentCategory(categoryQuery).key
  const category = getContentCategory(activeCategory)
  const categoryPosts = filterContentPosts(posts, { category: activeCategory })
  const tagFilteredPosts = filterContentPosts(posts, {
    category: activeCategory,
    tag: activeTag
  })
  const visibleCategoryCounts = activeTag
    ? countContentByCategory(posts, { tag: activeTag })
    : categoryCounts
  const scopedTags = activeCategory === 'all'
    ? tags
    : categoryPosts.reduce((counts, post) => {
      post.tags.forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1
      })
      return counts
    }, {})
  const filteredBlogPosts = filterContentPosts(posts, {
    category: activeCategory,
    tag: activeTag,
    search: searchValue
  })

  useEffect(() => {
    if (router.isReady) setSearchValue(queryFromUrl)
  }, [queryFromUrl, router.isReady])

  useEffect(() => {
    if (!router.isReady || searchValue === queryFromUrl) return
    const timeout = window.setTimeout(() => {
      router.replace(
        getContentCategoryHref(activeCategory, {
          tag: activeTag,
          query: searchValue
        }),
        undefined,
        { shallow: true, scroll: false }
      )
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [activeCategory, activeTag, queryFromUrl, router, searchValue])

  useEffect(() => {
    const handleShortcut = event => {
      const target = event.target
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
      if (event.key === '/' && !isTyping) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
      if (event.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchValue('')
        searchInputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  return (
    <Container>
      <header className="mb-8 pt-8 md:mb-10 md:pt-12">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-primary-500 dark:text-primary-400">
          {currentTag ? 'Tag' : category.eyebrow}
        </p>
        <h1 className="font-serif text-4xl font-normal tracking-tight text-gray-950 dark:text-zinc-50 md:text-5xl">
          {currentTag ? `#${currentTag}` : category.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-500 dark:text-zinc-500">
          {currentTag
            ? `${posts.length} 篇相关记录`
            : activeTag
              ? `${category.description} 当前进一步筛选 #${activeTag}。`
              : category.description}
        </p>
      </header>
      <nav className="border-b border-gray-200 dark:border-zinc-800" aria-label="内容分类">
        <ul className="flex max-w-full gap-6 overflow-x-auto sm:gap-8">
          {CONTENT_CATEGORIES.map(item => {
            const selected = item.key === activeCategory
            return (
              <li key={item.key} className="flex-none">
                <Link
                  href={getContentCategoryHref(item.key, {
                    tag: activeTag,
                    query: searchValue
                  })}
                  aria-current={selected ? 'page' : undefined}
                  className={`relative flex items-baseline gap-1.5 pb-3 text-sm font-semibold whitespace-nowrap transition ${selected
                    ? 'text-gray-950 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary-500 dark:text-zinc-50'
                    : 'text-gray-500 hover:text-gray-800 dark:text-zinc-500 dark:hover:text-zinc-200'
                    }`}
                >
                  <span>{item.label}</span>
                  <span className={`text-[0.68rem] font-medium tabular-nums ${selected ? 'text-primary-500 dark:text-primary-400' : 'text-gray-400 dark:text-zinc-600'}`}>
                    {visibleCategoryCounts[item.key] ?? 0}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="group relative border-b border-gray-200 transition-colors focus-within:border-primary-500 dark:border-zinc-800 dark:focus-within:border-primary-400">
        <svg
          className="pointer-events-none absolute left-0 top-5 h-5 w-5 text-gray-400 transition-colors group-focus-within:text-primary-500 dark:text-zinc-600 dark:group-focus-within:text-primary-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
        </svg>
        <input
          ref={searchInputRef}
          type="search"
          aria-label="搜索内容"
          placeholder={activeTag ? `在${category.title}的 #${activeTag} 中搜索` : `在${category.title}中搜索标题、摘要或标签`}
          value={searchValue}
          className="block w-full bg-transparent py-4 pl-9 pr-16 text-base text-gray-950 outline-none placeholder:text-gray-400 dark:text-zinc-50 dark:placeholder:text-zinc-500"
          onChange={e => setSearchValue(e.target.value)}
        />
        {searchValue
          ? (
            <button
              type="button"
              aria-label="清除搜索"
              className="site-button site-button-ghost site-button-compact absolute right-0 top-3"
              onClick={() => {
                setSearchValue('')
                searchInputRef.current?.focus()
              }}
            >
              清除
            </button>
            )
          : (
            <kbd className="pointer-events-none absolute right-0 top-4 hidden rounded border border-gray-200 px-2 py-0.5 font-sans text-[0.65rem] text-gray-400 dark:border-zinc-800 dark:text-zinc-600 sm:block">
              /
            </kbd>
            )}
      </div>
      <Tags
        tags={scopedTags}
        currentTag={activeTag}
        categoryKey={activeCategory}
        label={activeCategory === 'all' ? '常用标签' : `${category.label}标签`}
        query={searchValue}
      />
      <div className="mt-10 flex items-center justify-between border-b border-gray-200 pb-3 text-xs font-medium uppercase tracking-[0.14em] text-gray-400 dark:border-zinc-800 dark:text-zinc-500">
        <span>{searchValue
          ? `找到 ${filteredBlogPosts.length} 条`
          : activeTag
            ? `#${activeTag} · ${tagFilteredPosts.length} 条内容`
            : `${categoryPosts.length} 条内容`}</span>
        <span>最新优先</span>
      </div>
      <div className="article-container home-post-list">
        {!filteredBlogPosts.length && (
          <p className="rounded-2xl border border-dashed border-gray-300 px-5 py-10 text-center text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
            {searchValue
              ? '没有找到匹配的内容。'
              : activeTag
                ? `“${category.title}”中没有 #${activeTag} 相关内容。`
                : `“${category.title}”中暂时还没有内容。`}
          </p>
        )}
        {filteredBlogPosts.map(post => (
          <BlogPost key={post.id} post={post} currentTag={activeTag} query={searchValue} />
        ))}
      </div>
    </Container>
  )
}
SearchLayout.propTypes = {
  posts: PropTypes.array.isRequired,
  tags: PropTypes.object.isRequired,
  categoryCounts: PropTypes.object.isRequired,
  currentTag: PropTypes.string
}
export default SearchLayout
