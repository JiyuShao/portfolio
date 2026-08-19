import Link from 'next/link'
import { getContentCategoryHref } from '@/lib/content-categories'

const TagItem = ({ tag, category = 'all', query }) => (
  <Link
    href={getContentCategoryHref(category, { tag, query })}
    className="inline-flex rounded-full border border-gray-200 bg-white/60 px-2.5 py-1 text-xs font-medium text-gray-500 transition hover:border-primary-300 hover:text-primary-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:border-primary-800 dark:hover:text-primary-400"
  >
    <span className="whitespace-nowrap">
      {tag}
    </span>
  </Link>
)

export default TagItem
