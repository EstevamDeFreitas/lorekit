import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class RefreshDto {
  @ApiPropertyOptional({
    description: 'Opaque refresh token for Electron. Web clients use the HttpOnly cookie.',
    format: 'password',
  })
  @IsString()
  @IsOptional()
  @Length(40, 512)
  refreshToken?: string;
}
