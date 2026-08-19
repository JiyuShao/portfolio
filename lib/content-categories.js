import { buildContentIndexHref } from '@/lib/content-query.mjs'

export const CONTENT_CATEGORIES = [
  {
    key: 'all',
    label: '全部',
    eyebrow: 'Index',
    title: '所有内容',
    description: '文章、专题、学习记录与历史归档的完整索引。'
  },
  {
    key: 'articles',
    label: '文章',
    eyebrow: 'Articles',
    title: '文章',
    description: '相对完整的技术实践、复盘与长篇记录。'
  },
  {
    key: 'topics',
    label: '专题',
    eyebrow: 'Topics',
    title: '专题',
    description: '围绕同一主题持续积累的知识与研究。'
  },
  {
    key: 'learning',
    label: '学习',
    eyebrow: 'Learning',
    title: '学习',
    description: '正在学习、验证和逐步补全的过程笔记。'
  },
  {
    key: 'archive',
    label: '归档',
    eyebrow: 'Archive',
    title: '归档',
    description: '从旧知识库迁移而来的历史记录。'
  }
]

export function getContentCategory (key) {
  return CONTENT_CATEGORIES.find(category => category.key === key) || CONTENT_CATEGORIES[0]
}

export function getContentCategoryHref (key, { tag, query } = {}) {
  return buildContentIndexHref({ category: key, tag, query })
}
