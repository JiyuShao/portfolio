import Link from 'next/link'
import Image from 'next/image'
import BLOG from '@/blog.config'

export default function Hero () {
  const paths = [
    {
      number: '01',
      eyebrow: 'Notes',
      title: '博客笔记',
      description: '记录技术实践、硬件折腾和一路踩过的坑。',
      href: `${BLOG.path}/search?category=articles`,
      icon: '/images/blog.svg',
      alt: '',
      tone: 'notes'
    },
    {
      number: '02',
      eyebrow: 'Reading',
      title: '阅读记录',
      description: '收藏来自书、博客、播客与互联网的好内容。',
      href: BLOG.readingLink,
      icon: '/images/reading.svg',
      alt: '',
      tone: 'reading'
    },
    {
      number: '03',
      eyebrow: 'Projects',
      title: '开源与项目',
      description: '看看正在构建、试验和持续维护的东西。',
      href: BLOG.githubLink,
      icon: '/images/earth.svg',
      alt: '',
      tone: 'projects'
    }
  ]

  return (
    <section className="home-hero">
      <div className="home-hero-copy">
        <p className="mb-5 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.16em] text-primary-500 dark:text-primary-400">
          <span className="h-px w-8 bg-current" aria-hidden="true" />
          Builder · Reader · Note-taker
        </p>
        <h1 className="max-w-3xl font-serif text-[2.75rem] font-normal leading-[1.08] tracking-[-0.035em] text-gray-950 dark:text-zinc-50 sm:text-6xl lg:text-7xl">
          把好奇心，做成<br className="hidden sm:block" />可以复用的东西。
        </h1>
        <p className="mt-7 max-w-2xl text-base leading-8 text-gray-600 dark:text-zinc-400 sm:text-lg sm:leading-9">
          我是 Jiyu，也叫<span className="font-medium text-gray-800 dark:text-zinc-200">{BLOG.nickname}</span>。这里收录我在软件、硬件与个人知识管理上的实践，
          也保存一路读到、想到，并真正动手做过的内容。
        </p>
        <p className="mt-5 flex items-center gap-3 font-serif text-base italic tracking-[0.04em] text-gray-500 dark:text-zinc-400 sm:text-lg">
          <span className="h-px w-5 bg-primary-400" aria-hidden="true" />
          Real, Simple, Stupid.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-5">
          <Link
            href={`${BLOG.path}/search`}
            className="site-button site-button-primary group"
          >
            开始阅读
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
          <span className="text-sm text-gray-500 dark:text-zinc-500">不定期更新 · 长期维护</span>
        </div>
      </div>

      <div className="home-paths" aria-label="主要内容入口">
        {paths.map(path => (
          <Link
            key={path.title}
            href={path.href}
            className={`home-path home-path--${path.tone}`}
          >
            <span className="home-path-number">{path.number}</span>
            <span className="home-path-icon" aria-hidden="true">
              <Image src={path.icon} alt={path.alt} width="28" height="28" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.65rem] font-medium uppercase tracking-[0.14em] text-gray-400 dark:text-zinc-500">
                {path.eyebrow}
              </span>
              <span className="mt-1 block text-lg font-semibold tracking-tight text-gray-950 dark:text-zinc-50">
                {path.title}
              </span>
              <span className="mt-1 block text-sm leading-6 text-gray-500 dark:text-zinc-400">
                {path.description}
              </span>
            </span>
            <span className="home-path-arrow" aria-hidden="true">↗</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
