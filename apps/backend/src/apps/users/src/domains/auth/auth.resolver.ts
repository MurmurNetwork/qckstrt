import { Args, ID, Mutation, Query, Resolver, Context } from '@nestjs/graphql';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, Logger } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

import { UserInputError } from '@nestjs/apollo';

import { Auth } from './models/auth.model';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { Role } from 'src/common/enums/role.enum';
import { AuthStrategy } from 'src/common/enums/auth-strategy.enum';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Action } from 'src/common/enums/action.enum';
import { ConfirmForgotPasswordDto } from './dto/confirm-forgot-password.dto';
import { UsersService } from '../user/users.service';
import {
  GqlContext,
  getUserFromContext,
} from 'src/common/utils/graphql-context';
import {
  setAuthCookies,
  clearAuthCookies,
} from 'src/common/utils/cookie.utils';
import { AUTH_THROTTLE } from 'src/config/auth-throttle.config';
import { AccountLockoutService } from './services/account-lockout.service';

// Passkey DTOs
import {
  GeneratePasskeyRegistrationOptionsDto,
  VerifyPasskeyRegistrationDto,
  GeneratePasskeyAuthenticationOptionsDto,
  VerifyPasskeyAuthenticationDto,
  PasskeyRegistrationOptions,
  PasskeyAuthenticationOptions,
  PasskeyCredential,
} from './dto/passkey.dto';
import { PasskeyService } from './services/passkey.service';

// Magic Link DTOs
import {
  SendMagicLinkDto,
  VerifyMagicLinkDto,
  RegisterWithMagicLinkDto,
} from './dto/magic-link.dto';

@Resolver(() => Boolean)
export class AuthResolver {
  private readonly logger = new Logger(AuthResolver.name);

  constructor(
    private readonly authService: AuthService,
    private readonly passkeyService: PasskeyService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly lockoutService: AccountLockoutService,
  ) {}

  /**
   * Register a new user account
   * Rate limited: 3 attempts per minute
   * @see https://github.com/CommonwealthLabsCode/qckstrt/issues/187
   */
  @Public()
  @Throttle({ default: AUTH_THROTTLE.register })
  @Mutation(() => Boolean)
  async registerUser(
    @Args('registerUserDto') registerUserDto: RegisterUserDto,
  ): Promise<boolean> {
    let userRegistered: string;
    try {
      userRegistered = await this.authService.registerUser(registerUserDto);
    } catch (error) {
      throw new UserInputError(error.message);
    }
    return userRegistered !== null;
  }

  /**
   * Login with email and password
   * Rate limited: 5 attempts per minute
   * Includes account lockout after 5 failed attempts
   * @see https://github.com/CommonwealthLabsCode/qckstrt/issues/187
   */
  @Public()
  @Throttle({ default: AUTH_THROTTLE.login })
  @Mutation(() => Auth)
  async loginUser(
    @Args('loginUserDto') loginUserDto: LoginUserDto,
    @Context() context: GqlContext,
  ): Promise<Auth> {
    const { email } = loginUserDto;
    const clientIp =
      context.req?.ip ||
      (context.req?.headers as Record<string, string>)?.['x-forwarded-for'];

    // Check if account is locked
    if (this.lockoutService.isLocked(email)) {
      const remainingMs = this.lockoutService.getRemainingLockoutTime(email);
      const remainingMin = Math.ceil(remainingMs / 60000);
      this.logger.warn(
        `Blocked login attempt for locked account: ${email} (IP: ${clientIp})`,
      );
      throw new ForbiddenException(
        `Account temporarily locked. Try again in ${remainingMin} minute(s).`,
      );
    }

    let auth: Auth;
    try {
      auth = await this.authService.authenticateUser(loginUserDto);

      // Clear lockout on successful login
      this.lockoutService.clearLockout(email);

      // Set httpOnly cookies for browser clients
      if (context.res) {
        setAuthCookies(
          context.res,
          this.configService,
          auth.accessToken,
          auth.refreshToken,
        );
      }
    } catch (error) {
      // Record failed attempt (may trigger lockout)
      const isNowLocked = this.lockoutService.recordFailedAttempt(
        email,
        clientIp as string,
      );

      if (isNowLocked) {
        throw new ForbiddenException(
          'Too many failed login attempts. Account temporarily locked for 15 minutes.',
        );
      }

      throw new UserInputError(error.message);
    }
    return auth;
  }

