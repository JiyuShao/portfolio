import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'

/**
 * TOC list with scroll-spy. `variant="desktop"` is a sticky right sidebar,
 * `variant="mobile"` a collapsible box shown above the article.
 * The Post page renders the wrapper visibility classes, this stays layout-free.
 */
export default function Toc({ toc, variant = 'desktop' }) {
  const [activeId, setActiveId] = useState(null)
  const listRef = useRef(null)

  // Highlight the heading currently near the top of the viewport.
  useEffect(() => {
    if (variant !== 'desktop') return undefined
    const headings = toc.map(t => document.getElementById(t.id)).filter(Boolean)
    if (!headings.length) return undefined
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
            return
          }
        }
      },
      { rootMargin: '-10% 0px -75% 0px', threshold: 0 }
    )
    headings.forEach(h => observer.observe(h))
    return () => observer.disconnect()
  }, [toc, variant])

  const items = (
    <ol className="text-sm leading-relaxed">
      {toc.map(t => (
        <li
          key={t.id}
          className={t.depth === 1 ? 'font-medium' : 'font-normal'}
          style={{ paddingLeft: `${(t.depth - 1) * 0.75}rem` }}
        >
          <a
            href={`#${t.id}`}
            className={
              'block py-0.5 truncate border-l-2 pl-2 ' +
              (activeId === t.id
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-gray-100')
            }
          >
            {t.text}
          </a>
        </li>
      ))}
    </ol>
  )

  if (variant === 'mobile') {
    return (
      <details className="group rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
        <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          目录
        </summary>
        <div ref={listRef} className="border-t border-gray-200 px-4 py-2 dark:border-gray-700">
          {items}
        </div>
      </details>
    )
  }

  return (
    <nav aria-label="目录" className="pb-8">
      <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">目录</p>
      <div ref={listRef}>{items}</div>
    </nav>
  )
}

Toc.propTypes = {
  toc: PropTypes.arrayOf(
    PropTypes.shape({ id: PropTypes.string, text: PropTypes.string, depth: PropTypes.number })
  ).isRequired,
  variant: PropTypes.oneOf(['desktop', 'mobile'])
}
