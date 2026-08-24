// Keep the config as a static dependency so Next/Vercel file tracing includes it.
const config = require('../../blog.config.js')

// If we need to stripe out some private fields
const clientConfig = config

module.exports = {
  config,
  clientConfig
}
