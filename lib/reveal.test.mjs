import test from 'node:test'
import assert from 'node:assert/strict'

import { shouldDelayReveal } from './reveal.mjs'

test('content taller than the viewport is never hidden by scroll reveal', () => {
  assert.equal(shouldDelayReveal({
    top: 500,
    height: 12000,
    viewportHeight: 400
  }), false)
})

test('short elements below the fold still wait for scroll reveal', () => {
  assert.equal(shouldDelayReveal({
    top: 500,
    height: 180,
    viewportHeight: 400
  }), true)
})
