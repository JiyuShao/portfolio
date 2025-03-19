export const transformToRecordMap = (blocks) => {
  const pageId = blocks[0].id
  const newBlocks = blocks.reduce((result, block) => {
    let newBlock = { id: block.id, parent_id: block.parent?.page_id || block.parent?.block_id || null, content: block.children, rawBlock: block }
    if (block.type === 'page') {
      newBlock.type = 'page'
    } else if (block.type === 'heading_1') {
      newBlock.type = 'header'
      newBlock.properties = {
        title: transformRichTextToTitle(block.heading_1.rich_text)
      }
    } else if (block.type === 'heading_2') {
      newBlock.type = 'sub_header'
      newBlock.properties = {
        title: transformRichTextToTitle(block.heading_2.rich_text)
      }
    } else if (block.type === 'heading_3') {
      newBlock.type = 'sub_sub_header'
      newBlock.properties = {
        title: transformRichTextToTitle(block.heading_3.rich_text)
      }
    } else if (block.type === 'paragraph') {
      newBlock.type = 'text'
      newBlock.properties = {
        title: transformRichTextToTitle(block.paragraph.rich_text)
      }
    } else if (block.type === 'bulleted_list_item') {
      newBlock.type = 'bulleted_list'
      newBlock.properties = {
        title: transformRichTextToTitle(block.bulleted_list_item.rich_text)
      }
    } else if (block.type === 'toggle') {
      newBlock.type = 'toggle'
      newBlock.properties = {
        title: transformRichTextToTitle(block.toggle.rich_text),
      }
    }

    result[block.id] = {
      role: 'reader',
      value: newBlock
    }
    return result
  }, {})
  return {
    collection: {
      [pageId]: newBlocks[pageId]
    },
    block: newBlocks
  }
}

const transformRichTextToTitle = (richText) => {
  return richText.map(currentItem => {
    let currentTitleItem = [currentItem.plain_text]
    if (currentItem.annotations.code) {
      currentTitleItem.push([['c']])
    }
    return currentTitleItem
  })
}
