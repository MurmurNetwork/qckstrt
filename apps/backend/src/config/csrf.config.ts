import { registerAs } from '@nestjs/config';

/**
 * CSRF Configuration
 *
 * Maps CSRF_* environment variables to nested config.
 * Uses stateless double-submit cookie pattern.
 */
export default registerAs('csrf', () => ({
  /**
   * Enable/disable CSRF protection
   * Default: true in production, configurable in development
   */
  enabled: process.env.CSRF_ENABLED !== 'false',

  /**
   * Cookie name for CSRF token
   */
  cookieName: process.env.CSRF_COOKIE_NAME || 'csrf-token',

  /**
   * Header name for CSRF token
   */
  headerName: process.env.CSRF_HEADER_NAME || 'x-csrf-token',

  /**
   * Token max age in milliseconds (default: 24 hours)
   */
  tokenMaxAge: Number.parseInt(
    process.env.CSRF_TOKEN_MAX_AGE || String(24 * 60 * 60 * 1000),
    10,
  ),

  /**
   * Cookie domain - set to include subdomains if needed
   * e.g., '.yourdomain.com' for subdomain inclusion
   */
  cookieDomain: process.env.CSRF_COOKIE_DOMAIN || undefined,
}));
