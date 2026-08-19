import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useConfig } from '@/lib/config'
import { useLocale } from '@/lib/locale'
import ThemeToggle from '@/components/ThemeToggle'

const NavBar = () => {
  const BLOG = useConfig()
  const locale = useLocale()
  const links = [
    { id: 0, name: locale.NAV.INDEX, to: `${BLOG.path}/search`, show: true },
    { id: 1, name: locale.NAV.READING, to: BLOG.readingLink, show: true, external: true }
  ]
  return (
    <nav className="flex-shrink-0" aria-label="主导航">
      <ul className="flex flex-row items-center gap-1">
        {links.map(
          link =>
            link.show && (
              <li key={link.id} className="nav">
                <Link
                  href={link.to}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noreferrer' : undefined}
                  className="inline-flex rounded-full px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                >
                  {link.name}
                </Link>
              </li>
            )
        )}
        <ThemeToggle />
      </ul>
    </nav>
  )
}

export default function Header({ navBarTitle }) {
  const BLOG = useConfig()

  // Favicon

  const resolveFavicon = fallback => !fallback && '/favicon.png'
  const [favicon, _setFavicon] = useState(resolveFavicon())
  const setFavicon = fallback => _setFavicon(resolveFavicon(fallback))

  useEffect(
    () => setFavicon(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const useSticky = !BLOG.autoCollapsedNavBar
  const navRef = useRef(/** @type {HTMLDivElement} */ undefined)
  const sentinelRef = useRef(/** @type {HTMLDivElement} */ undefined)
  const handler = useCallback(([entry]) => {
    if (useSticky && navRef.current) {
      navRef.current?.classList.toggle('sticky-nav', !entry.isIntersecting)
    } else {
      navRef.current?.classList.add('remove-sticky')
    }
  }, [useSticky])

  useEffect(() => {
    const sentinelEl = sentinelRef.current
    const observer = new window.IntersectionObserver(handler)
    observer.observe(sentinelEl)

    return () => {
      sentinelEl && observer.unobserve(sentinelEl)
    }
  }, [handler, sentinelRef])

  const titleRef = useRef(/** @type {HTMLParagraphElement} */ undefined)

  function handleClickHeader(/** @type {MouseEvent} */ ev) {
    if (![navRef.current, titleRef.current].includes(ev.target)) return

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  return (
    <>
      <div className="observer-element h-3 md:h-5" ref={sentinelRef}></div>
      <div
        className="sticky-nav group m-auto mb-2 flex h-[4.5rem] w-full max-w-5xl flex-row items-center justify-between px-5 sm:px-6 md:mb-8"
        id="sticky-nav"
        ref={navRef}
        onClick={handleClickHeader}
      >
        <Link href="/" className="flex items-center" aria-label={BLOG.title}>
          <Image
            className="rounded-full ring-1 ring-black/10 dark:ring-white/15"
            src={favicon}
            width={30}
            height={30}
            alt={BLOG.title}
            onError={() => setFavicon(true)}
          />
          <HeaderName
            ref={titleRef}
            siteTitle={BLOG.title}
            siteDescription={BLOG.nickname}
            postTitle={navBarTitle}
            onClick={handleClickHeader}
          />
        </Link>
        <NavBar />
      </div>
    </>
  )
}

const HeaderName = forwardRef(function HeaderName({ siteTitle, siteDescription, postTitle, onClick }, ref) {
  return (
    <p
      ref={ref}
      className="header-name ml-2 font-medium text-gray-600 dark:text-gray-300 capture-pointer-events grid-rows-1 grid-cols-1 items-center"
      onClick={onClick}
    >
      {postTitle && <span className="post-title row-start-1 col-start-1">{postTitle}</span>}
      <span className="row-start-1 col-start-1">
        <span className="site-title text-sm font-semibold tracking-tight text-gray-950 dark:text-zinc-50">{siteTitle}</span>
        <span className="site-description ml-2 text-xs font-normal tracking-[0.08em] text-gray-400 dark:text-zinc-500">{siteDescription}</span>
      </span>
    </p>
  )
})
