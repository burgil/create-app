#!/usr/bin/env node

import fsExtra from 'fs-extra';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, statSync } from 'fs';

const { pathExists, rm, copy } = fsExtra;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

// Read version from package.json
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8')
);
const VERSION = packageJson.version;

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { force: false };
  let name = null;
  for (const a of args) {
    if (a === '--force' || a === '-f') {
      opts.force = true;
      continue;
    }
    if (!name && !a.startsWith('-')) name = a;
  }
  return { name: name || 'my-app', opts };
}

async function run() {
  console.log(`${colors.cyan}${colors.bright}create-app by Burgil${colors.reset} ${colors.dim}v${VERSION}${colors.reset}`);
  
  const { name, opts } = parseArgs(process.argv);
  const dest = resolve(process.cwd(), name);
  const templateDir = resolve(__dirname, '..', 'template');

  try {
    // Verify template directory exists
    const templateExists = await pathExists(templateDir);
    if (!templateExists) {
      console.error(`${colors.red}✗ Template directory not found at: ${templateDir}${colors.reset}`);
      console.error(`${colors.dim}__dirname: ${__dirname}${colors.reset}`);
      console.error(`${colors.red}This may indicate a packaging issue. Please report this bug.${colors.reset}`);
      process.exit(1);
    }

    // Check if destination already exists
    const exists = await pathExists(dest);
    if (exists) {
      if (!opts.force) {
        console.error(`${colors.red}✗ Destination ${colors.yellow}${name}${colors.red} already exists.${colors.reset}`);
        console.error(`${colors.dim}Use --force to overwrite.${colors.reset}`);
        process.exit(1);
      }
      console.log(`${colors.yellow}⚠ Overwriting existing directory...${colors.reset}`);
      await rm(dest, { recursive: true, force: true });
    }
    if (exists && opts.force) {
      await rm(dest, { recursive: true, force: true });
    }
    
    let copiedCount = 0;
    await copy(templateDir, dest, {
      overwrite: true,
      errorOnExist: false,
      filter: (src) => {
        // Always allow the root template directory
        if (src === templateDir) return true;
        
        const relativePath = src.replace(templateDir, '').replace(/^[\\\/]/, '');
        
        // Exclude node_modules, dist, and other build artifacts
        const pathParts = relativePath.split(/[\\\/]/);
        if (pathParts.includes('node_modules') || 
            pathParts.includes('dist') || 
            pathParts.includes('.cache')) {
          return false;
        }
        
        // Check if it's a directory or file
        let isDirectory;
        try {
          isDirectory = statSync(src).isDirectory();
        } catch (err) {
          return false;
        }
        
        // For files, exclude pnpm-lock.yaml but count everything else
        if (!isDirectory) {
          if (relativePath.endsWith('pnpm-lock.yaml')) {
            return false;
          }
          copiedCount++;
        }
        
        return true;
      }
    });
    
    // Verify the destination was created and has content
    const destExists = await pathExists(dest);
    if (!destExists) {
      console.error(`${colors.red}✗ Destination directory was not created.${colors.reset}`);
      console.error(`${colors.red}The copy operation failed silently.${colors.reset}`);
      process.exit(1);
    }
    
    if (copiedCount === 0) {
      console.error(`${colors.red}✗ Template directory is empty!${colors.reset}`);
      console.error(`${colors.dim}Template path: ${templateDir}${colors.reset}`);
      console.error(`${colors.red}This indicates a packaging issue. The template files were not included.${colors.reset}`);
      await rm(dest, { recursive: true, force: true });
      process.exit(1);
    }
    
    console.log(`\n${colors.green}${colors.bright}✓ Success!${colors.reset} Created ${colors.cyan}${name}${colors.reset} with ${colors.magenta}${copiedCount}${colors.reset} files\n`);
    
    console.log(`${colors.bright}Get started:${colors.reset}`);
    console.log(`  ${colors.cyan}cd ${name}${colors.reset}`);
    console.log(`  ${colors.cyan}pnpm install${colors.reset}`);
    console.log(`  ${colors.cyan}pnpm dev${colors.reset}\n`);
    
    console.log(`${colors.bright}Learn more:${colors.reset}`);
    console.log(`  ${colors.dim}📖 Read the docs in${colors.reset} ${colors.yellow}docs/getting-started.md${colors.reset}`);
    console.log(`  ${colors.dim}⚙️  Customize your app in${colors.reset} ${colors.yellow}docs/customization.md${colors.reset}`);
    console.log(`  ${colors.dim}📜 Review terms in${colors.reset} ${colors.yellow}TOS.md${colors.reset}\n`);
    
    console.log(`${colors.dim}Need help? Ask your AI assistant:${colors.reset}`);
    console.log(`  ${colors.dim}"How do I customize the SEO settings?"${colors.reset}`);
    console.log(`  ${colors.dim}"Show me how to add a new page"${colors.reset}`);
    console.log(`  ${colors.dim}"How do I deploy this project?"${colors.reset}\n`);
  } catch (err) {
    console.error(`${colors.red}✗ Failed to create project: ${err.message || err}${colors.reset}`);
    console.error(`${colors.dim}${err.stack}${colors.reset}`);
    process.exit(1);
  }
}

run();
