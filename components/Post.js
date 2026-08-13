import PropTypes from 'prop-types'
import FormattedDate from '@/components/FormattedDate'
import TagItem from '@/components/TagItem'
import { renderMarkdown } from '@/lib/markdown.mjs'

/**
 * A post renderer: header metadata + markdown body.
 *
 * @param {object} props
 * @param {object} props.post        - Post metadata
 * @param {string} props.markdown    - Markdown body from the Manifest
 * @param {Array}  props.attachments - Attachment inventory for image refs
 */
export default function Post({ post, markdown, attachments }) {
  return (
    <article className="flex flex-col items-center">
      <h1 className="w-full max-w-3xl px-4 font-bold text-3xl text-black dark:text-white">
        {post.title}
      </h1>
      <nav className="w-full max-w-3xl px-4 flex mt-7 items-start text-gray-500 dark:text-gray-400">
        <div className="mr-2 mb-4 md:ml-0">
          <FormattedDate date={post.date} />
        </div>
        {post.tags && (
          <div className="flex flex-nowrap max-w-full overflow-x-auto article-tags">
            {post.tags.map(tag => (
              <TagItem key={tag} tag={tag} />
            ))}
          </div>
        )}
      </nav>
      <div className="self-stretch -mt-4 flex flex-col items-center">
        <div className="flex-none w-full max-w-3xl px-4">
          <div className="markdown-body prose dark:prose-invert max-w-none">
            {renderMarkdown(markdown, attachments)}
          </div>
        </div>
      </div>
    </article>
  )
}

Post.propTypes = {
  post: PropTypes.object.isRequired,
  markdown: PropTypes.string.isRequired,
  attachments: PropTypes.array
}
