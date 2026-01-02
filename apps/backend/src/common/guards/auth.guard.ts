import { Injectable, ExecutionContext, CanActivate } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { isLoggedIn } from 'src/common/auth/jwt.strategy';
import { IS_PUBLIC_KEY } from 'src/common/decorators/public.decorator';

/**
 * Global authentication guard for GraphQL operations.
 *
 * SECURITY: Implements "deny by default" - all operations require authentication
 * unless explicitly marked with @Public() decorator.
 *
 * This guard checks request.user which is populated by the AuthMiddleware
 * after JWT validation via Passport.js. It does NOT trust headers that
 * could be spoofed by clients.
 *
 * @see https://github.com/CommonwealthLabsCode/qckstrt/issues/183
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if the endpoint is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;

    // SECURITY: Only trust request.user which is set by AuthMiddleware
    // after JWT validation via Passport.js. Never trust request.headers.user
    // as it can be spoofed by clients.
    const user = request.user;

    // No authenticated user - deny access
    if (!user) {
      return false;
    }

    // Validate user object has required fields
    return isLoggedIn(user);
  }
}
