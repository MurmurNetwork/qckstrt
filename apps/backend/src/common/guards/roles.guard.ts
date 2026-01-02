import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';

import { Role } from '../enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

import { ILogin } from 'src/interfaces/login.interface';
import { isLoggedIn } from 'src/common/auth/jwt.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    // SECURITY: Use request.user set by AuthMiddleware after JWT validation
    // Never trust request.headers.user as it can be spoofed
    // @see https://github.com/CommonwealthLabsCode/qckstrt/issues/183
    const user: ILogin | undefined = request.user;

    if (user && isLoggedIn(user)) {
      return requiredRoles.some((role) => user.roles?.includes(role));
    }

    return false;
  }
}
