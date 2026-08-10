/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Prevent MIME sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Block clickjacking via iframes
  { key: "X-Frame-Options", value: "DENY" },
  // Legacy XSS filter for old browsers
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // Control referrer data sent with requests
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Force HTTPS for 1 year (HSTS)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Restrict permissions granted to the browser
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // CSP: tighten as needed per environment
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js HMR requires unsafe-eval in dev
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/dashboard.",
        destination: "/dashboard",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
