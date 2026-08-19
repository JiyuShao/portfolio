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
    <ol className="toc-list">
      {toc.map(t => (
        <li
          key={t.id}
          className={t.depth === 1 ? 'toc-item toc-item-root' : 'toc-item'}
          style={{ paddingLeft: `${(t.depth - 1) * 0.75}rem` }}
        >
          <a
            href={`#${t.id}`}
            className={
              'toc-link ' +
              (activeId === t.id
                ? 'toc-link-active'
                : '')
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
      <details className="article-toc-mobile group">
        <summary>
          <span className="flex items-center gap-3">
            <span className="article-toc-icon" aria-hidden="true">≡</span>
            本文目录
          </span>
          <span className="text-xs font-normal text-gray-400 dark:text-zinc-500">{toc.length} 节</span>
        </summary>
        <div ref={listRef} className="article-toc-mobile-list">
          {items}
        </div>
      </details>
    )
  }

  return (
    <nav aria-label="目录" className="article-toc-desktop">
      <p className="article-toc-eyebrow">On this page</p>
      <div className="mb-4 flex items-baseline justify-between">
        <p className="font-serif text-lg font-normal text-gray-950 dark:text-zinc-50">本文目录</p>
        <span className="text-xs text-gray-400 dark:text-zinc-600">{toc.length}</span>
      </div>
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
