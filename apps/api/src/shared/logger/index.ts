import winston from 'winston';
import { config } from '../../config';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  config.isDev
    ? winston.format.combine(winston.format.colorize(), winston.format.simple())
    : winston.format.json()
);

export const logger = winston.createLogger({
  level: config.logLevel,
  format: logFormat,
  defaultMeta: { service: 'decisiontrace-api' },
  transports: [new winston.transports.Console()],
});
