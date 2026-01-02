import { UserInputError } from '@nestjs/apollo';
import {
  getUserFromContext,
  getSessionTokenFromContext,
  GqlContext,
} from './graphql-context';
import { ILogin } from 'src/interfaces/login.interface';

describe('getUserFromContext', () => {
  const mockValidUser: ILogin = {
    id: 'user-123',
    email: 'test@example.com',
    roles: ['User'],
    department: 'Engineering',
    clearance: 'Secret',
  };

  it('should extract user from valid context', () => {
    const context: GqlContext = {
      req: {
        user: mockValidUser,
        headers: {},
      },
    };

    const result = getUserFromContext(context);

    expect(result).toEqual(mockValidUser);
  });

  it('should throw UserInputError when user is missing', () => {
    const context: GqlContext = {
      req: {
        headers: {},
      },
    };

    expect(() => getUserFromContext(context)).toThrow(UserInputError);
    expect(() => getUserFromContext(context)).toThrow('User not authenticated');
  });

  it('should throw UserInputError when user is undefined', () => {
    const context: GqlContext = {
      req: {
        user: undefined,
        headers: {},
      },
    };

    expect(() => getUserFromContext(context)).toThrow('User not authenticated');
  });

  describe('security: ignores headers.user', () => {
    it('should NOT trust headers.user - only req.user', () => {
      // This test verifies the security fix - we should NOT check headers.user
      // because that can be spoofed. We only trust request.user set by passport.
      const context = {
        req: {
          user: undefined,
          headers: {
            // Even if headers.user is set, we should not trust it
            user: JSON.stringify({
              id: 'spoofed-user',
              email: 'spoofed@example.com',
              roles: ['Admin'],
              department: 'Engineering',
              clearance: 'TopSecret',
            }),
          },
        },
      } as unknown as GqlContext;

      // Should throw because request.user is undefined, ignoring spoofed headers.user
      expect(() => getUserFromContext(context)).toThrow(
        'User not authenticated',
      );
    });
  });
});

describe('getSessionTokenFromContext', () => {
  it('should extract token from Bearer authorization header', () => {
    const context: GqlContext = {
      req: {
        headers: {
          authorization: 'Bearer my-jwt-token',
        },
      },
    };

    const result = getSessionTokenFromContext(context);

    expect(result).toBe('my-jwt-token');
  });

  it('should handle case-insensitive Bearer prefix', () => {
    const context: GqlContext = {
      req: {
        headers: {
          authorization: 'bearer my-jwt-token',
        },
      },
    };

    const result = getSessionTokenFromContext(context);

    expect(result).toBe('my-jwt-token');
  });

  it('should return undefined when no authorization header', () => {
    const context: GqlContext = {
      req: {
        headers: {},
      },
    };

    const result = getSessionTokenFromContext(context);

    expect(result).toBeUndefined();
  });

  it('should return undefined when authorization header is empty', () => {
    const context: GqlContext = {
      req: {
        headers: {
          authorization: '',
        },
      },
    };

    const result = getSessionTokenFromContext(context);

    expect(result).toBeUndefined();
  });
});