  @Mutation(() => Boolean)
  @Permissions({
    action: Action.Update,
    subject: 'User',
    conditions: { id: '{{ id }}' },
  })
  async changePassword(
    @Args('changePasswordDto') changePasswordDto: ChangePasswordDto,
  ): Promise<boolean> {
    let passwordUpdated: boolean;
    try {
      passwordUpdated =
        await this.authService.changePassword(changePasswordDto);
    } catch (error) {
      throw new UserInputError(error.message);
    }
    return passwordUpdated;
  }

  /**
   * Request password reset email
   * Rate limited: 3 attempts per hour (prevents email bombing)
   * @see https://github.com/CommonwealthLabsCode/qckstrt/issues/187
   */
  @Public()
  @Throttle({ default: AUTH_THROTTLE.passwordReset })
  @Mutation(() => Boolean)
  forgotPassword(@Args('email') email: string): Promise<boolean> {
    return this.authService.forgotPassword(email);
  }

  @Public()
  @Mutation(() => Boolean)
  async confirmForgotPassword(
    @Args('confirmForgotPasswordDto')
    confirmForgotPasswordDto: ConfirmForgotPasswordDto,
  ): Promise<boolean> {
    let passwordUpdated: boolean;
    try {
      passwordUpdated = await this.authService.confirmForgotPassword(
        confirmForgotPasswordDto,
      );
    } catch (error) {
      throw new UserInputError(error.message);
    }
    return passwordUpdated;
  }

  /** Administration */
  @Mutation(() => Boolean)
  @Roles(Role.Admin)
  async confirmUser(
    @Args({ name: 'id', type: () => ID }) id: string,
  ): Promise<boolean> {
    const result = await this.authService.confirmUser(id);
    if (!result) throw new UserInputError('User not confirmed!');
    return result;
  }

  @Mutation(() => Boolean)
  @Roles(Role.Admin)
  async addAdminPermission(
    @Args({ name: 'id', type: () => ID }) id: string,
  ): Promise<boolean> {
    const result = await this.authService.addPermission(id, Role.Admin);
    if (!result)
      throw new UserInputError('Admin Permissions were not granted!');
    return result;
  }

  @Mutation(() => Boolean)
  @Roles(Role.Admin)
  async removeAdminPermission(
    @Args({ name: 'id', type: () => ID }) id: string,
  ): Promise<boolean> {
    const result = await this.authService.removePermission(id, Role.Admin);
    if (!result)
      throw new UserInputError('Admin Permissions were not revoked!');
    return result;
  }

  // ============================================
  // Passkey (WebAuthn) Mutations
  // Rate limited: 10 attempts per minute
  // @see https://github.com/CommonwealthLabsCode/qckstrt/issues/187
  // ============================================

