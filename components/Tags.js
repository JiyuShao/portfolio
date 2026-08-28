import { useState } from 'react'
import Link from 'next/link'
import { getContentCategoryHref } from '@/lib/content-categories'

const Tags = ({ tags, currentTag, categoryKey = 'all', label = '常用标签', query }) => {
  const [showAll, setShowAll] = useState(false)
  const [tagSearch, setTagSearch] = useState('')
  const tagCounts = { ...tags }
  if (currentTag && !(currentTag in tagCounts)) tagCounts[currentTag] = 0
  if (!Object.keys(tagCounts).length) return null

  const entries = Object.entries(tagCounts).sort((a, b) => {
    return b[1] - a[1] || a[0].localeCompare(b[0])
  })
  const compactLimit = 8
  // Notebook is an import/source marker rather than a useful discovery facet.
  // Keep it in the complete list and URL filters, but do not promote it above
  // subject tags in the compact view.
  const compactEntries = entries.filter(([tag]) => tag !== 'Notebook')
  const normalizedSearch = tagSearch.trim().toLocaleLowerCase('zh-CN')
  const filteredEntries = normalizedSearch
    ? entries.filter(([tag]) => tag.toLocaleLowerCase('zh-CN').includes(normalizedSearch))
    : entries
  let visibleEntries = showAll ? filteredEntries : compactEntries.slice(0, compactLimit)
  if (!showAll && currentTag && !visibleEntries.some(([tag]) => tag === currentTag)) {
    visibleEntries = [[currentTag, tagCounts[currentTag]], ...visibleEntries.slice(0, compactLimit - 1)]
  }
  const canExpand = entries.length > compactLimit

  return (
    <section className="tag-container mt-5" aria-labelledby="tag-filter-title">
      <div className="flex items-center justify-between gap-4">
        <p id="tag-filter-title" className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-zinc-500">
          {label}
        </p>
        {canExpand && (
          <button
            type="button"
            aria-expanded={showAll}
            aria-controls="tag-filter-list"
            className="site-button site-button-ghost site-button-compact"
            onClick={() => {
              setShowAll(value => !value)
              if (showAll) setTagSearch('')
            }}
          >
            {showAll ? '收起' : `全部 ${entries.length} 个`}
          </button>
        )}
      </div>
      {showAll && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-gray-200 bg-white/60 px-3 dark:border-zinc-800 dark:bg-zinc-900/50">
          <span aria-hidden="true" className="text-gray-400 dark:text-zinc-600">⌕</span>
          <input
            type="search"
            value={tagSearch}
            aria-label="筛选标签"
            placeholder="输入标签名称"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-gray-950 outline-none placeholder:text-gray-400 dark:text-zinc-50 dark:placeholder:text-zinc-600"
            onChange={event => setTagSearch(event.target.value)}
          />
          <span className="text-xs tabular-nums text-gray-400 dark:text-zinc-600">{filteredEntries.length}</span>
        </div>
      )}
      <ul
        id="tag-filter-list"
        className={`mt-3 flex flex-wrap gap-2 ${showAll ? 'tag-filter-list-expanded' : ''}`}
      >
        {visibleEntries.map(([key, count]) => {
          const selected = key === currentTag
          return (
            <li key={key}>
              <Link
                key={key}
                href={getContentCategoryHref(categoryKey, {
                  tag: selected ? undefined : key,
                  query
                })}
                aria-current={selected ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition ${selected
                  ? 'border-primary-500 bg-primary-500 text-white'
                  : 'border-gray-200 bg-white/60 text-gray-500 hover:border-primary-300 hover:text-primary-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:border-primary-800 dark:hover:text-primary-400'
                  }`}
              >
                <span># {key}</span>
                <span className={selected ? 'text-white/65' : 'text-gray-400 dark:text-zinc-600'}>{count}</span>
              </Link>
            </li>
          )
        })}
      </ul>
      {showAll && !visibleEntries.length && (
        <p className="mt-3 rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500 dark:border-zinc-800 dark:text-zinc-500">
          没有匹配的标签。
        </p>
      )}
    </section>
  )
}

export default Tags
