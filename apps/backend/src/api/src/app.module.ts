import {
  GraphQLDataSourceProcessOptions,
  IntrospectAndCompose,
  RemoteGraphQLDataSource,
} from '@apollo/gateway';
import { ApolloGatewayDriver, ApolloGatewayDriverConfig } from '@nestjs/apollo';

import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Request } from 'express';
import { LoggingModule, LogLevel } from '@qckstrt/logging-provider';

import configuration from 'src/config';
import supabaseConfig from 'src/config/supabase.config';
import storageConfig from 'src/config/storage.config';
import authConfig from 'src/config/auth.config';
import secretsConfig from 'src/config/secrets.config';
import relationaldbConfig from 'src/config/relationaldb.config';

import { HMACMiddleware } from 'src/common/middleware/hmac.middleware';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from 'src/common/auth/jwt.strategy';
import { AuthMiddleware } from 'src/common/middleware/auth.middleware';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { HttpExceptionFilter } from 'src/common/exceptions/http-exception.filter';
import { HealthModule } from './health/health.module';

interface GatewayContext {
  user?: string;
}

/**
 * Extract authenticated user from request context for GraphQL operations.
 *
 * SECURITY: Only trusts req.user which is set by AuthMiddleware after JWT validation.
 * Never trusts req.headers.user as it can be spoofed by clients.
 *
 * @see https://github.com/CommonwealthLabsCode/qckstrt/issues/182
 */
const handleAuth = ({ req }: { req: Request }) => {
  // Only use the validated user from passport (set by AuthMiddleware after JWT validation)
  // req.user contains the ILogin object from JwtStrategy.validate()
  if (req.user) {
    // Serialize user object to JSON string for propagation to subgraphs
    return { user: JSON.stringify(req.user) };
  }
  return {};
};

@Module({
  imports: [
    HealthModule,
    ConfigModule.forRoot({
      load: [
        configuration,
        supabaseConfig,
        storageConfig,
        authConfig,
        secretsConfig,
        relationaldbConfig,
      ],
      isGlobal: true,
    }),
    LoggingModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        serviceName: 'api-gateway',
        level:
          configService.get('NODE_ENV') === 'production'
            ? LogLevel.INFO
            : LogLevel.DEBUG,
        format:
          configService.get('NODE_ENV') === 'production' ? 'json' : 'pretty',
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 10, // 10 requests per second
      },
      {
        name: 'medium',
        ttl: 10000, // 10 seconds
        limit: 50, // 50 requests per 10 seconds
      },
      {
        name: 'long',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    GraphQLModule.forRootAsync<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      imports: [
        ConfigModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
      ],
      useFactory: async (configService: ConfigService) => ({
        server: {
          cors: true,
          path: 'api',
          context: handleAuth,
          // SECURITY: Disable introspection in production to prevent schema enumeration attacks
          introspection: configService.get('NODE_ENV') !== 'production',
        },
        gateway: {
          buildService: ({ url }) => {
            return new RemoteGraphQLDataSource({
              url,
              willSendRequest({
                request,
                context,
              }: GraphQLDataSourceProcessOptions<GatewayContext>) {
                request.http?.headers.set('user', context?.user);
              },
            });
          },
          supergraphSdl: new IntrospectAndCompose({
            subgraphs: JSON.parse(
              configService.get('MICROSERVICES') as string | '',
            ),
          }),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // SECURITY: Global auth guard implements "deny by default"
    // All GraphQL operations require authentication unless marked with @Public()
    // @see https://github.com/CommonwealthLabsCode/qckstrt/issues/183
    { provide: APP_GUARD, useClass: AuthGuard },
    JwtStrategy,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(HMACMiddleware, AuthMiddleware)
      .exclude({ path: 'health', method: RequestMethod.GET })
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
