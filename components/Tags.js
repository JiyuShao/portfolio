import { useState } from 'react'
import Link from 'next/link'
import { getContentCategoryHref } from '@/lib/content-categories'

const Tags = ({ tags, currentTag, categoryKey = 'all', label = '常用标签', query }) => {
  const [showAll, setShowAll] = useState(false)
  const tagCounts = { ...tags }
  if (currentTag && !(currentTag in tagCounts)) tagCounts[currentTag] = 0
  if (!Object.keys(tagCounts).length) return null

  const entries = Object.entries(tagCounts).sort((a, b) => {
    return b[1] - a[1] || a[0].localeCompare(b[0])
  })
  const compactLimit = 8
  let visibleEntries = showAll ? entries : entries.slice(0, compactLimit)
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
            className="site-button site-button-ghost site-button-compact"
            onClick={() => setShowAll(value => !value)}
          >
            {showAll ? '收起' : `全部 ${entries.length} 个`}
          </button>
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
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
    </section>
  )
}

export default Tags
