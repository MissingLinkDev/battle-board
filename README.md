# Battle Board - Initiative Tracker & Combat Manager

Battle Board is a powerful initiative tracker and combat management system for [Owlbear Rodeo](https://www.owlbear.rodeo). It transforms your tokens into a comprehensive combat interface with automatic range overlays, real-time distance calculations, health tracking, and advanced group management—all seamlessly integrated with your scene.

## Key Features
- **Smart Initiative System** with decimal tie-breaking
- **Automatic Range Overlays** for movement and attack ranges
- **Real-time Distance Calculations** between all tokens
- **Advanced Group Management** with staging capabilities
- **Comprehensive Health Tracking** with customizable player visibility
- **Role-based Interface** (separate GM and Player views)
- **Math Input Support** for quick HP adjustments

---

## Quick Start Guide

### Getting Started
1. **Add tokens to your scene** on the CHARACTER or MOUNT layer
2. **Right-click any token** → select **"Add to Battle Board"**
3. **Open the Battle Board sidebar** from your extensions
4. **Click "Start"** to begin initiative and start tracking turns

That's it! You now have a fully functional initiative tracker with automatic range overlays and distance calculations.

### First Combat Setup
- Use **"Add All in Scene"** to quickly add multiple tokens
- Players and GM roll initiative normally - edit values by clicking on them
- Expand any row (click the chevron or name) to access advanced controls
- Hit **"Start"** when ready to begin combat

---

## Core Features

### Initiative Management

#### Adding Tokens
**Context Menu Method:**
- Right-click any CHARACTER or MOUNT token
- Select **"Add to Battle Board"** (for tokens not yet added)
- Select **"Remove from Battle Board"** (for tokens already added)

<img src="https://battle-board.onrender.com/screenshots/context-menu-add.png" alt="Context Menu" style="max-width: 100%; height: auto;">

**Bulk Add Methods:**
- **"Add All in Scene"** - Adds every CHARACTER/MOUNT token
- **"Add Visible Only"** - Adds only tokens currently visible to players

<img src="https://battle-board.onrender.com/screenshots/bulk-add-buttons.png" alt="Bulk Add Buttons" style="max-width: 100%; height: auto;">

#### Smart Initiative System
After players and GMs roll initiative, Battle Board uses a sophisticated ordering system:

1. **Whole numbers first** - Higher integers go before lower ones
2. **Decimals break ties** - Lower decimals act first within the same integer
3. **Alphabetical fallback** - Name-based sorting for exact ties

**Example order:** `15` → `14` → `13.1` → `13.5` → `13.9` → `12`

<img src="https://battle-board.onrender.com/screenshots/initiative-order.png" alt="Initiative Order" style="max-width: 100%; height: auto;">

**Using Decimals to Break Ties:**
When multiple creatures roll the same initiative, use decimals to establish order:
- Multiple creatures rolled `13`: Assign `13.1`, `13.2`, `13.3` based on tie-breaker rules
- Need to insert someone mid-combat? Use `13.5` to place between existing `13.2` and `14`
- Boss with minions all on `15`: Boss = `15`, Minions = `15.1`, `15.2`, `15.3`

#### Turn Management
- **Start/End Combat** - Activates the initiative system and begins tracking
- **Next/Previous Turn** - Cycles through initiative order
- **Round Counter** - Automatically increments when reaching the end of initiative
- **Active Highlighting** - Current turn is clearly marked with visual indicators

<img src="https://battle-board.onrender.com/screenshots/turn-controls.png" alt="Turn Controls" style="max-width: 100%; height: auto;">

### Token Stats & Health Management

#### Editable Stats
Every token row provides quick access to combat-relevant statistics:

- **Initiative** - Click to edit, supports decimals for tie-breaking
- **Armor Class (AC)** - Inline editing
- **Hit Points** - Separate Current/Max HP with temp HP tracking
- **Name** - Automatically syncs with token labels

<img src="https://battle-board.onrender.com/screenshots/stat-editing.png" alt="Stat Editing" style="max-width: 100%; height: auto;">

#### Math Input System
HP fields support mathematical expressions for quick combat adjustments:

- **Damage:** Type `-8` to subtract 8 HP
- **Healing:** Type `+5` to add 5 HP  
- **Complex:** Type `25-3+2-1` for multi-step calculations
- **Absolute:** Type `15` to set HP to exactly 15

#### Health Status Display
Battle Board automatically calculates and displays health status:

- **Healthy** - Above 50% HP (green)
- **Bloodied** - Below 50% HP (yellow)  
- **Dying** - 0 HP Player Characters (red)
- **Dead** - 0 HP NPCs (red)

Health visibility to players is fully configurable in settings.

### Range Overlay System

#### Automatic Range Rings
Battle Board can automatically draw range indicators around tokens:

**Movement Rings (Green, Dashed):**
- Unattached circles showing movement range
- Stay in place when tokens move (tactical positioning)

**Attack Range Rings (Red, Dashed):**
- Attached rounded rectangles following token shape
- Move with the token for dynamic range visualization

<img src="https://battle-board.onrender.com/screenshots/range-overlays.png" alt="Range Overlays" style="max-width: 100%; height: auto;">

#### DM Preview Mode
Each token has a radar icon for DM-only ring previews:
- Toggle individual token rings on/off
- Visible only to the GM
- Perfect for planning encounters

<img src="https://battle-board.onrender.com/screenshots/dm-preview.png" alt="DM Preview" style="max-width: 100%; height: auto;">

#### Complete Customization
Expand any token row to access full styling controls:

**Colors:** 16-color palette picker
**Line Weight:** 8 thickness options (2-28px)  
**Patterns:** Solid or dashed lines
**Opacity:** 0-100% transparency control

<img src="https://battle-board.onrender.com/screenshots/ring-customization.png" alt="Ring Customization" style="max-width: 100%; height: auto;">

### Distance Calculations

#### Automatic Distance Panel
When you expand a token row, Battle Board calculates distances to all other tokens:

- **Edge-to-edge measurement** (not center-to-center)
- **Sorted by proximity** (closest first)
- **"Touch" indicator** for adjacent tokens (< 5ft)
- **Real-time updates** as tokens move

<img src="https://battle-board.onrender.com/screenshots/distance-panel.png" alt="Distance Panel" style="max-width: 100%; height: auto;">

#### Smart Measurements
- Distances account for token size (not just position)
- Uses Owlbear Rodeo's grid measurement system
- Supports all measurement modes (Chebyshev, Euclidean, etc.)
- Helpful tooltip: *"Measured edge-to-edge; attack range must be greater than distance"*

### Group Management

Groups serve two primary functions in Battle Board:

#### 1. Minion Management
Group monsters that act on the same initiative to streamline combat:
- **All group members activate together** - One "Next Turn" click activates the entire group
- **Shared initiative** - Edit once, applies to all members
- **Reduced clicking** - Manage 8 goblins as one group instead of 8 individual turns

#### 2. Multi-Encounter Planning
Use groups with staging to pre-plan multiple encounters on a single map:
- **Stage encounters in advance** - Place tokens for later encounters and mark groups as "Staged"
- **Quick encounter transitions** - Activate staged groups when players move to new areas
- **Reinforcement management** - Stage reinforcement groups to activate mid-combat

<img src="https://battle-board.onrender.com/screenshots/group-overview.png" alt="Group Management Overview" style="max-width: 100%; height: auto;">

#### Creating and Managing Groups

**Creating Groups:**
1. **Right-click any token row** → **"Add to Group"**
2. **Select existing group** or **"Create New Group"**
3. **All group members share initiative** and act together

<img src="https://battle-board.onrender.com/screenshots/group-creation.png" alt="Group Creation" style="max-width: 100%; height: auto;">

**Group Controls:**
Groups appear as expandable sections in the initiative list:

- **Group Initiative** - Edit once, applies to all members
- **Member Management** - Add/remove tokens from groups
- **Collective Actions** - All members activate together on their turn

#### Group Staging System

**Active Groups:** Participate normally in initiative order
**Staged Groups:** Visible in the list but not participating in initiative

**Staging Controls:**
- **Activate Group** - Bring staged group into active initiative
- **Stage Group** - Remove group from active initiative (but keep visible in list)
- **Visibility option** - Optionally hide staged group tokens from players
- **Ungroup** - Moves all grouped participants from group to main initiative as individual items

<img src="https://battle-board.onrender.com/screenshots/group-staging.png" alt="Group Staging" style="max-width: 100%; height: auto;">

**Common Use Cases:**
- **Room-by-room dungeons** - Stage groups for each room on a large map
- **Reinforcements** - Stage backup monsters to arrive mid-combat
- **Encounter phases** - Stage different monster sets for multi-phase boss fights
- **Environmental hazards** - Stage trap or hazard groups with delayed activation

---

## Player vs GM Experience

### GM Interface
The GM sees the complete Battle Board interface with full control:

- **Complete Initiative List** with all tokens and stats
- **Full Stat Editing** capabilities
- **Range Ring Controls** and DM preview toggles
- **Group Management** tools
- **Settings Access** and customization options
- **Combat Controls** (Start/End, Next/Prev turn)

### Player Interface
Players see a streamlined view focused on essential information:

**When Combat Started:**
- **Initiative Order** with creature names
- **Health Information** (if enabled by GM)
- **Active Turn Indicator** with visual highlighting
- **Range Rings** for active Player Characters (if enabled)

<img src="https://battle-board.onrender.com/screenshots/player-interface-active.png" alt="Player Interface - Active" style="max-width: 100%; height: auto;">

**Before Combat Starts:**
- Simple message: *"Initiative has not started yet."*

<img src="https://battle-board.onrender.com/screenshots/player-interface-waiting.png" alt="Player Interface - Waiting" style="max-width: 100%; height: auto;">

**When Disabled:**
- Clear message: *"The DM has disabled the player initiative list."*

<img src="https://battle-board.onrender.com/screenshots/player-interface-disabled.png" alt="Player Interface - Disabled" style="max-width: 100%; height: auto;">

### Permission System
The GM has granular control over what players can see:

- **Initiative List Visibility** - Show/hide entire list
- **Health Information** - None/Status/Numbers per creature type
- **Range Rings** - Enable for Player Characters during their turn
- **Distance Information** - Available in player expanded views

---

## Advanced Features

### Comprehensive Settings

#### Display Settings - GM Columns
Control what information appears in your GM interface:

- **Armor Class Column** - Show/hide AC values
- **Hit Points Columns** - Toggle Current/Max/Temp HP display  
- **DM Ring Toggle** - Show/hide the radar icon for ring previews

<img src="https://battle-board.onrender.com/screenshots/settings-gm-columns.png" alt="Settings - GM Columns" style="max-width: 100%; height: auto;">

#### Display Settings - Player Columns  
Configure what players can see:

**Health Status Master Toggle:**
- Enable/disable all health information for players

**Per-Faction Health Display:**
- **Player Characters:** None / Status / Numbers
- **NPCs:** None / Status / Numbers

**Range Ring Display:**
- Show movement/attack rings for active Player Characters

<img src="https://battle-board.onrender.com/screenshots/settings-player-columns.png" alt="Settings - Player Columns" style="max-width: 100%; height: auto;">

#### Info Panel Settings
- **Distance Calculations** - Enable/disable the distance panel in expanded rows

#### Gameplay Settings
- **Player Initiative List** - Show/hide the entire initiative interface from players
- **Group Staging Controls Visibility** - Whether staging/unstaging groups affects token visibility

<img src="https://battle-board.onrender.com/screenshots/settings-gameplay.png" alt="Settings - Gameplay" style="max-width: 100%; height: auto;">

### Data Storage
Battle Board saves all information directly to your scene and token metadata:
- **Stats and Health** persist across sessions
- **Initiative Order** maintained between browser reloads
- **Group Memberships** stored permanently with your tokens
- **Ring Preferences** remembered per token

---

## Tips & Best Practices

### Initiative Management
- **Roll initiative normally** - Battle Board tracks the results, doesn't replace rolling
- **Use decimals for tie-breaking** - `.1`, `.2`, `.3` are easier to manage than complex decimals
- **Plan for insertions** - Leave gaps like `15` → `13` → `11` for mid-combat additions
- **Group similar creatures** - All goblins can share initiative and act together

### Health Tracking  
- **Set Max HP first** - Current HP auto-adjusts proportionally
- **Use math input** - `-8` is faster than calculating `23-8=15`
- **Track temp HP separately** - It automatically layers on top of current HP
- **Monitor status colors** - Green/Yellow/Red provide quick visual health assessment

### Range Management
- **Start with defaults** - Green movement, red attack ranges work well
- **Use DM previews for planning** - Toggle rings to visualize encounter positioning
- **Customize per creature type** - Different colors for different monster abilities
- **Test range interactions** - Use distance calculations to verify attack possibilities

### Group Strategies

**For Minion Management:**
- **Group identical creatures** - All goblins, all zombies, etc.
- **Keep bosses separate** - Major creatures deserve individual initiatives
- **Use shared initiative** - Let groups of minions act on the same rolled initiative
- **Reduce turn complexity** - One "Next" click for an entire goblin warband

**For Multi-Encounter Planning:**
- **Pre-place all encounters** on large dungeon maps
- **Stage groups by area** - "Goblin Barracks", "Throne Room Guards", etc.
- **Plan reinforcement timing** - Stage backup waves for dramatic encounters
- **Use visibility controls** - Hide staged tokens until they're needed

### Large Combat Management
- **Bulk add tokens** first, then organize into logical groups
- **Use player visibility settings** to reduce information overload
- **Leverage distance calculations** for quick tactical decisions  
- **Stage complex encounters** in phases rather than overwhelming players

### Player Experience
- **Configure health visibility** thoughtfully - Status often works better than raw numbers
- **Enable PC rings** for enhanced tactical play
- **Keep initiative list enabled** unless you need complete secrecy
- **Communicate group actions** - Let players know when minion groups are acting together

---

## Support & Development

Battle Board is actively developed and supported. For feature requests, bug reports, or to support development:

- **GitHub Repository:** [Battle Board on GitHub](https://github.com/MissingLinkDev/battle-board)
- **Support Development:** [Patreon - Missing Link Dev](https://www.patreon.com/MissingLinkDev)
- **Community Support:** Join discussions in the Owlbear Rodeo Discord

---

*Battle Board transforms your Owlbear Rodeo sessions with initiative tracking and combat management. From quick skirmishes to complex multi-group encounters, Battle Board scales to meet your needs while maintaining the simplicity that makes Owlbear Rodeo great.*