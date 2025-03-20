import * as api from '@/lib/server/notion-api'

export async function getPostBlocksWithChildren(id) {
  const hasChildrenQueue = [id]
  const finalResult = {
    [id]: {
      id: id,
      type: 'page',
      has_children: true,
      children: [],
    }
  }
  while (hasChildrenQueue.length > 0) {
    const currentId = hasChildrenQueue.shift()
    const result = await api.getPostBlocks(currentId)
    result['results'].forEach(block => {
      finalResult[block.id] = {
        ...block,
        children: []
      }
      finalResult[currentId].children.push(block.id)
      if (block.has_children) {
        hasChildrenQueue.push(block.id)
      }
    })
  }
  return Object.values(finalResult)
}
