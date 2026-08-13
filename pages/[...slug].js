import { useRouter } from 'next/router'
import { useLocale } from '@/lib/locale'
import { useConfig } from '@/lib/config'
import Container from '@/components/Container'
import Post from '@/components/Post'
import Comments from '@/components/Comments'
import { getAllPosts, getPostBySlug } from '@/lib/manifest.mjs'

export default function BlogPost({ post, markdown, attachments }) {
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
      <Post post={post} markdown={markdown} attachments={attachments} />

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
  return {
    props: {
      post,
      markdown: item.body ?? '',
      attachments: item.attachments ?? []
    }
  }
}
