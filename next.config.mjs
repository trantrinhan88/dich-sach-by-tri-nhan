/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), { canvas: 'canvas' }]
    }
    return config
  },
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'pdfkit', 'jszip', 'cheerio', '@anthropic-ai/sdk'],
  },
}

export default nextConfig