  @Public()
  @Throttle({ default: AUTH_THROTTLE.passkey })
  @Mutation(() => PasskeyRegistrationOptions)
  async generatePasskeyRegistrationOptions(
    @Args('input') input: GeneratePasskeyRegistrationOptionsDto,
  ): Promise<PasskeyRegistrationOptions> {
    try {
      const user = await this.authService.getUserByEmail(input.email);
      if (!user) {
        throw new UserInputError('User not found');
      }

      const options = await this.passkeyService.generateRegistrationOptions(
        user.id,
        user.email,
        user.firstName || user.email,
      );

      return { options };
    } catch (error) {
      throw new UserInputError(error.message);
    }
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.passkey })
  @Mutation(() => Boolean)
  async verifyPasskeyRegistration(
    @Args('input') input: VerifyPasskeyRegistrationDto,
  ): Promise<boolean> {
    try {
      const user = await this.authService.getUserByEmail(input.email);
      if (!user) {
        throw new UserInputError('User not found');
      }

      const verification = await this.passkeyService.verifyRegistration(
        input.email,
        input.response,
      );

      if (verification.verified) {
        await this.passkeyService.saveCredential(
          user.id,
          verification,
          input.friendlyName,
        );

        // Update user's auth strategy to passkey (most secure method)
        await this.usersService.updateAuthStrategy(
          user.id,
          AuthStrategy.PASSKEY,
        );

        return true;
      }

      return false;
    } catch (error) {
      throw new UserInputError(error.message);
    }
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.passkey })
  @Mutation(() => PasskeyAuthenticationOptions)
  async generatePasskeyAuthenticationOptions(
    @Args('input', { nullable: true })
    input?: GeneratePasskeyAuthenticationOptionsDto,
  ): Promise<PasskeyAuthenticationOptions> {
    try {
      const { options, identifier } =
        await this.passkeyService.generateAuthenticationOptions(input?.email);
      return { options, identifier };
    } catch (error) {
      throw new UserInputError(error.message);
    }
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.passkey })
  @Mutation(() => Auth)
  async verifyPasskeyAuthentication(
    @Args('input') input: VerifyPasskeyAuthenticationDto,
    @Context() context: GqlContext,
  ): Promise<Auth> {
    try {
      const { verification, user } =
        await this.passkeyService.verifyAuthentication(
          input.identifier,
          input.response,
        );

      if (!verification.verified) {
        throw new UserInputError('Passkey verification failed');
      }

      // Generate tokens for the authenticated user
      const auth = await this.authService.generateTokensForUser(user);

      // Set httpOnly cookies for browser clients
      if (context.res) {
        setAuthCookies(
          context.res,
          this.configService,
          auth.accessToken,
          auth.refreshToken,
        );
      }

      return auth;
    } catch (error) {
      throw new UserInputError(error.message);
    }
  }

  @Query(() => [PasskeyCredential])
  async myPasskeys(
    @Context() context: GqlContext,
  ): Promise<PasskeyCredential[]> {
    const user = getUserFromContext(context);
    return this.passkeyService.getUserCredentials(user.id);
  }

  @Mutation(() => Boolean)
  async deletePasskey(
    @Args('credentialId') credentialId: string,
    @Context() context: GqlContext,
  ): Promise<boolean> {
    const user = getUserFromContext(context);
    return this.passkeyService.deleteCredential(credentialId, user.id);
  }

  // ============================================
  // Magic Link Mutations
  // Rate limited: 3 attempts per minute
  // @see https://github.com/CommonwealthLabsCode/qckstrt/issues/187
  // ============================================

  @Public()
  @Throttle({ default: AUTH_THROTTLE.magicLink })
  @Mutation(() => Boolean)
  async sendMagicLink(
    @Args('input') input: SendMagicLinkDto,
  ): Promise<boolean> {
    try {
      return await this.authService.sendMagicLink(
        input.email,
        input.redirectTo,
      );
    } catch (error) {
      throw new UserInputError(error.message);
    }
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.magicLink })
  @Mutation(() => Auth)
  async verifyMagicLink(
    @Args('input') input: VerifyMagicLinkDto,
    @Context() context: GqlContext,
  ): Promise<Auth> {
    try {
      const auth = await this.authService.verifyMagicLink(
        input.email,
        input.token,
      );

      // Set httpOnly cookies for browser clients
      if (context.res) {
        setAuthCookies(
          context.res,
          this.configService,
          auth.accessToken,
          auth.refreshToken,
        );
      }

      return auth;
    } catch (error) {
      throw new UserInputError(error.message);
    }
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.magicLink })
  @Mutation(() => Boolean)
  async registerWithMagicLink(
    @Args('input') input: RegisterWithMagicLinkDto,
  ): Promise<boolean> {
    try {
      return await this.authService.registerWithMagicLink(
        input.email,
        input.redirectTo,
      );
    } catch (error) {
      throw new UserInputError(error.message);
    }
  }

  // ============================================
  // Logout
  // ============================================

  @Mutation(() => Boolean)
  async logout(@Context() context: GqlContext): Promise<boolean> {
    // Clear httpOnly auth cookies
    if (context.res) {
      clearAuthCookies(context.res, this.configService);
    }
    return true;
  }
}
