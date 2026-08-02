import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'autor@example.com' })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ format: 'password' })
  @IsString()
  @Length(1, 1024)
  password!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @ApiPropertyOptional({ example: 'Notebook principal' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  deviceName?: string;

  @ApiPropertyOptional({ example: 'windows' })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  platform?: string;

  @ApiPropertyOptional({ example: '0.21.5' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;
}
