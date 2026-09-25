export function normalizeInternalPath (path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return null
  return path
}

export function canUseHistoryBack ({ previousPath, currentPath, historyLength }) {
  const safePreviousPath = normalizeInternalPath(previousPath)
  return Boolean(
    safePreviousPath &&
    safePreviousPath !== currentPath &&
    historyLength > 1
  )
}
