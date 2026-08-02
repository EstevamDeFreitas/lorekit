import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { EnvironmentService } from '../config/environment.service';
import { DatabaseService } from '../database/database.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly environment: EnvironmentService,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'API and database are ready.' })
  @ApiServiceUnavailableResponse({ description: 'Database is unavailable.' })
  async readiness(): Promise<{
    status: 'ok';
    service: 'lorekit-api';
    version: string;
    database: 'up';
  }> {
    try {
      await this.database.ping();
    } catch {
      throw new ServiceUnavailableException('Database is unavailable');
    }

    return {
      status: 'ok',
      service: 'lorekit-api',
      version: this.environment.values.appVersion,
      database: 'up',
    };
  }
}
