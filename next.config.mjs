import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  experimental: {
    optimizePackageImports: [
      "recharts",
      "date-fns",
    ],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: '/dashboard.',
        destination: '/dashboard',
        permanent: true,
      },
    ]
  },
}


export default nextConfig



console.log('--- NEXT.CONFIG BOOT ---');
console.log('API_BASE_URL:', process.env.API_BASE_URL);
console.log('NEXT_PUBLIC_RECORDS_API_BASE_URL:', process.env.NEXT_PUBLIC_RECORDS_API_BASE_URL);
