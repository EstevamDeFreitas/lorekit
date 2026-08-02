import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
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
import { FastifyRequest } from 'fastify';
import { AccessTokenGuard } from './access-token.guard';
import { AuthService } from './auth.service';
import { AuthResponse, AuthenticatedRequest } from './auth.types';
import { CurrentAuth } from './current-auth.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Authenticated session created.' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  login(@Body() input: LoginDto, @Req() request: FastifyRequest): Promise<AuthResponse> {
    return this.auth.login(input, this.metadata(request));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Refresh token rotated and new access token issued.' })
  @ApiUnauthorizedResponse({ description: 'Invalid, expired, or reused refresh token.' })
  refresh(
    @Body() input: RefreshDto,
    @Req() request: FastifyRequest,
  ): Promise<AuthResponse> {
    return this.auth.refresh(input.refreshToken, this.metadata(request));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse({ description: 'Current session revoked.' })
  async logout(
    @CurrentAuth() authentication: AuthenticatedRequest,
    @Req() request: FastifyRequest,
  ): Promise<void> {
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
