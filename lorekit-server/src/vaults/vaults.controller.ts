import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { VaultsService } from './vaults.service';

@ApiTags('Vaults')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('vaults')
export class VaultsController {
  constructor(private readonly vaults: VaultsService) {}

  @Get()
  @ApiOkResponse({ description: 'Vaults available to the authenticated account.' })
  list(@CurrentAuth() auth: AuthenticatedRequest) {
    return this.vaults.list(auth.userId);
  }
}
