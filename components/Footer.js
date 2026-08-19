import { useConfig } from '@/lib/config'
import Link from 'next/link'

const Footer = () => {
  const BLOG = useConfig()

  const d = new Date()
  const y = d.getFullYear()
  const from = +BLOG.since
  return (
    <footer className="m-auto mt-16 w-full max-w-5xl flex-shrink-0 px-5 pb-8 text-gray-500 transition-all dark:text-zinc-500 sm:px-6 md:mt-24">
      <div className="flex flex-col gap-5 border-t border-gray-200 pt-6 text-sm leading-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-gray-700 dark:text-zinc-300">持续构建，持续记录。</p>
          <p>© {BLOG.author} {from === y || !from ? y : `${from} – ${y}`}</p>
        </div>
        <div className="flex items-center gap-5">
          <Link className="transition hover:text-gray-950 dark:hover:text-zinc-50" href={BLOG.githubLink} target="_blank" rel="noreferrer">GitHub</Link>
          <Link className="transition hover:text-gray-950 dark:hover:text-zinc-50" href={`mailto:${BLOG.email}`}>Email</Link>
          <Link className="transition hover:text-gray-950 dark:hover:text-zinc-50" href="/search?category=archive">Archive</Link>
        </div>
      </div>
    </footer>
  )
}

export default Footer
