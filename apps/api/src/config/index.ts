import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const config = {
  get port() { return parseInt(process.env.API_PORT || '5000', 10); },
  get host() { return process.env.API_HOST || 'localhost'; },
  get nodeEnv() { return process.env.NODE_ENV || 'development'; },
  get isDev() { return (process.env.NODE_ENV || 'development') === 'development'; },

  get mongodb() {
    return {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/decisiontrace',
    };
  },

  get jwt() {
    return {
      secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production-min32chars',
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    };
  },

  get checkpoint() {
    return {
      hmacSecret: process.env.CHECKPOINT_HMAC_SECRET || 'dev-hmac-secret-change-in-production-min32chars',
      intervalEvents: parseInt(process.env.CHECKPOINT_INTERVAL_EVENTS || '10', 10),
    };
  },

  get rateLimit() {
    return {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    };
  },

  get logLevel() { return process.env.LOG_LEVEL || 'info'; },
};

// Validate required secrets in non-test environments
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.jwt.secret || config.jwt.secret === 'CHANGE_ME_jwt_secret_min_32_chars_long') {
    if (config.nodeEnv === 'production') {
      errors.push('JWT_SECRET must be set and changed from default in production');
    }
  }

  if (!config.checkpoint.hmacSecret || config.checkpoint.hmacSecret === 'CHANGE_ME_hmac_secret_min_32_chars_long') {
    if (config.nodeEnv === 'production') {
      errors.push('CHECKPOINT_HMAC_SECRET must be set and changed from default in production');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}
