import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { Sql } from 'postgres';
import { EnvironmentService } from '../config/environment.service';
import * as schema from './schema';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly client: Sql;
  readonly db: PostgresJsDatabase<typeof schema>;

  constructor(environment: EnvironmentService) {
    const config = environment.values.database;
    this.client = postgres({
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.user,
      password: config.password,
      ssl: config.ssl ? 'require' : false,
      max: config.maxConnections,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: true,
    });
    this.db = drizzle(this.client, { schema });
  }

  async ping(): Promise<void> {
    await this.client`select 1`;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}
