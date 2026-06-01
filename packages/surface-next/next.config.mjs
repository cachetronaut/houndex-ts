/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['houndex/cli', 'houndex/core', 'houndex/evals'],
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
