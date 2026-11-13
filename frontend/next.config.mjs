import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    externalDir: true,
    outputFileTracingRoot: path.resolve(fileURLToPath(new URL('..', import.meta.url))),
  },
};
export default nextConfig;
