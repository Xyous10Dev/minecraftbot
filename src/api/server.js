const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { getConfig } = require('../core/config');
const { getLogger } = require('../core/logger');

/**
 * Web dashboard and API server
 * Provides real-time monitoring on localhost:50000
 */
class DashboardServer {
  constructor(botController) {
    this.config = getConfig();
    this.logger = getLogger();
    this.botController = botController;
    
    this.app = express();
    this.server = null;
    this.wss = null;
    
    this.clients = new Set();
  }
  
  /**
   * Start the dashboard server
   */
  start() {
    const host = this.config.dashboardHost;
    const port = this.config.dashboardPort;
    
    // Setup Express
    this.app.use(express.json());
    
    // Serve static HTML for dashboard
    this.app.get('/', (req, res) => {
      res.send(this.getDashboardHTML());
    });
    
    // API endpoints
    this.setupAPIRoutes();
    
    // Create HTTP server
    this.server = http.createServer(this.app);
    
    // Create WebSocket server for real-time updates
    this.wss = new WebSocket.Server({ server: this.server, path: '/ws' });
    
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      this.logger.info('Dashboard client connected');
      
      ws.on('close', () => {
        this.clients.delete(ws);
        this.logger.info('Dashboard client disconnected');
      });
      
      // Send initial status
      this.sendToClient(ws, { type: 'init', data: this.botController.getStatus() });
    });
    
    return new Promise((resolve, reject) => {
      this.server.listen(port, host, () => {
        this.logger.info(`Dashboard running at http://${host}:${port}`);
        resolve();
      });
      
      this.server.on('error', (err) => {
        this.logger.error('Dashboard server error:', err.message);
        reject(err);
      });
    });
  }
  
  /**
   * Setup REST API routes
   */
  setupAPIRoutes() {
    // Status endpoint
    this.app.get('/api/status', (req, res) => {
      res.json(this.botController.getStatus());
    });
    
    // Target info
    this.app.get('/api/target', (req, res) => {
      const targetInfo = this.botController.targetTracker?.getStatus() || null;
      res.json(targetInfo);
    });
    
    // Inventory (placeholder - would need inventory plugin)
    this.app.get('/api/inventory', (req, res) => {
      res.json({ items: [], message: 'Inventory tracking requires additional plugins' });
    });
    
    // Telemetry
    this.app.get('/api/telemetry', (req, res) => {
      const decisionInfo = this.botController.decisionEngine?.getStatus() || null;
      res.json(decisionInfo);
    });
    
    // Logs (recent logs would be stored in memory)
    this.app.get('/api/logs', (req, res) => {
      res.json({ logs: [], message: 'Log streaming not yet implemented' });
    });
    
    // Control endpoints
    this.app.post('/api/control/start', (req, res) => {
      res.json({ success: true, message: 'Start command received (REQUIRES_LIVE_MINECRAFT_TEST)' });
    });
    
    this.app.post('/api/control/stop', (req, res) => {
      this.botController.disconnect();
      res.json({ success: true, message: 'Bot stopped' });
    });
    
    this.app.post('/api/control/pause', (req, res) => {
      res.json({ success: true, message: 'Pause command received (REQUIRES_LIVE_MINECRAFT_TEST)' });
    });
    
    this.app.post('/api/control/resume', (req, res) => {
      res.json({ success: true, message: 'Resume command received (REQUIRES_LIVE_MINECRAFT_TEST)' });
    });
    
    this.app.post('/api/control/reset', (req, res) => {
      res.json({ success: true, message: 'Reset command received (REQUIRES_LIVE_MINECRAFT_TEST)' });
    });
  }
  
  /**
   * Broadcast status to all WebSocket clients
   */
  broadcast(data) {
    const message = JSON.stringify(data);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
  
  /**
   * Send to specific client
   */
  sendToClient(client, data) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  }
  
  /**
   * Push status update to all clients
   */
  pushUpdate() {
    const status = this.botController.getStatus();
    this.broadcast({ type: 'update', data: status });
  }
  
  /**
   * Get dashboard HTML
   */
  getDashboardHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Minehunt Control Center</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      min-height: 100vh;
    }
    .header {
      background: linear-gradient(135deg, #1f6feb 0%, #1a4c9e 100%);
      padding: 20px 40px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    }
    .header h1 { font-size: 28px; color: #fff; }
    .header p { color: #8b949e; margin-top: 5px; }
    .container { max-width: 1400px; margin: 0 auto; padding: 30px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 20px;
    }
    .card h2 {
      font-size: 16px;
      color: #58a6ff;
      margin-bottom: 15px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #21262d;
    }
    .stat-row:last-child { border-bottom: none; }
    .stat-label { color: #8b949e; }
    .stat-value { font-weight: bold; color: #c9d1d9; }
    .stat-value.success { color: #3fb950; }
    .stat-value.warning { color: #d29922; }
    .stat-value.danger { color: #f85149; }
    .status-indicator {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 8px;
    }
    .status-indicator.online { background: #3fb950; box-shadow: 0 0 8px #3fb950; }
    .status-indicator.offline { background: #f85149; }
    .health-bar {
      width: 100%;
      height: 20px;
      background: #21262d;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 10px;
    }
    .health-fill {
      height: 100%;
      background: linear-gradient(90deg, #f85149, #3fb950);
      transition: width 0.3s ease;
    }
    .log-entry {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      padding: 5px 0;
      border-bottom: 1px solid #21262d;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #8b949e;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>⛏️ Minehunt Control Center</h1>
    <p>Autonomous Minecraft Hunter Dashboard</p>
  </div>
  
  <div class="container">
    <div class="grid">
      <!-- Bot Status -->
      <div class="card">
        <h2>🤖 Bot Status</h2>
        <div class="stat-row">
          <span class="stat-label"><span id="statusIndicator" class="status-indicator offline"></span>Connection</span>
          <span class="stat-value" id="connectionStatus">Disconnected</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Target Player</span>
          <span class="stat-value" id="targetPlayer">-</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Minecraft Server</span>
          <span class="stat-value" id="mcServer">localhost:25565</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Dimension</span>
          <span class="stat-value" id="dimension">-</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Position</span>
          <span class="stat-value" id="position">-</span>
        </div>
      </div>
      
      <!-- Health & Food -->
      <div class="card">
        <h2>❤️ Health & Food</h2>
        <div class="stat-row">
          <span class="stat-label">Health</span>
          <span class="stat-value" id="healthValue">20 / 20</span>
        </div>
        <div class="health-bar">
          <div class="health-fill" id="healthBar" style="width: 100%;"></div>
        </div>
        <div class="stat-row" style="margin-top: 15px;">
          <span class="stat-label">Food</span>
          <span class="stat-value" id="foodValue">20 / 20</span>
        </div>
        <div class="health-bar">
          <div class="health-fill" id="foodBar" style="width: 100%; background: linear-gradient(90deg, #d29922, #f0e067);"></div>
        </div>
      </div>
      
      <!-- Target Info -->
      <div class="card">
        <h2>🎯 Target Information</h2>
        <div class="stat-row">
          <span class="stat-label">Distance</span>
          <span class="stat-value" id="targetDistance">Unknown</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Last Seen</span>
          <span class="stat-value" id="lastSeen">-</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Progression</span>
          <span class="stat-value" id="progression">-</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Target Dimension</span>
          <span class="stat-value" id="targetDimension">-</span>
        </div>
      </div>
      
      <!-- Current State -->
      <div class="card">
        <h2>🧠 Decision Engine</h2>
        <div class="stat-row">
          <span class="stat-label">Current State</span>
          <span class="stat-value" id="currentState">INITIALIZING</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Current Task</span>
          <span class="stat-value" id="currentTask">-</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Preparation Time</span>
          <span class="stat-value" id="prepTime">0s</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Decisions Made</span>
          <span class="stat-value" id="decisionsCount">0</span>
        </div>
      </div>
    </div>
    
    <!-- Recent Activity -->
    <div class="card">
      <h2>📊 Telemetry</h2>
      <div class="grid" style="margin-bottom: 0;">
        <div class="stat-row">
          <span class="stat-label">Total Kills</span>
          <span class="stat-value success" id="totalKills">0</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Deaths</span>
          <span class="stat-value danger" id="totalDeaths">0</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Uptime</span>
          <span class="stat-value" id="uptime">0s</span>
        </div>
      </div>
    </div>
  </div>
  
  <div class="footer">
    Minehunt AI v1.0.0 | Dashboard updates every 1 second
  </div>
  
  <script>
    let ws = null;
    
    function connectWebSocket() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(\`\${protocol}//\${window.location.host}/ws\`);
      
      ws.onopen = () => {
        document.getElementById('statusIndicator').className = 'status-indicator online';
        document.getElementById('connectionStatus').textContent = 'Connected';
      };
      
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'update' || message.type === 'init') {
          updateDashboard(message.data);
        }
      };
      
      ws.onclose = () => {
        document.getElementById('statusIndicator').className = 'status-indicator offline';
        document.getElementById('connectionStatus').textContent = 'Disconnected';
        setTimeout(connectWebSocket, 3000);
      };
    }
    
    function updateDashboard(data) {
      // Bot Status
      document.getElementById('targetPlayer').textContent = data.targetPlayer || '-';
      document.getElementById('dimension').textContent = data.dimension || '-';
      if (data.position) {
        document.getElementById('position').textContent = 
          \`\${data.position.x}, \${data.position.y}, \${data.position.z}\`;
      }
      
      // Health & Food
      document.getElementById('healthValue').textContent = \`\${Math.round(data.health || 0)} / 20\`;
      document.getElementById('healthBar').style.width = \`\${(data.health || 0) / 20 * 100}%\`;
      document.getElementById('foodValue').textContent = \`\${Math.round(data.food || 0)} / 20\`;
      document.getElementById('foodBar').style.width = \`\${(data.food || 0) / 20 * 100}%\`;
      
      // Target Info
      if (data.targetInfo) {
        document.getElementById('targetDistance').textContent = 
          data.targetInfo.distance ? \`\${data.targetInfo.distance.toFixed(1)} blocks\` : 'Unknown';
        document.getElementById('targetDimension').textContent = data.targetInfo.dimension || '-';
        document.getElementById('progression').textContent = data.targetInfo.estimatedProgression || '-';
        if (data.targetInfo.lastSeen) {
          const seconds = Math.floor((Date.now() - data.targetInfo.lastSeen) / 1000);
          document.getElementById('lastSeen').textContent = \`\${seconds}s ago\`;
        }
      }
      
      // Decision Engine
      if (data.decisionInfo) {
        document.getElementById('currentState').textContent = data.decisionInfo.currentState || '-';
        document.getElementById('currentTask').textContent = data.decisionInfo.currentTask || '-';
        
        // Show preparation timer prominently
        const prepRemaining = data.decisionInfo.preparationRemaining;
        const isInPrep = data.decisionInfo.isInPreparation;
        if (isInPrep && prepRemaining !== undefined) {
          document.getElementById('prepTime').textContent = 
            `PREPARATION ${Math.ceil(prepRemaining)}s / 60s`;
          document.getElementById('prepTime').style.color = '#d29922';
        } else if (prepRemaining !== undefined) {
          document.getElementById('prepTime').textContent = 'READY TO HUNT';
          document.getElementById('prepTime').style.color = '#3fb950';
        } else {
          document.getElementById('prepTime').textContent = Math.ceil(data.decisionInfo.preparationTime || 0) + 's';
        }
        
        document.getElementById('decisionsCount').textContent = 
          data.decisionInfo.telemetry?.totalDecisions || 0;
        document.getElementById('totalKills').textContent = 
          data.decisionInfo.telemetry?.kills || 0;
        document.getElementById('totalDeaths').textContent = 
          data.decisionInfo.telemetry?.deaths || 0;
      }
      
      // Uptime
      document.getElementById('uptime').textContent = 
        Math.floor((data.uptime || 0) / 1000) + 's';
    }
    
    // Connect on load
    connectWebSocket();
  </script>
</body>
</html>`;
  }
}

module.exports = { DashboardServer };
