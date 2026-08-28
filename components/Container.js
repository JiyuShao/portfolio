import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { useConfig } from '@/lib/config'
import Head from 'next/head'
import PropTypes from 'prop-types'
import cn from 'classnames'
// import BlogPost from './BlogPost'

const Container = ({ children, layout, ...customMeta }) => {
  const BLOG = useConfig()

  const url = BLOG.path.length ? `${BLOG.link}/${BLOG.path}` : BLOG.link
  const meta = {
    title: BLOG.title,
    description: BLOG.description,
    image: BLOG.ogImage || '/favicon.png',
    type: 'website',
    ...customMeta
  }
  const documentTitle = meta.title === BLOG.title ? meta.title : `${meta.title} · ${BLOG.title}`
  const canonicalPath = meta.canonicalPath === false
    ? null
    : (meta.canonicalPath ?? meta.slug ?? '')
  const canonicalUrl = canonicalPath === null ? null : `${url}${canonicalPath}`
  const imageUrl = meta.image.startsWith('http') ? meta.image : `${url}${meta.image}`
  return (
    <div>
      <Head>
        <title>{documentTitle}</title>
        {/* <meta content={BLOG.darkBackground} name="theme-color" /> */}
        <meta name="robots" content={meta.noindex ? 'noindex, follow' : 'index, follow'} />
        <meta charSet="UTF-8" />
        {BLOG.seo.googleSiteVerification && (
          <meta
            name="google-site-verification"
            content={BLOG.seo.googleSiteVerification}
          />
        )}
        {BLOG.seo.keywords && (
          <meta name="keywords" content={BLOG.seo.keywords.join(', ')} />
        )}
        <meta name="description" content={meta.description} />
        <meta property="og:locale" content={BLOG.lang} />
        <meta property="og:site_name" content={BLOG.title} />
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
        <meta property="og:image" content={imageUrl} />
        <meta property="og:image:alt" content={meta.imageAlt || meta.title} />
        <meta property="og:type" content={meta.type} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:description" content={meta.description} />
        <meta name="twitter:title" content={meta.title} />
        <meta name="twitter:image" content={imageUrl} />
        {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
        {meta.type === 'article' && (
          <>
            <meta
              property="article:published_time"
              content={meta.date}
            />
            <meta property="article:author" content={BLOG.author} />
          </>
        )}
      </Head>
      <div
        className={`wrapper ${BLOG.font === 'serif' ? 'font-serif' : 'font-sans'
          }`}
      >
        <Header
          navBarTitle={layout === 'blog' ? meta.title : null}
        />
        <main className={cn(
          'flex-grow transition-all',
          layout !== 'blog' && [
            'self-center w-full px-5 sm:px-6',
            layout === 'home' ? 'max-w-5xl' : 'max-w-3xl'
          ]
        )}>
          {children}
        </main>
        <Footer />
      </div>
    </div>
  )
}

Container.propTypes = {
  children: PropTypes.node
}

export default Container
