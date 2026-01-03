import { getHelmetOptions } from './security-headers.config';

describe('Security Headers Configuration', () => {
  describe('getHelmetOptions', () => {
    it('should return helmet options object', () => {
      const options = getHelmetOptions();
      expect(options).toBeDefined();
      expect(typeof options).toBe('object');
    });

    it('should disable contentSecurityPolicy for GraphQL compatibility', () => {
      const options = getHelmetOptions();
      expect(options.contentSecurityPolicy).toBe(false);
    });

    it('should disable crossOriginEmbedderPolicy for GraphQL tools', () => {
      const options = getHelmetOptions();
      expect(options.crossOriginEmbedderPolicy).toBe(false);
    });

    it('should configure crossOriginOpenerPolicy as same-origin', () => {
      const options = getHelmetOptions();
      expect(options.crossOriginOpenerPolicy).toEqual({
        policy: 'same-origin',
      });
    });

    it('should configure crossOriginResourcePolicy as same-site', () => {
      const options = getHelmetOptions();
      expect(options.crossOriginResourcePolicy).toEqual({
        policy: 'same-site',
      });
    });

    it('should disable DNS prefetch control', () => {
      const options = getHelmetOptions();
      expect(options.dnsPrefetchControl).toEqual({ allow: false });
    });

    it('should configure frameguard to deny framing (clickjacking protection)', () => {
      const options = getHelmetOptions();
      expect(options.frameguard).toEqual({ action: 'deny' });
    });

    it('should hide X-Powered-By header', () => {
      const options = getHelmetOptions();
      expect(options.hidePoweredBy).toBe(true);
    });

    it('should configure HSTS with 1 year max-age', () => {
      const options = getHelmetOptions();
      expect(options.hsts).toEqual({
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      });
    });

    it('should enable ieNoOpen for IE download protection', () => {
      const options = getHelmetOptions();
      expect(options.ieNoOpen).toBe(true);
    });

    it('should enable noSniff to prevent MIME type sniffing', () => {
      const options = getHelmetOptions();
      expect(options.noSniff).toBe(true);
    });

    it('should enable originAgentCluster for origin isolation', () => {
      const options = getHelmetOptions();
      expect(options.originAgentCluster).toBe(true);
    });

    it('should configure permittedCrossDomainPolicies as none', () => {
      const options = getHelmetOptions();
      expect(options.permittedCrossDomainPolicies).toEqual({
        permittedPolicies: 'none',
      });
    });

    it('should configure referrerPolicy as strict-origin-when-cross-origin', () => {
      const options = getHelmetOptions();
      expect(options.referrerPolicy).toEqual({
        policy: 'strict-origin-when-cross-origin',
      });
    });

    it('should disable xssFilter (deprecated, use CSP instead)', () => {
      const options = getHelmetOptions();
      expect(options.xssFilter).toBe(false);
    });
  });

  describe('Security Headers Coverage', () => {
    it('should include all critical security headers', () => {
      const options = getHelmetOptions();
      const expectedHeaders = [
        'contentSecurityPolicy',
        'crossOriginEmbedderPolicy',
        'crossOriginOpenerPolicy',
        'crossOriginResourcePolicy',
        'dnsPrefetchControl',
        'frameguard',
        'hidePoweredBy',
        'hsts',
        'ieNoOpen',
        'noSniff',
        'originAgentCluster',
        'permittedCrossDomainPolicies',
        'referrerPolicy',
        'xssFilter',
      ];

      expectedHeaders.forEach((header) => {
        expect(options).toHaveProperty(header);
      });
    });
  });
});
