
export const TYPE_TRANSFORM_MAP = {
  'page': () => {
    return {
      type: 'page',
    }
  },
  'heading_1': (block) => {
    return {
      type: 'header',
    }
  },
  'heading_2': (block) => {
    return {
      type: 'sub_header',
    }
  },
  'heading_3': (block) => {
    return {
      type: 'sub_sub_header',
    }
  },
  'paragraph': (block) => {
    return {
      type: 'text',
    }
  },
  'bulleted_list_item': (block) => {
    return {
      type: 'bulleted_list',
    }
  },
  'toggle': (block) => {
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
}

export const transformToRecordMap = (blocks) => {
  const pageId = blocks[0].id
  const newBlocks = blocks.reduce((result, block) => {
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

// 把 "https://prod-files-secure.s3.us-west-2.amazonaws.com/6e1664a6-54f4-4dec-8dd1-868c4c0cf7ea/fc287258-f0ef-4da6-a146-db58a8dddb3c/image.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=ASIAZI2LB4662XHJHOJR%2F20250320%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20250320T085415Z&X-Amz-Expires=3600&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEDEaCXVzLXdlc3QtMiJGMEQCIFVgZZ9zVgaOxEiwgDEZuQyTBHryFP5nTIqpFV%2BQk%2FdpAiBCugbqtDjxg8k8YORyfOkCBrrvMnJEFXfWJEsj6lQyWSqIBAiK%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F8BEAAaDDYzNzQyMzE4MzgwNSIM6jOuUW7qgGikO7j1KtwDh4fTjpnIMBMyHN0zhHRiHJjp4ey9CfAite1xRlh5ZddynQYPzMpgZl%2F6hkrOFjaM0PJtd%2Bhif4zOpTuFwh1W4B6Lml6FTYugfRGB3eJ0kwPoJDZkmrqne7%2BaIMDPfkDLE9f8PPQLB4cca0vUN%2BYJeQnJ6ytii3xaFW85icGmisi5cOS8ku%2BB4CbbSjcnj8p1X6klD7HNyLH6FMBnDveEl69bAUbme0Zu%2BjD96tlP2Ivp5atMSE%2BlMXKJH5Az2J71DODoekKgoffLnDVHFWCbDnX4ntpGS98UpnfyPAxeqDymyfvf%2Fu05GBkZqdlfplJ5SrWs8GzsORtD7hY1%2BMY%2Fbx7hjdV7fdsvCFOxXRjqxs%2B8Cx%2BPOL3oWhWuF3U5A4u1pWU1R25fj33TioWROMSGNAXgwyAd7yFMdFZz%2BTG0JfYEzsd0ZuzWKRlTdeUY5e9g8hWmFUAfNJwgaqZ9dw%2BoyFAOloeIDLuXnyDaIKraDxWGKhc5%2FO4YF0PdDkUsge3wiguxekiEt6HtFNuaCVFUaEiVDIm%2BXAgltwFKaMzLAlwAkqSWkriZarJxRtKCXcAQVfv%2BdtGJFWT%2BHdbNfdbcqQYorA4eW0pagVxNbCrpK6fbnE8KISzXb52%2FQnMwwaXvvgY6pgFZ5l%2FzvoxxrrO4fZXw4IipT3yA8oM9epi3JZM5Qf9UHIZIcIvu5V8tkQyMmsxiBrzb5lUaLcwnjW3kh4kXWZBJryuybcQt9rIoyr8YfGeSRn4gLS8NoAbK6vZVqG7Uyk5Si91pZ7YV592tRmowxY8sKA2pX4VheS%2FB9ZKRWMK2JdJGsVnSXCiZ2gZglOPcqFr81ZE3PDEbHWXvhDFxQNQdr0IRuElt&X-Amz-Signature=f58634a40a807e18bd5de8981576bdc8950ce62870f8c8eed6b4e7d7de31274f&X-Amz-SignedHeaders=host&x-id=GetObject"
// 转换为
// return {
//   properties: {
//     title: [['image.png']],
//     source: [
//       [
//         'attachment:fc287258-f0ef-4da6-a146-db58a8dddb3c:image.png'
//       ]
//     ]
//   },
//   spaceId: '6e1664a6-54f4-4dec-8dd1-868c4c0cf7ea'
// }
const transformToImage = (url) => {
  const pathParts = url.split('?')[0].split('/');

  const spaceId = pathParts[3];
  const uuid = pathParts[4];
  const fileName = pathParts[5];

  const displaySource = `attachment:${uuid}:${fileName}`
  console.log('###spaceId', JSON.stringify({
    properties: {
      size: [
        [
          "108.8KB"
        ]
      ],
      title: [[fileName]],
      source: [[displaySource]]
    },
    format: {
      display_source: displaySource
    },
    spaceId: spaceId
  }, null, 2))
  return {
    properties: {
      title: [[fileName]],
      source: [[displaySource]]
    },
    spaceId: spaceId
  };
}


