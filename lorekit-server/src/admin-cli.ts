import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AdminService } from './admin/admin.service';
import { AppModule } from './app.module';
import { readSecret } from './config/environment';

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  return value && !value.startsWith('--') ? value : undefined;
}

function requiredOption(args: string[], name: string): string {
  const value = option(args, name);
  if (!value) throw new Error(`Missing required option: ${name}`);
  return value;
}

function password(args: string[]): string {
  const explicitFile = option(args, '--password-file');
  const fromStdin = args.includes('--password-stdin');
  if (explicitFile && fromStdin) {
    throw new Error('Use either --password-file or --password-stdin, not both');
  }
  if (fromStdin) {
    const value = readFileSync(0, 'utf8').replace(/\r?\n$/, '');
    if (!value) throw new Error('Password received from stdin is empty');
    if (/[\r\n]/.test(value)) {
      throw new Error('Password received from stdin must contain a single line');
    }
    return value;
  }
  if (explicitFile) {
    const value = readFileSync(explicitFile, 'utf8').trim();
    if (!value) throw new Error('Password file is empty');
    return value;
  }
  return readSecret('LOREKIT_NEW_USER_PASSWORD')!;
}

function printHelp(): void {
  console.log(`Lorekit administrative CLI

Commands:
  user:create --email EMAIL [--name NAME] [--vault-name NAME] [--password-file PATH | --password-stdin]
  user:list
  user:disable --email EMAIL
  user:enable --email EMAIL
  user:reset-password --email EMAIL [--password-file PATH | --password-stdin]

Instead of --password-file, set LOREKIT_NEW_USER_PASSWORD_FILE.
Use --password-stdin with the VPS helper so the password is neither an argument
nor a temporary file.
Passwords are intentionally not accepted as command-line arguments.`);
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  const application = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const admin = application.get(AdminService);
    switch (command) {
      case 'user:create': {
        const created = await admin.createUser({
          email: requiredOption(args, '--email'),
          password: password(args),
          displayName: option(args, '--name'),
          vaultName: option(args, '--vault-name'),
        });
        console.log(JSON.stringify(created, null, 2));
        break;
      }
      case 'user:list':
        console.log(JSON.stringify(await admin.listUsers(), null, 2));
        break;
      case 'user:disable':
        console.log(
          JSON.stringify(
            await admin.setUserActive(requiredOption(args, '--email'), false),
            null,
            2,
          ),
        );
        break;
      case 'user:enable':
        console.log(
          JSON.stringify(
            await admin.setUserActive(requiredOption(args, '--email'), true),
            null,
            2,
          ),
        );
        break;
      case 'user:reset-password':
        await admin.resetPassword(requiredOption(args, '--email'), password(args));
        console.log('Password updated and all existing sessions revoked.');
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } finally {
    await application.close();
  }
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
