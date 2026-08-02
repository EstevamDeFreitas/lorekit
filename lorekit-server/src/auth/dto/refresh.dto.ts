import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class RefreshDto {
  @ApiProperty({
    description: 'Opaque refresh token returned by login or refresh.',
    format: 'password',
  })
  @IsString()
  @Length(40, 512)
  refreshToken!: string;
}
