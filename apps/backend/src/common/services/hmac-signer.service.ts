import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';

/**
 * HMAC Signing Service
 *
 * Used by the API Gateway to sign requests to microservices,
 * ensuring that only requests from the trusted gateway are processed.
 *
 * This replaces the frontend HMAC signing (which was a security issue
 * as it exposed the secret in the browser) with gateway-side signing.
 */
@Injectable()
export class HmacSignerService {
  private readonly secret: string;
  private readonly clientId: string;
  private readonly logger = new Logger(HmacSignerService.name, {
    timestamp: true,
  });

  constructor(private readonly configService: ConfigService) {
    this.secret = this.configService.get<string>('GATEWAY_HMAC_SECRET') || '';
    this.clientId =
      this.configService.get<string>('GATEWAY_CLIENT_ID') || 'api-gateway';

    if (!this.secret) {
      this.logger.warn(
        'GATEWAY_HMAC_SECRET is not configured. HMAC signing disabled.',
      );
    } else {
      this.logger.log(`HMAC signing enabled for client: ${this.clientId}`);
    }
  }

  /**
   * Check if HMAC signing is enabled (secret is configured)
   */
  isEnabled(): boolean {
    return !!this.secret;
  }

  /**
   * Sign a request and return the X-HMAC-Auth header value
   *
   * @param method - HTTP method (POST, GET, etc.)
   * @param path - Request path (e.g., /graphql)
   * @param contentType - Content-Type header value (optional)
   * @returns The formatted HMAC header value
   */
  sign(
    method: string,
    path: string,
    contentType: string = 'application/json',
  ): string {
    if (!this.secret) {
      return '';
    }

    const headers = '@request-target,content-type';
    const signatureString = `${method.toLowerCase()} ${path}\ncontent-type: ${contentType}`;

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(signatureString)
      .digest('base64');

    const credentials = {
      username: this.clientId,
      algorithm: 'hmac-sha256',
      headers,
      signature,
    };

    return `HMAC ${JSON.stringify(credentials)}`;
  }

  /**
   * Sign a GraphQL request to a microservice
   *
   * @param subgraphUrl - The URL of the subgraph (microservice)
   * @returns The formatted HMAC header value
   */
  signGraphQLRequest(subgraphUrl: string): string {
    try {
      const url = new URL(subgraphUrl);
      return this.sign('POST', url.pathname);
    } catch {
      this.logger.warn(`Failed to parse subgraph URL: ${subgraphUrl}`);
      return this.sign('POST', '/graphql');
    }
  }
}
