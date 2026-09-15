import * as dotenv from 'dotenv';

dotenv.config();

const REQUIRED_KEYS = [
  'BASE_URL',
  'API_BASE_URL',
  'X_ACCESS_KEY',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'ANALYTICS_BASIC_USER',
  'ANALYTICS_BASIC_PASSWORD',
] as const;

type EnvKey = (typeof REQUIRED_KEYS)[number];

function readEnv(): Record<EnvKey, string> {
  const missing: string[] = [];
  const values = {} as Record<EnvKey, string>;

  for (const key of REQUIRED_KEYS) {
    const value = process.env[key];
    if (!value) {
      missing.push(key);
    } else {
      values[key] = value;
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill in the values.',
    );
  }

  return values;
}

const raw = readEnv();

export const env = {
  baseUrl: raw.BASE_URL,
  apiBaseUrl: raw.API_BASE_URL,
  accessKey: raw.X_ACCESS_KEY,
  adminEmail: raw.ADMIN_EMAIL,
  adminPassword: raw.ADMIN_PASSWORD,
  analyticsBasicUser: raw.ANALYTICS_BASIC_USER,
  analyticsBasicPassword: raw.ANALYTICS_BASIC_PASSWORD,
};
