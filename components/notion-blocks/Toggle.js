import { Text } from 'react-notion-x'
import cn from 'classnames'

export default function Toggle ({ block, children }) {
  return (
    <details className={cn(
      'common-block common-toggle',
      { 'common-toggle-empty': !children },
      block.format?.block_color && `notion-${block.format.block_color}`
    )}>
      <summary className="relative">
        <span className="common-toggle-triangle">
          <svg viewBox="0 0 100 100">
            <polygon points="5.9,88.2 50,11.8 94.1,88.2" />
          </svg>
        </span>
        <span className="common-toggle-title">
          <Text value={block.properties?.title} block={block} />
        </span>
      </summary>
      {children && (
        <div className="common-toggle-content">
          {children}
        </div>
      )}
    </details>
  )
}
