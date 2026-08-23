export const CONSTANTS = {
  TOKEN_TYPE: 'Bearer',
  REFRESH_COOKIE_NAME: 'refresh_token',
  BCRYPT_SALT_ROUNDS: 12,
  RATE_LIMIT: {
    auth: { windowMs: 15 * 60 * 1000, max: 5 },
    api: { windowMs: 15 * 60 * 1000, max: 100 },
  },
} as const;
