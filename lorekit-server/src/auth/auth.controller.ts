import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AccessTokenGuard } from './access-token.guard';
import { AuthService } from './auth.service';
import { AuthResponse, AuthenticatedRequest } from './auth.types';
import { CurrentAuth } from './current-auth.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { WebSessionCookieService } from './web-session-cookie.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly webCookie: WebSessionCookieService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Authenticated session created.' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  async login(
    @Body() input: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    if (input.platform === 'web') {
      this.webCookie.requireAllowedOrigin(request);
    }
    const response = await this.auth.login(input, this.metadata(request));
    if (input.platform === 'web' && response.refreshToken) {
      this.webCookie.set(reply, response.refreshToken);
      return this.withoutRefreshToken(response);
    }
    return response;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Refresh token rotated and new access token issued.' })
  @ApiUnauthorizedResponse({ description: 'Invalid, expired, or reused refresh token.' })
  async refresh(
    @Body() input: RefreshDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    const refresh = this.webCookie.requireToken(request, input.refreshToken);
    const response = await this.auth.refresh(refresh.token, this.metadata(request));
    if (refresh.fromCookie && response.refreshToken) {
      this.webCookie.set(reply, response.refreshToken);
      return this.withoutRefreshToken(response);
    }
    return response;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse({ description: 'Current session revoked.' })
  async logout(
    @CurrentAuth() authentication: AuthenticatedRequest,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    if (this.webCookie.read(request)) {
      this.webCookie.requireAllowedOrigin(request);
      this.webCookie.clear(reply);
    }
    await this.auth.logout(authentication, this.metadata(request));
  }

  @Post('revoke-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse({ description: 'All sessions for the user revoked.' })
  async revokeAll(
    @CurrentAuth() authentication: AuthenticatedRequest,
    @Req() request: FastifyRequest,
  ): Promise<void> {
    await this.auth.revokeAll(authentication, this.metadata(request));
  }

  private withoutRefreshToken(response: AuthResponse): AuthResponse {
    const sanitized = { ...response };
    delete sanitized.refreshToken;
    return sanitized;
  }

  private metadata(request: FastifyRequest): {
    ipAddress: string;
    userAgent?: string;
  } {
    const userAgent = request.headers['user-agent'];
    return {
      ipAddress: request.ip,
      userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    };
  }
}
