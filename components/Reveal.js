import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'

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
    if (el.getBoundingClientRect().top < window.innerHeight - 24) return
    setHidden(true)
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHidden(false)
          observer.disconnect()
        }
      },
      { threshold: 0.05, rootMargin: '0px 0px -5% 0px' }
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
