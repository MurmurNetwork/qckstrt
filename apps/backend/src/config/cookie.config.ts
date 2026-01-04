import { registerAs } from '@nestjs/config';
import { isProduction } from './environment.config';

/**
 * Cookie Configuration
 *
 * Maps COOKIE_* environment variables to nested config.
 * Used for secure httpOnly cookie-based authentication.
 */
export default registerAs('cookie', () => ({
  /**
   * Whether cookies should be secure (HTTPS only)
   * Default: true in production
   */
  secure: process.env.COOKIE_SECURE === 'true' || isProduction(),

  /**
   * SameSite attribute for cookies
   * 'strict' - Only sent in first-party context
   * 'lax' - Sent with top-level navigations and GET from third-party
   * 'none' - Sent in all contexts (requires secure: true)
   */
  sameSite:
    (process.env.COOKIE_SAME_SITE as 'strict' | 'lax' | 'none') || 'strict',

  /**
   * Cookie domain - set to include subdomains if needed
   * e.g., '.yourdomain.com' for subdomain inclusion
   */
  domain: process.env.COOKIE_DOMAIN || undefined,

  /**
   * Access token cookie max age in milliseconds (default: 15 minutes)
   */
  accessTokenMaxAge: Number.parseInt(
    process.env.COOKIE_ACCESS_TOKEN_MAX_AGE || String(15 * 60 * 1000),
    10,
  ),

  /**
   * Refresh token cookie max age in milliseconds (default: 7 days)
   */
  refreshTokenMaxAge: Number.parseInt(
    process.env.COOKIE_REFRESH_TOKEN_MAX_AGE || String(7 * 24 * 60 * 60 * 1000),
    10,
  ),

  /**
   * Cookie names
   */
  accessTokenName: process.env.COOKIE_ACCESS_TOKEN_NAME || 'access-token',
  refreshTokenName: process.env.COOKIE_REFRESH_TOKEN_NAME || 'refresh-token',
}));
