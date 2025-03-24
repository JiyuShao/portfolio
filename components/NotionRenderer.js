import { createElement as h } from 'react'
import dynamic from 'next/dynamic'
import { NotionRenderer as Renderer } from 'react-notion-x'
import { getTextContent } from 'notion-utils'
import { FONTS_SANS, FONTS_SERIF } from '@/consts'
import { useConfig } from '@/lib/config'
import Toggle from '@/components/notion-blocks/Toggle'
import { TYPE_TRANSFORM_MAP } from '@/lib/notion/transformToRecordMap'

// Lazy-load some heavy components & override the renderers of some block types
const components = {
  /* Lazy-load */

  // Code block
  Code: dynamic(async () => {
    return function CodeSwitch(props) {
      switch (getTextContent(props.block.properties.language)) {
        case 'Mermaid':
          return h(
            dynamic(() => {
              return import('@/components/notion-blocks/Mermaid').then(module => module.default)
            }, { ssr: false }),
            props
          )
        default:
          return h(
            dynamic(() => {
              return import('react-notion-x/build/third-party/code').then(async module => {
                // Additional prismjs syntax
                await Promise.all([
                  import('prismjs/components/prism-markup-templating'),
                  import('prismjs/components/prism-markup'),
                  import('prismjs/components/prism-bash'),
                  import('prismjs/components/prism-c'),
                  import('prismjs/components/prism-cpp'),
                  import('prismjs/components/prism-csharp'),
                  import('prismjs/components/prism-docker'),
                  import('prismjs/components/prism-java'),
                  import('prismjs/components/prism-js-templates'),
                  import('prismjs/components/prism-coffeescript'),
                  import('prismjs/components/prism-diff'),
                  import('prismjs/components/prism-git'),
                  import('prismjs/components/prism-go'),
                  import('prismjs/components/prism-graphql'),
                  import('prismjs/components/prism-handlebars'),
                  import('prismjs/components/prism-less'),
                  import('prismjs/components/prism-makefile'),
                  import('prismjs/components/prism-markdown'),
                  import('prismjs/components/prism-objectivec'),
                  import('prismjs/components/prism-ocaml'),
                  import('prismjs/components/prism-python'),
                  import('prismjs/components/prism-reason'),
                  import('prismjs/components/prism-rust'),
                  import('prismjs/components/prism-sass'),
                  import('prismjs/components/prism-scss'),
                  import('prismjs/components/prism-solidity'),
                  import('prismjs/components/prism-sql'),
                  import('prismjs/components/prism-stylus'),
                  import('prismjs/components/prism-swift'),
                  import('prismjs/components/prism-wasm'),
                  import('prismjs/components/prism-yaml')
                ])
                return module.Code
              })
            }),
            props
          )
      }
    }
  }),
  // Database block
  Collection: dynamic(() => {
    return import('react-notion-x/build/third-party/collection').then(module => module.Collection)
  }),
  // Equation block & inline variant
  Equation: dynamic(() => {
    return import('react-notion-x/build/third-party/equation').then(module => module.Equation)
  }),
  // PDF (Embed block)
  Pdf: dynamic(() => {
    return import('react-notion-x/build/third-party/pdf').then(module => module.Pdf)
  }, { ssr: false }),
  // Tweet block
  Tweet: dynamic(() => {
    return import('react-tweet-embed').then(module => {
      const { default: TweetEmbed } = module
      return function Tweet({ id }) {
        return <TweetEmbed tweetId={id} options={{ theme: 'dark' }} />
      }
    })
  }),

  /* Overrides */

  toggle_nobelium: ({ block, children }) => (
    <Toggle block={block}>{children}</Toggle>
  )
}

const mapPageUrl = id => `https://www.notion.so/${id.replace(/-/g, '')}`

/**
 * Notion page renderer
 *
 * A wrapper of react-notion-x/NotionRenderer with predefined `components` and `mapPageUrl`
 *
 * @param props - Anything that react-notion-x/NotionRenderer supports
 */
export default function NotionRenderer(props) {
  const config = useConfig()

  const font = {
    'sans-serif': FONTS_SANS,
    'serif': FONTS_SERIF
  }[config.font]

  globalThis.dataNew = props.recordMap;
  globalThis.dataOld = props.recordMapOld;
  globalThis.logUnimplementedBlocks = () => {
    const unimplementedBlocksNew = Object.values(props.recordMap.block)
      .map(block => block.value)
      .filter(block => !Object.keys(TYPE_TRANSFORM_MAP).includes(block.rawBlock.type)
      )
    const unimplementedBlocksOld = unimplementedBlocksNew.map(block => props.recordMapOld.block[block.id].value)
    console.log('### Unimplemented Blocks New', unimplementedBlocksNew)
    console.log('### Unimplemented Blocks Old', unimplementedBlocksOld)
  }
  globalThis.logBlocksByType = (type) => {
    const unimplementedBlocksNew = Object.values(props.recordMap.block)
      .map(block => block.value)
      .filter(block => [type].includes(block.rawBlock.type)
      )
    const unimplementedBlocksOld = unimplementedBlocksNew.map(block => props.recordMapOld.block[block.id].value)
    console.log(`### Blocks(${type}) New`, unimplementedBlocksNew)
    console.log(`### Blocks(${type}) Old`, unimplementedBlocksOld)
  }
  globalThis.logBlocksById = (id) => {
    const blockNew = props.recordMap.block[id].value
    const blockOld = props.recordMapOld.block[id].value
    console.log(`### Block(${id}) New`, blockNew)
    console.log(`### Block(${id}) Old`, blockOld)
  }
  globalThis.logUnimplementedBlocks()

  // Mark block types to be custom rendered by appending a suffix
  if (props.recordMap) {
    for (const { value: block } of Object.values(props.recordMap)) {
      switch (block?.type) {
        case 'toggle':
          block.type += '_nobelium'
          break
      }
    }
  }

  return (
    <>
      <style jsx global>
        {`
        .notion {
          --notion-font: ${font};
        }
        `}
      </style>
      <Renderer
        components={components}
        mapPageUrl={mapPageUrl}
        {...props}
      />
    </>
  )
}
