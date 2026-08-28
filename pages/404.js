import { useLocale } from '@/lib/locale'
import Container from '@/components/Container'
import Link from 'next/link'

export default function Page404 () {
  const locale = useLocale()

  return (
    <Container
      title="页面不存在"
      description="这个页面不存在，可以返回首页或继续浏览内容索引。"
      noindex
      canonicalPath={false}
    >
      <section className="flex min-h-[58vh] flex-col items-center justify-center py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-500 dark:text-primary-400">
          Lost, but not stuck
        </p>
        <h1 className="mt-4 font-serif text-7xl font-normal tracking-[-0.06em] text-gray-950 dark:text-zinc-50 sm:text-8xl">
          404
        </h1>
        <p className="mt-4 text-xl text-gray-700 dark:text-zinc-300">{locale.PAGE.ERROR_404.MESSAGE}</p>
        <p className="mt-3 max-w-md text-sm leading-7 text-gray-500 dark:text-zinc-500">
          链接可能已经移动，也可能只是走进了一条还没写下来的路。
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="site-button site-button-primary">返回首页</Link>
          <Link href="/search" className="site-button site-button-secondary">浏览内容索引</Link>
        </div>
      </section>
    </Container>
  )
}
