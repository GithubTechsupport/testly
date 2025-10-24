/* eslint-disable no-console */
export const logger = {
  info: (message: string, ...optional: unknown[]) => console.log(`[INFO] ${message}`, ...optional),
  warn: (message: string, ...optional: unknown[]) => console.warn(`[WARN] ${message}`, ...optional),
  error: (message: string, ...optional: unknown[]) => console.error(`[ERROR] ${message}`, ...optional),
};
