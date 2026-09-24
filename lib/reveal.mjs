/**
 * Decide whether an element that starts below the fold should wait for an
 * IntersectionObserver before becoming visible.
 */
export function shouldDelayReveal({ top, height, viewportHeight }) {
  // A reveal threshold is based on the element's total area. For a long-form
  // article, the required visible slice can be taller than the viewport, so
  // the observer would never reveal it. Long content should stay readable.
  return height <= viewportHeight && top >= viewportHeight - 24
}

export const REVEAL_INTERSECTION_THRESHOLD = 0.05
