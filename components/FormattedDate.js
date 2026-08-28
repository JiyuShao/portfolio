import { useConfig } from '@/lib/config'

const formatters = new Map()

function getFormatter (lang) {
  if (!formatters.has(lang)) {
    formatters.set(lang, new Intl.DateTimeFormat(lang, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      // Publication dates are date-only values. Keeping them in UTC prevents
      // readers west of UTC from seeing the previous calendar day.
      timeZone: 'UTC'
    }))
  }
  return formatters.get(lang)
}

export default function FormattedDate ({ date }) {
  const lang = useConfig().lang || 'zh-CN'
  return <span>{getFormatter(lang).format(new Date(date))}</span>
}
