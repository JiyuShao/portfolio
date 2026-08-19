import Link from 'next/link'
import { useConfig } from '@/lib/config'
import { useLocale } from '@/lib/locale'

const Pagination = ({ page, showNext }) => {
  const BLOG = useConfig()
  const locale = useLocale()
  const currentPage = +page
  let additionalClassName = 'justify-between'
  if (currentPage === 1 && showNext) additionalClassName = 'justify-end'
  if (currentPage !== 1 && !showNext) additionalClassName = 'justify-start'
  return (
    <div
      className={`mt-10 flex gap-3 ${additionalClassName}`}
    >
      {currentPage !== 1 && (
        <Link
          href={
            currentPage - 1 === 1
              ? `${BLOG.path}/`
              : `/page/${currentPage - 1}`
          }
          rel="prev"
          className="site-button site-button-secondary"
        >
          ← {locale.PAGINATION.PREV}
        </Link>
      )}
      {showNext && (
        <Link
          href={`/page/${currentPage + 1}`}
          rel="next"
          className="site-button site-button-secondary"
        >
          {locale.PAGINATION.NEXT} →
        </Link>
      )}
    </div>
  )
}

export default Pagination
