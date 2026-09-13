#!/usr/bin/env node

/**
 * Minehunt AI - Quick Start Launcher
 * 
 * This single file starts the entire Minehunt AI system:
 * 1. Connects to Minecraft server
 * 2. Starts the decision engine
 * 3. Launches the web dashboard at http://localhost:50000
 * 
 * Requirements:
 * - A running Minecraft 1.20.1 server on localhost:25565 (or configured in .env)
 * - Node.js v20+ installed
 * - Dependencies installed (npm install)
 * 
 * Usage:
 *   node quick-start.js
 * 
 * Or on Windows with double-click (if .js files are associated with Node.js):
 *   Double-click this file
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function printBanner() {
  console.clear();
  log(colors.cyan, '╔══════════════════════════════════════════════════════════╗');
  log(colors.cyan, '║                    ⛏️ MINEHUNT AI 🎯                      ║');
  log(colors.cyan, '║         Autonomous Minecraft 1.20.1 Hunter Bot           ║');
  log(colors.cyan, '╚══════════════════════════════════════════════════════════╝');
  console.log('');
}

function checkRequirements() {
  log(colors.blue, '📋 Checking requirements...\n');
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion < 20) {
    log(colors.red, `❌ Node.js version ${nodeVersion} detected. Required: v20 or higher.`);
    return false;
  }
  log(colors.green, `✓ Node.js ${nodeVersion}`);
  
  // Check if node_modules exists
  if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
    log(colors.yellow, '⚠ Dependencies not installed. Installing now...\n');
    
    const npmInstall = spawn('npm', ['install', '--legacy-peer-deps'], {
      stdio: 'inherit',
      cwd: __dirname
    });
    
    return new Promise((resolve) => {
      npmInstall.on('close', (code) => {
        if (code === 0) {
          log(colors.green, '✓ Dependencies installed successfully\n');
          resolve(true);
        } else {
          log(colors.red, '❌ Failed to install dependencies');
          resolve(false);
        }
      });
    });
  }
  
  log(colors.green, '✓ Dependencies installed');
  return true;
}

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    log(colors.green, '✓ Configuration loaded from .env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const targetMatch = envContent.match(/TARGET_PLAYER=(.+)/);
    const hostMatch = envContent.match(/MC_HOST=(.+)/);
    const portMatch = envContent.match(/MC_PORT=(.+)/);
    
    if (targetMatch) {
      log(colors.blue, `  Target: ${targetMatch[1].trim()}`);
    }
    if (hostMatch && portMatch) {
      log(colors.blue, `  Server: ${hostMatch[1].trim()}:${portMatch[1].trim()}`);
    }
    console.log('');
  } else {
    log(colors.yellow, '⚠ No .env file found. Using defaults.');
    log(colors.blue, '  Default target: mr_xyous');
    log(colors.blue, '  Default server: localhost:25565');
    console.log('');
  }
}

async function startBot() {
  log(colors.blue, '🚀 Starting Minehunt AI...\n');
  
  const botProcess = spawn('node', [path.join(__dirname, 'src', 'core', 'bot.js')], {
    stdio: 'inherit',
    cwd: __dirname,
    env: { ...process.env }
  });
  
  botProcess.on('error', (err) => {
    log(colors.red, `❌ Failed to start bot: ${err.message}`);
    process.exit(1);
  });
  
  botProcess.on('close', (code) => {
    if (code !== 0) {
      log(colors.red, `\n❌ Bot exited with code ${code}`);
      log(colors.yellow, '💡 Tip: Make sure your Minecraft 1.20.1 server is running!');
    }
    process.exit(code);
  });
  
  return botProcess;
}

async function main() {
  printBanner();
  
  const requirementsOk = await checkRequirements();
  if (!requirementsOk) {
    process.exit(1);
  }
  
  loadEnvFile();
  
  log(colors.green, '✅ All requirements met!\n');
  log(colors.cyan, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('');
  log(colors.blue, '📊 Dashboard will be available at:');
  log(colors.bright, '   http://localhost:50000');
  console.log('');
  log(colors.yellow, '⚠️  IMPORTANT: Make sure your Minecraft 1.20.1 server is running!');
  log(colors.blue, '   If not started yet, open another terminal and run your server.');
  console.log('');
  log(colors.cyan, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('');
  
  // Small delay to let user read the info
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Start the bot (which also starts the dashboard)
  await startBot();
}

// Run the launcher
main().catch((err) => {
  log(colors.red, `❌ Fatal error: ${err.message}`);
  process.exit(1);
});
