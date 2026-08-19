import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildContentIndexHref,
  countContentByCategory,
  filterContentPosts
} from './content-query.mjs'

const posts = [
  { category: 'archive', title: '旧笔记', summary: '', tags: ['个人笔记'] },
  { category: 'archive', title: '命令记录', summary: '', tags: ['Notebook'] },
  { category: 'topics', title: '专题笔记', summary: '', tags: ['个人笔记'] }
]

test('tag links preserve the active category', () => {
  assert.equal(
    buildContentIndexHref({ category: 'archive', tag: '个人笔记' }),
    '/search?category=archive&tag=%E4%B8%AA%E4%BA%BA%E7%AC%94%E8%AE%B0'
  )
})

test('content index links preserve category, tag, and search query', () => {
  assert.equal(
    buildContentIndexHref({
      category: 'archive',
      tag: '个人笔记',
      query: 'JSON Schema'
    }),
    '/search?category=archive&tag=%E4%B8%AA%E4%BA%BA%E7%AC%94%E8%AE%B0&q=JSON%20Schema'
  )
})

test('content filters intersect category and tag', () => {
  const result = filterContentPosts(posts, {
    category: 'archive',
    tag: '个人笔记'
  })
  assert.deepEqual(result.map(post => post.title), ['旧笔记'])
})

test('category counts become contextual when a tag is active', () => {
  assert.deepEqual(countContentByCategory(posts, { tag: '个人笔记' }), {
    all: 2,
    articles: 0,
    topics: 1,
    learning: 0,
    archive: 1
  })
})
