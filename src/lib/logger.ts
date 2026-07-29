import path from 'path';
import fs from 'fs';

const LOG_LEVELS = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

type LogLevel = keyof typeof LOG_LEVELS;

const currentLevel = (process.env.LOG_LEVEL?.toLowerCase() as LogLevel) || 'info';
const currentLevelValue = LOG_LEVELS[currentLevel] ?? 2;

const isProd = process.env.NODE_ENV === 'production';

function ensureDirectoryExists(filePath: string) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {
    console.error('Failed to create log directory:', e);
  }
}

function writeLog(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const levelVal = LOG_LEVELS[level];
  if (levelVal < currentLevelValue) return;

  const timestamp = new Date().toISOString();
  let logOutput = '';

  if (isProd) {
    // Structured JSON log output for Production
    logOutput = JSON.stringify({
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta,
    });
  } else {
    // Colorized/pretty output for Dev/QA
    const colors = {
      trace: '\x1b[90m', // Gray
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
      reset: '\x1b[0m',
    };
    const color = colors[level] || colors.reset;
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    logOutput = `[${timestamp}] ${color}${level.toUpperCase()}${colors.reset}: ${message}${metaStr}`;
  }

  // Console output
  if (level === 'error') {
    console.error(logOutput);
  } else if (level === 'warn') {
    console.warn(logOutput);
  } else {
    console.log(logOutput);
  }

  // File logging (if LOG_PATH is configured in the environment)
  const logPath = process.env.LOG_PATH;
  if (logPath) {
    try {
      ensureDirectoryExists(logPath);
      fs.appendFileSync(logPath, (isProd ? logOutput : logOutput.replace(/\x1b\[[0-9;]*m/g, '')) + '\n', 'utf-8');
    } catch (e) {
      console.error('Failed to write log to file:', e);
    }
  }
}

export const logger = {
  trace: (msg: string, meta?: Record<string, unknown>) => writeLog('trace', msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => writeLog('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => writeLog('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => writeLog('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => writeLog('error', msg, meta),
};
