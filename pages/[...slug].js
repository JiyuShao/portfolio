import Link from 'next/link'
import Container from '@/components/Container'
import Post from '@/components/Post'
import Comments from '@/components/Comments'
import ReadingProgress from '@/components/ReadingProgress'
import Reveal from '@/components/Reveal'
import { getAllPosts, getPostBySlug } from '@/lib/manifest.mjs'
import { getToc } from '@/lib/toc.mjs'
import { getOgImagePath, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/lib/og-card.mjs'

export default function BlogPost({ post, markdown, attachments, toc, prev, next }) {
  return (
    <Container
      layout="blog"
      title={post.title}
      description={post.summary}
      slug={post.slug}
      type="article"
      date={new Date(post.date).toISOString()}
      category={post.category}
      tags={post.tags}
      image={getOgImagePath(post.slug)}
      imageWidth={OG_IMAGE_WIDTH}
      imageHeight={OG_IMAGE_HEIGHT}
      imageType="image/png"
    >
      <ReadingProgress />

      <Post post={post} markdown={markdown} attachments={attachments} toc={toc} />

      <div className="article-after">
        <div className="article-tools">
          <Link href="/" className="site-button site-button-ghost site-button-compact">
            <span aria-hidden="true">←</span> 返回首页
          </Link>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="site-button site-button-ghost site-button-compact"
          >
            回到顶部 <span aria-hidden="true">↑</span>
          </button>
        </div>
      </div>

      <Reveal className="article-pagination">
        {prev ? (
          <Link href={prev.slug} className="article-nav-card article-nav-card-prev">
            <span className="article-nav-arrow" aria-hidden="true">←</span>
            <span>
              <span className="article-nav-label">上一篇</span>
              <span className="article-nav-title">{prev.title}</span>
            </span>
          </Link>
        ) : <span className="hidden sm:block" aria-hidden="true" />}
        {next && (
          <Link href={next.slug} className="article-nav-card article-nav-card-next">
            <span>
              <span className="article-nav-label">下一篇</span>
              <span className="article-nav-title">{next.title}</span>
            </span>
            <span className="article-nav-arrow" aria-hidden="true">→</span>
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
