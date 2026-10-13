import 'dotenv/config';
import { execSync } from 'node:child_process';

export default function globalSetup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://users_api:users_api@localhost:5433/users_api_test?schema=public';
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
