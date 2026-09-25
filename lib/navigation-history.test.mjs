import test from 'node:test'
import assert from 'node:assert/strict'

import { canUseHistoryBack, normalizeInternalPath } from './navigation-history.mjs'

test('normalizes only same-site paths', () => {
  assert.equal(normalizeInternalPath('/search?category=learning&tag=video'), '/search?category=learning&tag=video')
  assert.equal(normalizeInternalPath('https://example.com/search'), null)
  assert.equal(normalizeInternalPath('//example.com/search'), null)
  assert.equal(normalizeInternalPath(undefined), null)
})

test('uses browser history only for a distinct tracked internal page', () => {
  assert.equal(canUseHistoryBack({
    previousPath: '/search?category=learning&tag=video',
    currentPath: '/learning/streaming',
    historyLength: 2
  }), true)
  assert.equal(canUseHistoryBack({
    previousPath: null,
    currentPath: '/learning/streaming',
    historyLength: 2
  }), false)
  assert.equal(canUseHistoryBack({
    previousPath: '/learning/streaming',
    currentPath: '/learning/streaming',
    historyLength: 2
  }), false)
  assert.equal(canUseHistoryBack({
    previousPath: '/search?category=learning',
    currentPath: '/learning/streaming',
    historyLength: 1
  }), false)
})
