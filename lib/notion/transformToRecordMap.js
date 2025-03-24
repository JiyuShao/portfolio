
export const TYPE_TRANSFORM_MAP = {
  'page': () => {
    return {
      type: 'page',
    }
  },
  'heading_1': () => {
    return {
      type: 'header',
    }
  },
  'heading_2': () => {
    return {
      type: 'sub_header',
    }
  },
  'heading_3': () => {
    return {
      type: 'sub_sub_header',
    }
  },
  'paragraph': () => {
    return {
      type: 'text',
    }
  },
  'bulleted_list_item': () => {
    return {
      type: 'bulleted_list',
    }
  },
  'numbered_list_item': () => {
    return {
      type: 'numbered_list',
    }
  },
  'toggle': () => {
    return {
      type: 'toggle',
    }
  },
  'code': (block) => {
    return {
      type: 'code',
      properties: {
        language: [
          [
            block.code.language
          ]
        ]
      }
    }
  },
  'bookmark': (block) => {
    return {
      type: 'bookmark',
      properties: {
        link: [
          [
            block.bookmark.url
          ]
        ],
      }
    }
  },
  'image': (block) => {
    return {
      type: 'image',
      ...transformToImage(block.image.file.url)
    }
  },
  'callout': (block) => {
    return {
      type: 'callout',
      format: {
        page_icon: block.callout.icon[block.callout.icon.type],
        block_color: block.callout.color,
      },
    }
  },
  'table': (block) => {
    return {
      type: 'table',
      'format': {
        table_block_column_order: Array.from({
          length: block.table.table_width
        },
          (_, i) => i.toString()
        ),
        table_block_column_format: {}
      },
    }
  },
  'table_row': (block) => {
    return {
      type: 'table_row',
      properties: block.table_row.cells.reduce((result, currentCell, i) => {
        return {
          ...result,
          [i.toString()]: transformToPropertiesTitle(currentCell)
        }
      }, {})
    }
  },
}

export const transformToRecordMap = (blocks) => {
  const pageId = blocks[0].id
  const newBlocks = blocks.reduce((result, block) => {
    try {
      let newBlock = {
        id: block.id,
        parent_id: block.parent?.page_id || block.parent?.block_id || null,
        parent_table: 'block',
        content: block.children,
        properties: {
          // page does not have rich_text
          title: transformToPropertiesTitle(block[block.type]?.rich_text)
        },
        rawBlock: block
      }
      if (TYPE_TRANSFORM_MAP[block.type]) {
        newBlock = deepMerge(newBlock, TYPE_TRANSFORM_MAP[block.type](block))
      }

      result[block.id] = {
        role: 'reader',
        value: newBlock
      }
      return result
    } catch (error) {
      console.error('Error transforming block:', block.id, block, error)
      return result
    }
  }, {})

  return {
    collection: {
      [pageId]: newBlocks[pageId]
    },
    block: newBlocks
  }
}

function deepMerge(target, ...sources) {
  sources.forEach(source => {
    Object.keys(source).forEach(key => {
      if (source[key] instanceof Object && !Array.isArray(source[key])) {
        if (!(key in target) || !(target[key] instanceof Object)) {
          target[key] = {};
        }
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    });
  });
  return target;
}


const transformToPropertiesTitle = (richText) => {
  return (richText || []).map(currentItem => {
    let currentTitleItem = [currentItem.plain_text]
    if (currentItem.annotations.code) {
      currentTitleItem.push([['c']])
    }
    return currentTitleItem
  })
}

const transformToImage = (url) => {
  const pathParts = url.split('?')[0].split('/');

  const spaceId = pathParts[3];
  const uuid = pathParts[4];
  const fileName = pathParts[5];

  const displaySource = `attachment:${uuid}:${fileName}`
  return {
    properties: {
      title: [[fileName]],
      source: [[displaySource]]
    },
    spaceId: spaceId
  };
}