#!/usr/bin/env node
import process from 'process';

const Colors = {
  BLUE: '\x1b[34m',
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  CYAN: '\x1b[36m',
  MAGENTA: '\x1b[35m',
  BRIGHT: '\x1b[1m',
  RESET: '\x1b[0m'
};

const DEFAULT_HOST = process.env.PREVIEW_HOST || 'localhost';
const DEFAULT_PORT = process.env.PREVIEW_PORT || '4173';
const DEFAULT_PATH = process.env.PREVIEW_PATH || '/';

const args = process.argv.slice(2);
let host = DEFAULT_HOST;
let port = DEFAULT_PORT;
let pathArg = DEFAULT_PATH;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if ((a === '--host' || a === '-h') && args[i + 1]) host = args[++i];
  if ((a === '--port' || a === '-p') && args[i + 1]) port = args[++i];
  if ((a === '--path' || a === '-P') && args[i + 1]) pathArg = args[++i];
}

async function main() {
  const baseUrl = `http://${host}:${port}`;
  const url = `${baseUrl}${pathArg}`;
  try {
    console.log(`${Colors.BLUE}[TEST] Testing connection to ${baseUrl}...${Colors.RESET}`);
    const res = await fetch(url, { method: 'GET' });
    if (!res || res.status >= 500) {
      console.error(`\n${Colors.RED}${Colors.BRIGHT}[ERR] ERROR:${Colors.RESET} Server at ${baseUrl} returned status ${res ? res.status : 'None'}`);
      console.error(`${Colors.YELLOW}Please ensure the preview server is running with: ${Colors.CYAN}pnpm preview${Colors.RESET}`);
      process.exit(1);
    }
    console.log(`${Colors.GREEN}[OK] Server is running at ${baseUrl}${Colors.RESET}\n`);
    process.exit(0);
  } catch (e) {
    console.error(`\n${Colors.RED}${Colors.BRIGHT}[ERR] ERROR:${Colors.RESET} Cannot connect to server at ${baseUrl}`);
    console.error(`${Colors.RED}Error: ${e}${Colors.RESET}`);
    console.error(`\n${Colors.YELLOW}Please ensure the preview server is running in another terminal:${Colors.RESET}`);
    console.error(`  ${Colors.BRIGHT}1.${Colors.RESET} Run: ${Colors.CYAN}pnpm preview${Colors.RESET}`);
    console.error(`  ${Colors.BRIGHT}2.${Colors.RESET} Wait for server to start on port ${Colors.MAGENTA}${port}${Colors.RESET}`);
    console.error(`  ${Colors.BRIGHT}3.${Colors.RESET} Run this script again\n`);
    process.exit(1);
  }
}

main();
