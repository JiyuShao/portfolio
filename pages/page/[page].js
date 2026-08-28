import { config } from '@/lib/server/config'

import Container from '@/components/Container'
import BlogPost from '@/components/BlogPost'
import Pagination from '@/components/Pagination'
import { getAllPosts } from '@/lib/manifest.mjs'

const Page = ({ postsToShow, page, showNext }) => {
  return (
    <Container
      title={`文章列表 · 第 ${page} 页`}
      description="历史分页入口，请使用内容索引继续浏览。"
      canonicalPath="/search?category=articles"
      noindex
    >
      {postsToShow &&
        postsToShow.map(post => <BlogPost key={post.id} post={post} />)}
      <Pagination page={page} showNext={showNext} />
    </Container>
  )
}

export async function getStaticProps (context) {
  const { page } = context.params // Get Current Page No.
  const posts = await getAllPosts({ includePages: false, includeArchive: false })
  const postsToShow = posts.slice(
    config.postsPerPage * (page - 1),
    config.postsPerPage * page
  )
  const totalPosts = posts.length
  const showNext = page * config.postsPerPage < totalPosts
  return {
    props: {
      page, // Current Page
      postsToShow,
      showNext
    }
  }
}

export async function getStaticPaths () {
  const posts = await getAllPosts({ includePages: false, includeArchive: false })
  const totalPosts = posts.length
  const totalPages = Math.ceil(totalPosts / config.postsPerPage)
  return {
    // remove first page, we 're not gonna handle that.
    paths: Array.from({ length: totalPages - 1 }, (_, i) => ({
      params: { page: '' + (i + 2) }
    })),
    fallback: false
  }
}

export default Page
