import Link from 'next/link'
import { useRouter } from 'next/router'
import PropTypes from 'prop-types'
import { useNavigationHistory } from '@/components/NavigationHistory'
import { canUseHistoryBack } from '@/lib/navigation-history.mjs'

function isPlainPrimaryClick (event) {
  return event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
}

export default function ArticleBackLink ({ fallbackHref, fallbackLabel, className }) {
  const router = useRouter()
  const { previousPath, navigateBack } = useNavigationHistory()
  const hasTrackedPreviousPage = canUseHistoryBack({
    previousPath,
    currentPath: router.asPath,
    historyLength: typeof window === 'undefined' ? 1 : window.history.length
  })

  const handleClick = event => {
    if (!isPlainPrimaryClick(event) || !hasTrackedPreviousPage) return
    event.preventDefault()
    navigateBack()
  }

  return (
    <Link href={fallbackHref} className={className} onClick={handleClick}>
      <span aria-hidden="true">←</span>
      {hasTrackedPreviousPage ? '返回上一页' : fallbackLabel}
    </Link>
  )
}

ArticleBackLink.propTypes = {
  fallbackHref: PropTypes.string.isRequired,
  fallbackLabel: PropTypes.string.isRequired,
  className: PropTypes.string
}
