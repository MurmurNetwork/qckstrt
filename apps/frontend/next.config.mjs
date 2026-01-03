import { getSecurityHeaders } from "./config/security-headers.config.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  /**
   * Security headers configuration
   *
   * Adds Content Security Policy and other security headers to all routes.
   * CSP helps prevent XSS attacks by restricting resource loading.
   *
   * @see https://github.com/CommonwealthLabsCode/qckstrt/issues/193
   */
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: getSecurityHeaders(),
      },
    ];
  },
};

export default nextConfig;
