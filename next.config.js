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
      const existingIgnored = config.watchOptions?.ignored;
      const ignored = Array.isArray(existingIgnored)
        ? existingIgnored
        : existingIgnored
          ? [existingIgnored]
          : [];

      config.watchOptions = {
        ...(config.watchOptions || {}),
        ignored: [
          ...ignored,
          /(^|[\\/])data[\\/]/,
          /(^|[\\/])\.logs[\\/]/,
          /(^|[\\/])backups[\\/]/,
          /\.log$/,
        ],
      };
    }

    return config;
  },
};

module.exports = nextConfig;
