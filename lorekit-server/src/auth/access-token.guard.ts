import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { AuthenticatedRequest } from './auth.types';

export type RequestWithAuthentication = FastifyRequest & {
  authentication?: AuthenticatedRequest;
};

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly tokens: AuthTokenService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuthentication>();
    const authorization = request.headers.authorization;
    if (!authorization) {
      throw new UnauthorizedException('Bearer token is required');
    }

    const [scheme, token, extra] = authorization.trim().split(/\s+/);
    if (scheme?.toLowerCase() !== 'bearer' || !token || extra) {
      throw new UnauthorizedException('Bearer token is malformed');
    }

    const payload = await this.tokens.verify(token);
    request.authentication = await this.auth.authenticate(payload);
    return true;
  }
}
