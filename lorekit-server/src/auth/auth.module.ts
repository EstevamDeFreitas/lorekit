import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AccessTokenGuard } from './access-token.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { PasswordService } from './password.service';
import { WebSessionCookieService } from './web-session-cookie.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AccessTokenGuard,
    AuthService,
    AuthTokenService,
    PasswordService,
    WebSessionCookieService,
  ],
  exports: [AccessTokenGuard, AuthService, AuthTokenService, PasswordService],
})
export class AuthModule {}
