/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: [
      "pdf-parse",
      "pdfjs-dist",
      "@napi-rs/canvas",
    ],
    outputFileTracingIncludes: {
      "/api/profile/import-cv": [
        "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      ],
    },
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...(config.watchOptions || {}),
        ignored: /(^|[\\/])(data|\.logs|backups)([\\/]|$)|\.log$/,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
