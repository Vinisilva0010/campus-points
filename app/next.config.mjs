/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      os: false,
      path: false,
      crypto: false,
      "pino-pretty": false,
    };
    config.ignoreWarnings = [
      { module: /node_modules\/pino/ },
      { module: /node_modules\/ox/ },
      /Critical dependency/,
      /Can't resolve 'pino-pretty'/,
    ];
    return config;
  },
};
export default nextConfig;
