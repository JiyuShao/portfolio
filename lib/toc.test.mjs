import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slugifyHeading, getToc } from './toc.mjs'

test('slugifyHeading keeps CJK and strips punctuation', () => {
  assert.equal(slugifyHeading('一、实现原理'), '一实现原理')
  assert.equal(slugifyHeading('npm install <PACKAGE>'), 'npm-install-package')
  assert.equal(slugifyHeading('！！'), 'section')
})

test('getToc extracts h1-h3 with depth and deduped ids', () => {
  const toc = getToc(['# 简介', '## 模块', '### 细节', '## 模块', '#### 忽略'].join('\n'))
  assert.deepEqual(
    toc.map(t => [t.depth, t.id]),
    [[1, '简介'], [2, '模块'], [3, '细节'], [2, '模块-2']]
  )
})

test('getToc skips a leading h1 duplicating the page title (plain text only)', () => {
  const toc = getToc('# 原理学习\n\n## 第二节', { title: '原理学习' })
  assert.deepEqual(toc.map(t => t.id), ['第二节'])
  // Markup headings are never deduped by the renderer, so neither here.
  const withCode = getToc('# 原理学习 `笔记`\n\n## 第二节', { title: '原理学习' })
  assert.deepEqual(withCode.map(t => t.text), ['原理学习 笔记', '第二节'])
})

test('getToc ignores # lines inside code fences and raw HTML blocks', () => {
  const md = [
    '```md',
    '# 假标题',
    '```',
    '',
    '<details>',
    '# 假标题2',
    '</details>',
    '',
    '# 真标题'
  ].join('\n')
  assert.deepEqual(getToc(md).map(t => t.id), ['真标题'])
})

test('getToc strips inline markdown from labels', () => {
  const toc = getToc('### npm install `<PACKAGE>`\n\n## [链接标题](https://x.com)\n\n## ![img](a.png) 文字')
  assert.deepEqual(toc.map(t => t.text), ['npm install <PACKAGE>', '链接标题', '文字'])
})
