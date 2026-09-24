import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import {
  REVEAL_INTERSECTION_THRESHOLD,
  shouldDelayReveal
} from '@/lib/reveal.mjs'

/**
 * Scroll-reveal wrapper: content starts visible (SSR/SEO/no-JS safe); when the
 * element is below the fold on mount, it hides and fades up once it scrolls
 * into view. Honors prefers-reduced-motion via CSS.
 */
export default function Reveal({ children, className }) {
  const ref = useRef(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const { top, height } = el.getBoundingClientRect()
    if (!shouldDelayReveal({ top, height, viewportHeight: window.innerHeight })) return
    setHidden(true)
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHidden(false)
          observer.disconnect()
        }
      },
      { threshold: REVEAL_INTERSECTION_THRESHOLD, rootMargin: '0px 0px -5% 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={`${hidden ? 'reveal-hide' : ''} ${className ?? ''}`}>
      {children}
    </div>
  )
}

Reveal.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string
}
