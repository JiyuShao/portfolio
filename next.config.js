module.exports = {
  images: {
    formats: ['image/avif', 'image/webp']
  },
  eslint: {
    dirs: ['components', 'layouts', 'lib', 'pages']
  },
  async redirects() {
    const { loadRedirects } = await import('./lib/redirects.mjs');
    return loadRedirects();
  },
  async headers() {
    return [
      {
        source: '/:path*{/}?',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'interest-cohort=()'
          }
        ]
      }
    ]
  }
  // webpack: (config, { dev, isServer }) => {
  //   // Replace React with Preact only in client production build
  //   if (!dev && !isServer) {
  //     Object.assign(config.resolve.alias, {
  //       react: 'preact/compat',
  //       'react-dom/test-utils': 'preact/test-utils',
  //       'react-dom': 'preact/compat'
  //     })
  //   }
  //   return config
  // }
}
