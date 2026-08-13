# Jiyu's Protfolio & Blog

A static website build on top of Notion and Nextjs, Modified from [Craig Hart's Nobelium](https://github.com/craigary/nobelium).

**Why not use Nobelium directly?**

- 😭 Nobelium is using the old Notion API, which is deprecated and buggy
- 😁 New UI design
- 😁 using pnpm

## Technical details

- **Data Fetching**: Notion Official API [@notionhq/client](https://github.com/makenotion/notion-sdk-js)
- **Generation**: Next.js and Incremental Static Regeneration
- **Page render**: [react-notion-x](https://github.com/NotionX/react-notion-x)
- **Style**: Tailwind CSS and `@tailwindcss/jit` compiler
- **Comments**: Gitalk, Cusdis and more

Support List

- [x] page => page
- [x] heading_1 => header
- [x] heading_2 => sub_header
- [x] heading_3 => sub_sub_header
- [x] paragraph => text
- [x] bulleted_list_item => bulleted_list
- [x] numbered_list_item => numbered_list
- [x] toggle => toggle
- [x] code => code
- [x] bookmark => bookmark
- [x] image => image
- [x] callout => callout
- [x] table => table
- [x] table_row => table_row
- [x] table_row => table_row
- [x] column_list
- [x] column
- [x] quote
- [x] divider
- [ ] table_of_contents
- [ ] child_page
- [ ] child_database
- [ ] link_to_page
- unsupported: other unsupported blocks...

## Highlights ✨

**🚀 &nbsp;Fast and responsive**

- Fast page render and responsive design
- Fast static generation with efficient compiler

**🤖 &nbsp;Deploy instantly**

- Deploy on Vercel in minutes
- Static pages generated from the published content Manifest (Notebook publish pipeline)
- No content API at runtime: builds fetch a checksum-verified artifact

**🚙 &nbsp;Fully functional**

- Comments, full width page, quick search and tag filter
- RSS, analytics, web vital... and much more

**🎨 &nbsp;Easy for customization**

- Rich config options, support English & Chinese interface
- Built with Tailwind CSS, easy for customization

**🕸 &nbsp;Pretty URLs and SEO friendly**

## Quick Start

- Star this repo 😉
- [Fork](https://github.com/craigary/nobelium/fork) this project
- Customize `blog.config.js`
- Publish the content Manifest first (Notebook `publish` CLI), then deploy on [Vercel](https://vercel.com) with these environment variables:
  - `MANIFEST_GITHUB_TOKEN` (Required): a read-only fine-grained GitHub token for the Notebook repo Releases
  - `MANIFEST_TAG` (Optional): pin a release tag instead of fetching the latest
- **That's it!** Easy-peasy?

## Special Thanks

- 2021-2024, [Craig Hart](https://github.com/craigary) for the original [Nobelium](https://github.com/craigary/nobelium)
- 2024-present, [Jiyu Shao](https://github.com/JiyuShao) for the maintenance and updates

## License

The MIT License.
