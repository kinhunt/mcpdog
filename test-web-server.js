#!/usr/bin/env node

import { DaemonWebServer } from './dist/daemon/daemon-web-server.js';
import { MCPDogDaemon } from './dist/daemon/mcpdog-daemon.js';

async function testWebServer() {
  try {
    console.log('Creating daemon...');
    const daemon = new MCPDogDaemon();
    
    console.log('Creating web server...');
    const webServer = new DaemonWebServer(daemon, 3000);
    
    console.log('Starting web server...');
    await webServer.start();
    
    console.log('Web server started successfully!');
    console.log('Visit http://localhost:3000');
    
    // Keep the server running
    process.on('SIGINT', async () => {
      console.log('Shutting down...');
      await webServer.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testWebServer(); 