import { getAllPosts, getAllTagsFromPosts, getCategoryCountsFromPosts } from '@/lib/manifest.mjs'
import SearchLayout from '@/layouts/search'

export default function Tag ({ tags, posts, currentTag, categoryCounts }) {
  return <SearchLayout tags={tags} posts={posts} currentTag={currentTag} categoryCounts={categoryCounts} />
}

export async function getStaticProps ({ params }) {
  const currentTag = params.tag
  const posts = await getAllPosts({ includePages: false })
  const tags = getAllTagsFromPosts(posts)
  const categoryCounts = getCategoryCountsFromPosts(posts)
  const filteredPosts = posts.filter(
    post => post && post.tags && post.tags.includes(currentTag)
  )
  return {
    props: {
      tags,
      posts: filteredPosts,
      currentTag,
      categoryCounts
    }
  }
}

export async function getStaticPaths () {
  const posts = await getAllPosts({ includePages: false })
  const tags = getAllTagsFromPosts(posts)
  return {
    paths: Object.keys(tags).map(tag => ({ params: { tag } })),
    fallback: false
  }
}
