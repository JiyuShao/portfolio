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
- [ ] divider
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
- Incremental regeneration and no need to redeploy after update the content in notion

**🚙 &nbsp;Fully functional**

- Comments, full width page, quick search and tag filter
- RSS, analytics, web vital... and much more

**🎨 &nbsp;Easy for customization**

- Rich config options, support English & Chinese interface
- Built with Tailwind CSS, easy for customization

**🕸 &nbsp;Pretty URLs and SEO friendly**

## Quick Start

- Star this repo 😉
- Duplicate [this Notion template](https://jiyu-shao.notion.site/317f32f945a7495bab885276ed049c82?v=cbdf0099b8984dbf93e89a64bef5b72a&pvs=4), and share it to the public
- [Fork](https://github.com/craigary/nobelium/fork) this project
- Customize `blog.config.js`
- _(Optional)_ Replace `favicon.svg`, and `favicon.ico` in `/public` folder with your own
- Deploy on [Vercel](https://vercel.com), set following environment variables:
  - `NOTION_API_KEY` (Required): The API key of your Notion account
  - `NOTION_DATABASE_ID` (Required): The ID of the Notion database you previously shared to the web, usually has 32 digits after your workspace address
- **That's it!** Easy-peasy?

## Special Thanks

- 2021-2024, [Craig Hart](https://github.com/craigary) for the original [Nobelium](https://github.com/craigary/nobelium)
- 2024-present, [Jiyu Shao](https://github.com/JiyuShao) for the maintenance and updates

## License

The MIT License.
