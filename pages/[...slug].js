import Link from 'next/link'
import { useRouter } from 'next/router'
import { useLocale } from '@/lib/locale'
import { useConfig } from '@/lib/config'
import Container from '@/components/Container'
import Post from '@/components/Post'
import Comments from '@/components/Comments'
import ReadingProgress from '@/components/ReadingProgress'
import Reveal from '@/components/Reveal'
import { getAllPosts, getPostBySlug } from '@/lib/manifest.mjs'
import { getToc } from '@/lib/toc.mjs'

export default function BlogPost({ post, markdown, attachments, toc, prev, next }) {
  const router = useRouter()
  const BLOG = useConfig()
  const locale = useLocale()

  return (
    <Container
      layout="blog"
      title={post.title}
      description={post.summary}
      slug={post.slug}
      type="article"
    >
      <ReadingProgress />

      <Post post={post} markdown={markdown} attachments={attachments} toc={toc} />

      {/* Back and Top */}
      <div className="px-4 flex justify-between font-medium text-gray-500 dark:text-gray-400 my-5 mx-auto max-w-3xl">
        <a>
          <button
            onClick={() => router.push(BLOG.path || '/')}
            className="mt-2 cursor-pointer hover:text-black dark:hover:text-gray-100"
          >
            ← {locale.POST.BACK}
          </button>
        </a>
        <a>
          <button
            onClick={() => window.scrollTo({
              top: 0,
              behavior: 'smooth'
            })}
            className="mt-2 cursor-pointer hover:text-black dark:hover:text-gray-100"
          >
            ↑ {locale.POST.TOP}
          </button>
        </a>
      </div>

      {/* Prev / Next */}
      <Reveal className="mx-auto max-w-3xl px-4 mb-6 grid gap-4 sm:grid-cols-2">
        {prev ? (
          <Link href={prev.slug} className="block rounded-lg border border-gray-200 p-3 hover:border-primary-400 dark:border-zinc-700 dark:hover:border-primary-500">
            <p className="text-xs text-gray-500 dark:text-gray-400">← 上一篇</p>
            <p className="truncate font-medium text-gray-900 dark:text-gray-100">{prev.title}</p>
          </Link>
        ) : <span className="hidden sm:block" />}
        {next && (
          <Link href={next.slug} className="block rounded-lg border border-gray-200 p-3 text-right hover:border-primary-400 dark:border-zinc-700 dark:hover:border-primary-500">
            <p className="text-xs text-gray-500 dark:text-gray-400">下一篇 →</p>
            <p className="truncate font-medium text-gray-900 dark:text-gray-100">{next.title}</p>
          </Link>
        )}
      </Reveal>

      <Comments frontMatter={post} />
    </Container>
  )
}

export async function getStaticPaths() {
  const posts = await getAllPosts({ includePages: true })
  return {
    paths: posts.map(p => ({ params: { slug: p.slug.split('/').filter(Boolean) } })),
    fallback: false
  }
}

export async function getStaticProps({ params: { slug } }) {
  const { post, item } = await getPostBySlug('/' + slug.join('/'))
  if (!post) return { notFound: true }
  const markdown = item.body ?? ''
  const posts = await getAllPosts({ includePages: true })
  const index = posts.findIndex(p => p.slug === post.slug)
  return {
    props: {
      post,
      markdown,
      attachments: item.attachments ?? [],
      toc: getToc(markdown, { title: post.title }),
      prev: index > 0 ? posts[index - 1] : null,
      next: index >= 0 && index < posts.length - 1 ? posts[index + 1] : null
    }
  }
}
