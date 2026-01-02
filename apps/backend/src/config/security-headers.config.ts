import { registerAs } from '@nestjs/config';
import type { HelmetOptions } from 'helmet';

/**
 * Security Headers Configuration
 *
 * Configures helmet middleware for security headers.
 * @see https://helmetjs.github.io/
 */
export default registerAs(
  'securityHeaders',
  (): HelmetOptions => ({
    /**
     * Content-Security-Policy
     * Disabled by default as GraphQL playground and Apollo Studio need inline scripts.
     * Enable and configure in production if using a custom frontend.
     */
    contentSecurityPolicy: false,

    /**
     * Cross-Origin-Embedder-Policy: require-corp
     * Prevents loading cross-origin resources that don't explicitly grant permission.
     */
    crossOriginEmbedderPolicy: false, // Disabled to allow GraphQL tools

    /**
     * Cross-Origin-Opener-Policy: same-origin
     * Isolates browsing context to same-origin documents.
     */
    crossOriginOpenerPolicy: { policy: 'same-origin' },

    /**
     * Cross-Origin-Resource-Policy: same-site
     * Restricts resource loading to same-site requests.
     */
    crossOriginResourcePolicy: { policy: 'same-site' },

    /**
     * X-DNS-Prefetch-Control: off
     * Controls browser DNS prefetching to prevent privacy leaks.
     */
    dnsPrefetchControl: { allow: false },

    /**
     * X-Frame-Options: DENY
     * Prevents clickjacking by disallowing page embedding in frames.
     */
    frameguard: { action: 'deny' },

    /**
     * X-Powered-By: removed
     * Removes the X-Powered-By header to hide server technology.
     */
    hidePoweredBy: true,

    /**
     * Strict-Transport-Security (HSTS)
     * Forces HTTPS connections for 1 year with subdomain inclusion.
     * Only sent over HTTPS connections.
     */
    hsts: {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true,
    },

    /**
     * X-Download-Options: noopen
     * Prevents IE from executing downloads in site's context.
     */
    ieNoOpen: true,

    /**
     * X-Content-Type-Options: nosniff
     * Prevents MIME type sniffing attacks.
     */
    noSniff: true,

    /**
     * Origin-Agent-Cluster: ?1
     * Requests browser to isolate the origin in its own agent cluster.
     */
    originAgentCluster: true,

    /**
     * X-Permitted-Cross-Domain-Policies: none
     * Prevents Adobe Flash and PDF cross-domain data loading.
     */
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },

    /**
     * Referrer-Policy: strict-origin-when-cross-origin
     * Controls referrer information sent with requests.
     * - Same-origin: full URL
     * - Cross-origin: only origin (no path)
     * - HTTPS to HTTP: no referrer
     */
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

    /**
     * X-XSS-Protection: 0
     * Disabled as it can introduce vulnerabilities in modern browsers.
     * CSP is the modern replacement for XSS protection.
     * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-XSS-Protection
     */
    xssFilter: false,
  }),
);

/**
 * Get helmet options for use in bootstrap
 * This function can be used directly without config service for simpler setup.
 */
export function getHelmetOptions(): HelmetOptions {
  return {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: false,
  };
}
