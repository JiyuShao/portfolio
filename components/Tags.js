import Link from 'next/link'

const Tags = ({ tags, currentTag }) => {
  if (!tags) return null
  return (
    <div className="tag-container">
      <ul className="flex max-w-full mt-4 overflow-x-auto">
        {Object.keys(tags).map(key => {
          const selected = key === currentTag
          return (
            <li
              key={key}
              className={`flex items-center mr-3 px-4 py-2 font-medium border whitespace-nowrap dark:text-gray-300 ${selected
                ? 'text-white bg-primary-400 dark:bg-primary-500 border-none'
                : 'bg-gray-100 border-gray-100 text-gray-400 dark:bg-night dark:border-gray-800'
                }`}
            >
              <Link
                key={key}
                href={selected ? '/search' : `/tag/${encodeURIComponent(key)}`}
              >
                {`${key} (${tags[key]})`}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default Tags
