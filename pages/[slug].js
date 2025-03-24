import { clientConfig } from '@/lib/server/config'
import { transformToRecordMap, TYPE_TRANSFORM_MAP } from '@/lib/notion/transformToRecordMap'
import { useRouter } from 'next/router'
import cn from 'classnames'
import { getAllPosts, getPostBlocksWithChildren, getPostBlockOld } from '@/lib/notion'
import { useLocale } from '@/lib/locale'
import { useConfig, getConfig } from '@/lib/config'
import Container from '@/components/Container'
import Post from '@/components/Post'
import Comments from '@/components/Comments'

export default function BlogPost(props) {
  const { post, postBlocks, recordMapOld } = props
  const router = useRouter()
  const BLOG = useConfig()
  const locale = useLocale()

  // TODO: It would be better to render something
  if (router.isFallback) return null

  const fullWidth = post.fullWidth ?? false
  const recordMap = transformToRecordMap(postBlocks)

  globalThis.dataNew = recordMap;
  globalThis.dataOld = recordMapOld;
  globalThis.logUnimplementedBlocks = () => {
    const unimplementedBlocksNew = Object.values(recordMap.block)
      .map(block => block.value)
      .filter(block => !Object.keys(TYPE_TRANSFORM_MAP).includes(block.rawBlock.type)
      )
    console.log('### Unimplemented Blocks New', unimplementedBlocksNew)
    if (!recordMapOld) {
      return
    }
    const unimplementedBlocksOld = unimplementedBlocksNew.map(block => recordMapOld.block[block.id].value)
    console.log('### Unimplemented Blocks Old', unimplementedBlocksOld)
  }
  globalThis.logBlocksByType = (type) => {
    const unimplementedBlocksNew = Object.values(recordMap.block)
      .map(block => block.value)
      .filter(block => [type].includes(block.rawBlock.type)
      )
    console.log(`### Blocks(${type}) New`, unimplementedBlocksNew)
    if (!recordMapOld) {
      return
    }
    const unimplementedBlocksOld = unimplementedBlocksNew.map(block => recordMapOld.block[block.id].value)
    console.log(`### Blocks(${type}) Old`, unimplementedBlocksOld)
  }
  globalThis.logBlocksById = (id) => {
    const blockNew = recordMap.block[id].value
    console.log(`### Block(${id}) New`, blockNew)
    if (!recordMapOld) {
      return
    }
    const blockOld = recordMapOld.block[id].value
    console.log(`### Block(${id}) Old`, blockOld)
  }
  globalThis.logUnimplementedBlocks()

  return (
    <Container
      layout="blog"
      title={post.title}
      description={post.summary}
      slug={post.slug}
      // date={new Date(post.publishedAt).toISOString()}
      type="article"
      fullWidth={fullWidth}
    >
      <Post
        post={post}
        recordMap={recordMap}
        recordMapOld={recordMapOld}
        fullWidth={fullWidth}
      />

      {/* Back and Top */}
      <div
        className={cn(
          'px-4 flex justify-between font-medium text-gray-500 dark:text-gray-400 my-5',
          fullWidth ? 'md:px-24' : 'mx-auto max-w-3xl'
        )}
      >
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
    paths: posts.map(row => `${clientConfig.path}/${row.slug}`),
    fallback: true
  }
}

export async function getStaticProps({ params: { slug } }) {
  const posts = await getAllPosts({ includePages: true })
  const config = await getConfig()
  const post = posts.find(t => t.slug === slug)

  if (!post) return { notFound: true }

  const postBlocks = await getPostBlocksWithChildren(post.id)
  const postBlocksOld = !config.isProd ? await getPostBlockOld(post.id) : null

  return {
    props: {
      post,
      postBlocks,
      recordMapOld: postBlocksOld,
    },
    revalidate: 1
  }
}
