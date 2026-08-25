import Link from 'next/link'
import { clientConfig } from '@/lib/server/config'

import Container from '@/components/Container'
import BlogPost from '@/components/BlogPost'
import Hero from '@/components/Hero'
import { getAllPosts } from '@/lib/manifest.mjs'
import { useConfig } from '@/lib/config'

export async function getStaticProps() {
  const posts = await getAllPosts({ includePages: false, includeArchive: false })
  const postsToShow = posts.slice(0, clientConfig.postsPerPage)
  const totalPosts = posts.length
  const showNext = totalPosts > clientConfig.postsPerPage
  return {
    props: {
      postsToShow,
      showNext
    }
  }
}

export default function Blog({ postsToShow, showNext }) {
  const { title, description } = useConfig()

  return (
    <Container title={title} description={description} layout="home">
      <Hero />
      <section className="home-posts" aria-labelledby="latest-posts">
        <div className="mb-4 flex items-end justify-between border-b border-gray-200 pb-4 dark:border-zinc-800 md:mb-6">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-primary-500 dark:text-primary-400">
              Latest notes
            </p>
            <h2 id="latest-posts" className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-zinc-50 md:text-3xl">
              最近在写
            </h2>
          </div>
          <span className="hidden text-sm text-gray-500 dark:text-zinc-500 sm:block">
            技术、硬件与知识系统
          </span>
        </div>
        <div className="home-post-list">
          {postsToShow.map((post, index) => (
            <BlogPost key={post.id} post={post} index={index + 1} />
          ))}
        </div>
      </section>
      {showNext && (
        <div className="mt-8 flex justify-end md:mt-10">
          <Link
            href="/search"
            className="site-button site-button-secondary group"
          >
            查看全部文章
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>
      )}
    </Container>
  )
}
