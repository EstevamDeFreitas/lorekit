import { Injectable } from '@nestjs/common';
import { AppEnvironment, loadEnvironment } from './environment';

@Injectable()
export class EnvironmentService {
  readonly values: AppEnvironment = loadEnvironment();
}
