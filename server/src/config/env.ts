import 'dotenv/config';

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    throw new Error(`${name} is required`);
  }

  return value;
}

function getOptionalEnv(name: string, fallback: string): string {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    return fallback;
  }

  return value;
}

export const env = {
  nodeEnv: getOptionalEnv('NODE_ENV', 'development'),
  jwtAccessSecret: getRequiredEnv('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: getRequiredEnv('JWT_REFRESH_SECRET'),
  jwtAccessExpiresIn: getOptionalEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
  jwtRefreshExpiresIn: getOptionalEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
};
