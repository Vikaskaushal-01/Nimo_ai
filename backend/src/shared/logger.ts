/**
 * Minimal structured logger. Emits single-line JSON in production (easy to
 * ship to a log aggregator) and pretty lines in development. A real iteration
 * would swap this for pino/winston behind the same interface.
 */
import { env } from "../config/env.js";

type Level = "debug" | "info" | "warn" | "error";

const COLORS: Record<Level, string> = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};
const RESET = "\x1b[0m";

const write = (level: Level, message: string, context?: Record<string, unknown>) => {
  const timestamp = new Date().toISOString();
  if (env.NODE_ENV === "production") {
    // eslint-disable-next-line no-console
    console[level === "debug" ? "log" : level](
      JSON.stringify({ timestamp, level, message, ...context }),
    );
    return;
  }
  const ctx = context && Object.keys(context).length ? ` ${JSON.stringify(context)}` : "";
  // eslint-disable-next-line no-console
  console[level === "debug" ? "log" : level](
    `${COLORS[level]}${timestamp} ${level.toUpperCase()}${RESET} ${message}${ctx}`,
  );
};

export const logger = {
  debug: (m: string, c?: Record<string, unknown>) => write("debug", m, c),
  info: (m: string, c?: Record<string, unknown>) => write("info", m, c),
  warn: (m: string, c?: Record<string, unknown>) => write("warn", m, c),
  error: (m: string, c?: Record<string, unknown>) => write("error", m, c),
};
