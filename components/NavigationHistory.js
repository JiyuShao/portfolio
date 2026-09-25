import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import PropTypes from 'prop-types'
import { normalizeInternalPath } from '@/lib/navigation-history.mjs'

const NavigationHistoryContext = createContext({
  previousPath: null,
  navigateBack: () => {}
})

export function NavigationHistoryProvider ({ children }) {
  const router = useRouter()
  const [previousEntry, setPreviousEntry] = useState(null)
  const pendingScrollY = useRef(null)

  useEffect(() => {
    const rememberCurrentPath = () => {
      const currentPath = normalizeInternalPath(router.asPath)
      if (currentPath) {
        setPreviousEntry({ path: currentPath, scrollY: window.scrollY })
      }
    }
    const restorePreviousScroll = () => {
      if (pendingScrollY.current === null) return
      const scrollY = pendingScrollY.current
      pendingScrollY.current = null
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => window.scrollTo(0, scrollY))
      })
    }

    router.events.on('routeChangeStart', rememberCurrentPath)
    router.events.on('routeChangeComplete', restorePreviousScroll)
    return () => {
      router.events.off('routeChangeStart', rememberCurrentPath)
      router.events.off('routeChangeComplete', restorePreviousScroll)
    }
  }, [router])

  const navigateBack = useCallback(() => {
    pendingScrollY.current = previousEntry?.scrollY ?? 0
    router.back()
  }, [previousEntry, router])
  const value = useMemo(() => ({
    previousPath: previousEntry?.path ?? null,
    navigateBack
  }), [navigateBack, previousEntry])

  return (
    <NavigationHistoryContext.Provider value={value}>
      {children}
    </NavigationHistoryContext.Provider>
  )
}

NavigationHistoryProvider.propTypes = {
  children: PropTypes.node
}

export function useNavigationHistory () {
  return useContext(NavigationHistoryContext)
}
