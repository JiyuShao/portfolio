import 'gitalk/dist/gitalk.css'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import { fetchCusdisLang } from '@/lib/cusdisLang'
import { useConfig } from '@/lib/config'
import useTheme from '@/lib/theme'

const GitalkComponent = dynamic(
  () => {
    return import('gitalk/dist/gitalk-component')
  },
  { ssr: false }
)
const UtterancesComponent = dynamic(
  () => {
    return import('@/components/Utterances')
  },
  { ssr: false }
)
const CusdisComponent = dynamic(
  () => {
    return import('react-cusdis').then(m => m.ReactCusdis)
  },
  { ssr: false }
)

const Comments = ({ frontMatter }) => {
  const router = useRouter()
  const BLOG = useConfig()
  const { theme } = useTheme()
  const sectionRef = useRef(null)
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    const section = sectionRef.current
    if (!section || shouldLoad) return undefined
    if (!('IntersectionObserver' in window)) {
      setShouldLoad(true)
      return undefined
    }
    const observer = new window.IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      { rootMargin: '500px 0px' }
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [shouldLoad])

  return (
    <section ref={sectionRef} className="article-comments">
      <header className="article-comments-header">
        <p>Discussion</p>
        <h2>留言与讨论</h2>
        <span>想法、补充和不同意见都欢迎。</span>
      </header>
      {!shouldLoad && BLOG.comment?.provider && (
        <button
          type="button"
          className="site-button site-button-ghost mt-6"
          onClick={() => setShouldLoad(true)}
        >
          加载评论
        </button>
      )}
      {shouldLoad && BLOG.comment && BLOG.comment.provider === 'gitalk' && (
        <GitalkComponent
          options={{
            id: frontMatter.id,
            title: frontMatter.title,
            clientID: BLOG.comment.gitalkConfig.clientID,
            clientSecret: BLOG.comment.gitalkConfig.clientSecret,
            repo: BLOG.comment.gitalkConfig.repo,
            owner: BLOG.comment.gitalkConfig.owner,
            admin: BLOG.comment.gitalkConfig.admin,
            distractionFreeMode: BLOG.comment.gitalkConfig.distractionFreeMode
          }}
        />
      )}
      {shouldLoad && BLOG.comment && BLOG.comment.provider === 'utterances' && (
        <UtterancesComponent issueTerm={frontMatter.slug} />
      )}
      {shouldLoad && BLOG.comment && BLOG.comment.provider === 'cusdis' && (
        <CusdisComponent
          lang={fetchCusdisLang(BLOG.lang)}
          attrs={{
            host: BLOG.comment.cusdisConfig.host,
            appId: BLOG.comment.cusdisConfig.appId,
            pageId: frontMatter.id,
            pageTitle: frontMatter.title,
            pageUrl: BLOG.link + router.asPath,
            theme,
          }}
        />
      )}
    </section>
  )
}

export default Comments
