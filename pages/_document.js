import Document, { Html, Head, Main, NextScript } from 'next/document'
import { config } from '@/lib/server/config'
import tailwind from '@/tailwind.config'

export default function MyDocument() {
  return (
    <Html lang={config.lang}>
      <Head>
        <link rel="icon" href="/favicon.png" />
        <style>
          {`
            .color-scheme-unset, .color-scheme-unset body {
              background-color: ${tailwind.theme.extend.colors.day.DEFAULT} !important;
            }
          `}
        </style>
      </Head>
      <body className="bg-day dark:bg-night">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}

MyDocument.getInitialProps = async ctx => {
  const initialProps = await Document.getInitialProps(ctx)
  return { ...initialProps }
}
