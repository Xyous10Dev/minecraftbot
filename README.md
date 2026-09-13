# ⛏️ Minehunt AI

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Minecraft](https://img.shields.io/badge/Minecraft-1.20.1-brightgreen.svg)](https://www.minecraft.net/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## An autonomous Minecraft 1.20.1 hunter designed to stop a player from completing the game.

Minehunt AI is a production-quality Minecraft bot that behaves like an extremely experienced survival/hunter player with approximately **8 years of practical Minecraft knowledge**. Its primary objective is to prevent a target player from completing Minecraft / reaching the End and defeating the Ender Dragon.

---

## 🎯 Core Objective

The bot's mission is not simply to kill a player. It must:

1. **Locate and track** the target player (`mr_xyous` by default)
2. **Prevent progression** - Stop the target from completing Minecraft
3. **Attack strategically** - Interrupt, distract, chase, ambush when useful
4. **Exploit death windows** - Use the 5 minutes after target death to upgrade massively
5. **Adapt dynamically** - Change strategy based on environment and player behavior
6. **Optimize every second** - No wasted actions or movement

---

## ✨ Key Features

### 🧠 Intelligent Decision Engine
- State machine with 18+ distinct states (PREPARATION, COMBAT, CHASE, NETHER_PROGRESS, etc.)
- Emergency priority system that interrupts low-value tasks when target appears
- Dynamic resource scoring based on current strategic needs
- Telemetry and self-improvement tracking

### 🎯 Target Tracking
- Real-time position and distance monitoring
- Velocity and direction estimation
- Progression estimation (early/mid/late game)
- Search memory to avoid redundant area scanning
- Player behavior modeling (aggression,逃跑 tendencies, cave preference)

### ⏱️ Strategic Timing
- **60-second preparation window** - Bot gathers essential resources before engaging
- **5-minute upgrade window** - After target death, bot aggressively upgrades equipment
- Dynamic state transitions based on target proximity

### 🗺️ Advanced Pathfinding
- Built on mineflayer-pathfinder for efficient navigation
- Dynamic replanning when terrain changes
- Stuck detection and recovery
- Water/lava avoidance
- Bridging and climbing capabilities

### ⚔️ Combat System
- Melee and ranged combat support
- Attack timing and critical hits
- Shield usage and defensive positioning
- Health-based emergency retreat
- Kill/death telemetry

### 📊 Web Dashboard
- Real-time monitoring at `http://localhost:50000`
- Live health, food, and position updates
- Target distance and dimension tracking
- Current state and task display
- WebSocket-powered instant updates

---

## 🏗️ Architecture

```
minehunt-ai/
├── src/
│   ├── core/
│   │   ├── bot.js           # Main bot controller
│   │   ├── config.js        # Configuration manager
│   │   ├── logger.js        # Logging utility
│   │   ├── stateMachine.js  # State definitions
│   │   └── decisionEngine.js # Central decision brain
│   ├── perception/
│   │   └── targetTracker.js # Target tracking system
│   ├── movement/            # (Planned: pathfinding, recovery, bridging)
│   ├── combat/              # (Planned: melee, ranged, defense)
│   ├── progression/         # (Planned: gathering, crafting, nether)
│   ├── inventory/           # (Planned: inventory management)
│   ├── strategy/            # (Planned: player model, telemetry)
│   └── api/
│       └── server.js        # Dashboard & REST API
├── tests/
│   ├── config.test.js
│   └── stateMachine.test.js
├── config/
├── logs/
├── .env.example
├── package.json
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** (tested on v20.20.2)
- **Minecraft Java Edition 1.20.1 server** running locally or remotely
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/minehunt-ai/Minehunt-AI.git
cd Minehunt-AI

# Install dependencies
npm install

# Configure settings
cp .env.example .env
# Edit .env with your server details
```

### Configuration

Edit `.env`:

```env
# Minecraft Server
MC_HOST=localhost
MC_PORT=25565
MC_VERSION=1.20.1

# Bot Settings
BOT_USERNAME=MinehuntAI
TARGET_PLAYER=mr_xyous

# Timing (seconds)
PREPARATION_SECONDS=60
TARGET_RESPAWN_WINDOW_SECONDS=300

# Dashboard
DASHBOARD_HOST=127.0.0.1
DASHBOARD_PORT=50000

# Mode: development, survival, benchmark
MODE=development
```

### Running the Bot

```bash
# Production mode
npm start

# Development mode
npm run dev
```

### Accessing the Dashboard

Open your browser to:

```
http://localhost:50000
```

You'll see real-time updates for:
- Bot connection status
- Health and food levels
- Target distance and dimension
- Current AI state and task
- Telemetry (kills, deaths, decisions)

---

## 🎮 How It Works

### Phase 1: Preparation (First 60 Seconds)

During the first minute, the bot **will NOT attack** the target. Instead, it:

1. Collects wood and stone
2. Crafts a crafting table and basic tools
3. Gathers food
4. Obtains a weapon
5. Organizes inventory
6. Tracks target position and movement

Every second has a purpose. The bot uses this time to become combat-ready while gathering intelligence on the target's location and progression.

### Phase 2: Hunt Mode (After Preparation)

Once the preparation window ends:

**If target is close (< 32 blocks):**
- Transition to CHASE or COMBAT state
- Pursue and engage the target
- Use terrain advantages
- Block escape routes

**If target is far:**
- Continue upgrading equipment
- Calculate interception route
- Gather high-value resources
- Decide whether pursuit is worthwhile

### Phase 3: Target Eliminated

When the target dies, a **5-minute upgrade window** begins:

1. Aggressively gather diamonds, iron, and rare resources
2. Craft better armor and weapons
3. Obtain enchantments if possible
4. Gather Nether progression items
5. Prepare for next encounter

After 5 minutes, the hunt resumes.

---

## 📡 API Endpoints

The dashboard exposes a REST API at `http://localhost:50000/api/`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status` | GET | Full bot status including health, position, target info |
| `/target` | GET | Target player information (distance, dimension, progression) |
| `/inventory` | GET | Bot inventory (requires additional plugins) |
| `/telemetry` | GET | Decision engine telemetry (states, kills, deaths) |
| `/logs` | GET | Recent logs (placeholder) |
| `/control/stop` | POST | Disconnect the bot |
| `/control/start` | POST | Start command (REQUIRES_LIVE_MINECRAFT_TEST) |
| `/control/pause` | POST | Pause command (REQUIRES_LIVE_MINECRAFT_TEST) |
| `/control/resume` | POST | Resume command (REQUIRES_LIVE_MINECRAFT_TEST) |
| `/control/reset` | POST | Reset command (REQUIRES_LIVE_MINECRAFT_TEST) |

### WebSocket

Real-time updates are pushed via WebSocket at `ws://localhost:50000/ws`.

Message format:
```json
{
  "type": "update",
  "data": {
    "health": 20,
    "food": 18,
    "position": { "x": 100, "y": 64, "z": -200 },
    "dimension": "overworld",
    "targetInfo": {
      "distance": 45.3,
      "dimension": "overworld",
      "estimatedProgression": "early"
    },
    "decisionInfo": {
      "currentState": "CHASE",
      "currentTask": "Pursuing target",
      "preparationTime": 62.4
    }
  }
}
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage (planned)
npm run test:coverage
```

Current test coverage:
- ✅ Configuration loading and validation
- ✅ State machine definitions
- ⏳ Decision engine logic (planned)
- ⏳ Target tracking (planned)
- ⏳ Integration tests (REQUIRES_LIVE_MINECRAFT_TEST)

---

## 🔧 Development Modes

### Development Mode
```env
MODE=development
```
- Verbose logging
- Lenient error handling
- Debug endpoints enabled

### Survival Mode
```env
MODE=survival
```
- Optimized for actual gameplay
- Standard logging
- Full AI behavior

### Benchmark Mode
```env
MODE=benchmark
```
- Controlled scenarios for performance measurement
- Metrics collection
- Comparison against baseline

---

## 📈 Performance Goals

Minehunt AI aims to be **20% more effective** than conventional Baritone-based autonomous setups in:

- Navigation time
- Path failure rate
- Target interception time
- Combat success rate
- Resource acquisition efficiency
- Survival rate
- Recovery success rate

*Note: This claim will be validated through internal benchmarks once live Minecraft testing is available.*

---

## 🛠️ Planned Features

### Movement System
- [ ] Sprint jumping optimization
- [ ] Water navigation
- [ ] Lava avoidance
- [ ] Cliff descent (water bucket clutch)
- [ ] Bridge building
- [ ] Pillar climbing

### Combat Enhancements
- [ ] Critical hit timing
- [ ] Strafe patterns
- [ ] Bow aiming with projectile prediction
- [ ] Shield blocking
- [ ] Golden apple usage
- [ ] Ender Pearl escapes

### Progression System
- [ ] Automated wood/stone gathering
- [ ] Crafting tree navigation
- [ ] Tool maintenance
- [ ] Food auto-eating
- [ ] Chest looting intelligence
- [ ] Nether portal construction
- [ ] Nether navigation
- [ ] Blaze rod farming
- [ ] Ender pearl acquisition

### Strategy Improvements
- [ ] Player behavior learning
- [ ] Route prediction
- [ ] Ambush positioning
- [ ] Resource denial
- [ ] Endgame interception

---

## ⚠️ Known Limitations

1. **REQUIRES_LIVE_MINECRAFT_TEST**: Many features cannot be fully tested without a running Minecraft 1.20.1 server.

2. **Inventory Management**: Full inventory tracking requires additional mineflayer plugins.

3. **Pathfinding**: While mineflayer-pathfinder is integrated, complex terrain navigation needs live testing.

4. **Combat**: Melee and ranged combat systems are scaffolded but require tuning in actual gameplay.

---

## 🐛 Troubleshooting

### Connection Timeout
```
Error: Connection timeout - is the Minecraft server running?
```
**Solution:** Ensure your Minecraft 1.20.1 server is running and accessible at the configured host/port.

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::50000
```
**Solution:** Change `DASHBOARD_PORT` in your `.env` file or stop the process using port 50000.

### Invalid Mode
```
Error: Invalid mode: xyz. Must be one of: development, survival, benchmark
```
**Solution:** Set `MODE` to one of the valid options in `.env`.

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

Areas we'd love help with:
- Combat AI tuning
- Pathfinding optimization
- Nether progression logic
- Test coverage
- Dashboard UI improvements

---

## 🙏 Acknowledgments

Built with:
- [Mineflayer](https://github.com/PrismarineJS/mineflayer) - High-level Minecraft bot API
- [mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder) - A* pathfinding
- [mineflayer-pvp](https://github.com/TheDudeFromCI/mineflayer-pvp) - Combat utilities
- [Express](https://expressjs.com/) - Web server
- [WebSocket](https://github.com/websockets/ws) - Real-time communication

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/minehunt-ai/Minehunt-AI/issues)
- **Discussions:** [GitHub Discussions](https://github.com/minehunt-ai/Minehunt-AI/discussions)

---

<div align="center">

**Minehunt AI v1.0.0**

*Preventing Minecraft completion, one hunt at a time.*

</div>
