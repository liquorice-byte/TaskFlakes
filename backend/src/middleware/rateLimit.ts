import rateLimit from 'express-rate-limit';
import { CONSTANTS } from '../config/constants.js';
import { config } from '../config/index.js';

// In local development the integration-test scripts register/login
// many times in succession. Ease up limits there so tests don't hit 429;
// keep the production config intact (auth: 5 / 15 min).
const DEV_BOOST = config.isDevelopment ? 50 : 1;

export const authRateLimit = rateLimit({
  windowMs: CONSTANTS.RATE_LIMIT.auth.windowMs,
  max: CONSTANTS.RATE_LIMIT.auth.max * DEV_BOOST,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many attempts. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiRateLimit = rateLimit({
  windowMs: CONSTANTS.RATE_LIMIT.api.windowMs,
  max: CONSTANTS.RATE_LIMIT.api.max * DEV_BOOST,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
