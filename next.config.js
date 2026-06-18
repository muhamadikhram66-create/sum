/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
    outputFileTracingIncludes: {
      '/api/generate-pdf': ['./public/proposal-template.html'],
    },
  },
};
module.exports = nextConfig;

