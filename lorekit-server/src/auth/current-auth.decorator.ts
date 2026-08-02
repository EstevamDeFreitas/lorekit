import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { RequestWithAuthentication } from './access-token.guard';
import { AuthenticatedRequest } from './auth.types';

export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedRequest => {
    const request = context.switchToHttp().getRequest<RequestWithAuthentication>();
    if (!request.authentication) {
      throw new UnauthorizedException('Authentication context is missing');
    }
    return request.authentication;
  },
);
