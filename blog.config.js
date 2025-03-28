const BLOG = {
  title: 'Jiyu Shao',
  author: 'Jiyu Shao',
  email: 'jiyu.shao@gmail.com',
  link: 'https://jiyu-shao.vercel.app',
  description: 'jiyu-shao.vercel.app',
  lang: 'zh-CN', // ['en-US', 'zh-CN', 'zh-HK', 'zh-TW', 'ja-JP', 'es-ES']
  font: 'sans-serif', // ['sans-serif', 'serif']
  lightBackground: '#f8f8f8', // use hex value, don't forget '#' e.g #fffefc
  darkBackground: '#1c1c1c', // use hex value, don't forget '#'
  path: '', // leave this empty unless you want to deploy project in a folder
  since: 2018, // If leave this empty, current year will be used.
  postsPerPage: 7,
  sortByDate: true,
  readingLink: 'https://jiyu-shao.notion.site/3e1653efbede4cfe81bd33b08b562e1a',
  showArchive: false,
  ogImage: '', // OG Image
  githubLink: 'https://github.com/JiyuShao',
  socialLink: 'https://github.com/JiyuShao',
  seo: {
    keywords: ['Blog', 'Website', 'Notion'],
    googleSiteVerification: '' // Remove the value or replace it with your own google site verification code
  },
  notionDatabaseId: process.env.NOTION_DATABASE_ID, // DO NOT CHANGE THIS！！！
  analytics: {
    provider: '', // Currently we support Google Analytics and Ackee, please fill with 'ga' or 'ackee', leave it empty to disable it.
    ackeeConfig: {
      tracker: '', // e.g 'https://ackee.craigary.net/tracker.js'
      dataAckeeServer: '', // e.g https://ackee.craigary.net , don't end with a slash
      domainId: '' // e.g '0e2257a8-54d4-4847-91a1-0311ea48cc7b'
    },
    gaConfig: {
      measurementId: '' // e.g: G-XXXXXXXXXX
    }
  },
  comment: {
    // support provider: gitalk, utterances, cusdis
    provider: 'utterances', // leave it empty if you don't need any comment plugin
    gitalkConfig: {
      repo: '', // The repository of store comments
      owner: '',
      admin: [],
      clientID: '',
      clientSecret: '',
      distractionFreeMode: false
    },
    utterancesConfig: {
      repo: 'JiyuShao/portfolio'
    },
    cusdisConfig: {
      appId: '', // data-app-id
      host: 'https://cusdis.com', // data-host, change this if you're using self-hosted version
      scriptSrc: 'https://cusdis.com/js/cusdis.es.js' // change this if you're using self-hosted version
    }
  },
  isProd: process.env.VERCEL_ENV === 'production' // distinguish between development and production environment (ref: https://vercel.com/docs/environment-variables#system-environment-variables)
}
// export default BLOG
module.exports = BLOG
