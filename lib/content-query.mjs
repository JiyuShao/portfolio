const CATEGORY_KEYS = ['articles', 'topics', 'learning', 'archive']

export function normalizeQueryValue(value) {
  return Array.isArray(value) ? value[0] : value
}

export function buildContentIndexHref({ category = 'all', tag, query } = {}) {
  const queryParts = []
  if (CATEGORY_KEYS.includes(category)) {
    queryParts.push(`category=${encodeURIComponent(category)}`)
  }
  if (typeof tag === 'string' && tag.trim()) {
    queryParts.push(`tag=${encodeURIComponent(tag.trim())}`)
  }
  if (typeof query === 'string' && query.trim()) {
    queryParts.push(`q=${encodeURIComponent(query.trim())}`)
  }
  return queryParts.length ? `/search?${queryParts.join('&')}` : '/search'
}

export function filterContentPosts(posts, { category = 'all', tag, search = '' } = {}) {
  const normalizedSearch = search.trim().toLowerCase()
  return posts.filter(post => {
    if (category !== 'all' && post.category !== category) return false
    if (tag && !post.tags?.includes(tag)) return false
    if (!normalizedSearch) return true

    const searchContent = [post.title, post.summary, ...(post.tags || [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return searchContent.includes(normalizedSearch)
  })
}

export function countContentByCategory(posts, { tag } = {}) {
  const scopedPosts = tag
    ? posts.filter(post => post.tags?.includes(tag))
    : posts
  const counts = {
    all: scopedPosts.length,
    articles: 0,
    topics: 0,
    learning: 0,
    archive: 0
  }

  scopedPosts.forEach(post => {
    if (CATEGORY_KEYS.includes(post.category)) counts[post.category]++
  })
  return counts
}
