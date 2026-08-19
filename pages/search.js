import { getAllPosts, getAllTagsFromPosts, getCategoryCountsFromPosts } from '@/lib/manifest.mjs'
import SearchLayout from '@/layouts/search'

export default function Search ({ tags, posts, categoryCounts }) {
  return <SearchLayout tags={tags} posts={posts} categoryCounts={categoryCounts} />
}
export async function getStaticProps () {
  const posts = await getAllPosts({ includePages: false })
  const tags = getAllTagsFromPosts(posts)
  const categoryCounts = getCategoryCountsFromPosts(posts)
  return {
    props: {
      tags,
      posts,
      categoryCounts
    }
  }
}
