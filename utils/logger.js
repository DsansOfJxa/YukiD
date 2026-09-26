import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').slice(0, 19);
}

function writeLog(level, message, error = null) {
  try {
    const timestamp = getTimestamp();
    let logLine = `[${timestamp}] [${level}] ${message}`;
    if (error && error.stack) {
      logLine += `\n${error.stack}`;
    } else if (error) {
      logLine += `\n${error}`;
    }
    
    const logFile = path.join(logDir, level === 'ERROR' ? 'error.log' : 'combined.log');
    fs.appendFileSync(logFile, logLine + '\n', 'utf8');
  } catch {}
}

const Logger = {
  info: (msg) => {
    console.log(chalk.bgBlue.white.bold(` INFO `), chalk.white(msg));
    writeLog('INFO', msg);
  },
  success: (msg) => {
    console.log(chalk.bgGreen.white.bold(` SUCCESS `), chalk.greenBright(msg));
    writeLog('SUCCESS', msg);
  },
  warn: (msg) => {
    console.log(chalk.bgYellow.black.bold(` WARN `), chalk.yellow(msg));
    writeLog('WARN', msg);
  },
  error: (msg, err = null) => {
    console.log(chalk.bgRed.white.bold(` ERROR `), chalk.redBright(msg));
    if (err) console.error(chalk.red(err.stack || err));
    writeLog('ERROR', msg, err);
  },
  debug: (msg) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(chalk.bgMagenta.white.bold(` DEBUG `), chalk.magenta(msg));
    }
  }
};

export default Logger;
