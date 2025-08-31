---
title: Battle Board
description: A simple and clean initiative tracker with auto movement and range rings for quick distance references
author: Missing Link Dev
image: <put an image link here>
icon: https://battle-board.onrender.com/icon.svg
tags:
  - tool
  - combat
  - automation
manifest: https://battle-board.onrender.com/manifest.json
learn-more: <link to patreon post with instructions>
---

# Battle Board – How to Use

Battle Board is an initiative tracker and combat manager for [Owlbear Rodeo](https://www.owlbear.rodeo).  
It integrates with your scene tokens to manage **initiative, stats, overlays, distances, and round order**—all from the sidebar.

---

## Quick Start

1. **Right-click any token** → select **Add to Battle Board**.  
2. Open the **Battle Board sidebar**.  
3. Hit **Start** to begin combat and track turns.  

You now have a live initiative list, complete with stats, overlays, and round management.

---

## Adding & Removing Creatures

- **Right-Click Context Menu**  
  - *Add to Battle Board* → adds selected tokens with default stats.
  ![Add to BattleBoard](URL_HERE)  
  - *Remove from Battle Board* → removes selected tokens.
  ![Remove from BattleBoard](URL_HERE)  
  

- **Add All in Scene** → Adds every CHARACTER/MOUNT token.  
- **Add Visible Only** → Adds only tokens currently visible to the GM. 
![Add All Buttons](URL_HERE) 
- **Remove Individually** → Right-click a row → **Remove**.  
![Remove Context Menu](URL_HERE)

---

## Editing Creature Stats

Each row is fully editable:

- **Initiative** – click to edit. Supports decimals (see below).  
- **Armor Class (AC)** – inline editable.  
- **HP** – edit *Current* / *Max* separately, with **math input** (`-3`, `+5`).  
  - Adjusting Max HP auto-adjusts Current HP (clamped if needed).  
- **Temp HP** – tracked separately.  
- **Visibility** – tokens hidden in Owlbear show an eye-slash icon.  
- **Player Character** – mark/unmark in the expanded panel (affects what players see).  

![Standard Row](URL_HERE)

---

## Initiative Order & Decimals

Battle Board sorts initiative using a **bucket + tie-breaker system**:

1. **Whole numbers first** → Higher integers beat lower ones.  
   - Example: `13` goes before any `12.x`.  
2. **Decimals break ties** → Lower decimals act earlier.  
   - Example: `12.1` goes before `12.2`.  
3. **Name fallback** → Exact ties (`12.1` vs `12.1`) sort alphabetically.  

### Example Order
`13` → `12` → `12.1` → `12.2` → `12.3` 

---

### DM Tips: Using Decimals
- Use `.1`, `.2`, `.3` to break ties without re-rolling.  
- Need to insert mid-round? Give a creature `12.4` to slot it at the end of the `12s`.  
- Boss + minions? Boss = `14`, Minions = `14.1`, `14.2`.  
- Decimals round to **one place**. Typing `12.15` becomes `12.2`.

---

## Movement & Attack Range Rings

Battle Board can draw rings around tokens for tactical play.

- **Movement Rings** – unattached (doesn’t move with the token).  
- **Attack Range Rings** – attached (moves with the token).  
- **DM Preview Rings** – toggle per row, visible to DM only.  

### Styling Controls
- Color (16 palette)  
- Line weight (2–28px)  
- Pattern (solid/dash)  
- Opacity (0–100%)  

### Distance Controls
- Enter values in **units** not **cells** for both **Movement** and **Attack Range** (i.e. 50 ft no 10 cells).  
- Rings resize automatically when stats are updated.  

![Ring Controls](URL_HERE)

---

## Expanded Info Panels

Click the chevron or name to expand a row.

- **Player Character Toggle** – mark/unmark as PC.  
- **Overlays** – full controls for rings (color, weight, dash, opacity).  
- **Distances** – auto-calculated from **edge to edge**:
  - `< 5 ft` displays as **Touch**.  
  - Sorted shortest → longest.  
- **Tooltip** explains: *“Measured edge-to-edge; attack range must be greater than distance. So if distance is 5ft, a 5ft attack range is not enough”*  

![Info Panel](URL_HERE)

---

## Running Combat

At the bottom of the sidebar:

- **Start Combat** → activates the first creature.  
- **End Combat** → clears active state and rings.  
- **Next / Previous Turn** → cycles active creature.  
- **Round Counter** → increments automatically at the end of initiative order.  
- **Settings** ⚙️ → open extension options.  
- **Patreon** ❤️ → support development.  

![Round Controls](URL_HERE)

---

## Settings

Accessible to the GM only.

### DM Display Settings
- **Armor** – show/hide AC column  
![Armor Column](URL_HERE)
- **HP** – show/hide Current/Max/Temp HP columns 
![HP Columns](URL_HERE) 
- **DM Ring Toggle** – show/hide DM-only button 
![DM Rings Toggle Column](URL_HERE) 

### Player Display Settings
- **Display Health Status** – toggle health visibility column for all 
- **Player Characters** – Choose health display for PC (none, status, numbers) 
- **NPCs** – Choose health display for NPCs (none, status, numbers)
- **Show Range Rings for PCs** – allow rings for active PCs only 

### Info Panel Settings
- **Distances** – show/hide distance panel  
![Distances](URL_HERE)

### Gameplay
- **Disable Player Initiative List** – hide list entirely from players  



### Health Visibility
- **Player Characters**  
  - *None* → hide  
  - *Status* → Healthy/Bloodied (>50% / <50%)  
  - *Number* → Current/Max HP  

- **NPCs**  
  - *None*, *Status*, *Number* (same as PCs)  

### Utility
- **Clear All from Initiative** → removes all creatures and ends combat 
![Clear all button](URL_HERE) 



---

## Player View

Players see a simplified tracker:
![screenshot](URL_HERE)

- INIT + NAME  
- Health info (if allowed by GM)  
- Range rings (only for **active PCs** if enabled)  
![screenshot](URL_HERE)
- If disabled, players see:  
  *“The DM has disabled the player initiative list.”*  

![screenshot](URL_HERE)

---

## Extra Tips

- **Math Input**: In HP fields, type `15-3+2` and it auto-calculates.  
- **Rings Auto-Update**: Adjusting movement/range instantly resizes overlays.  
- **Metadata Sync**: All stats save into token metadata → initiative persists across reloads.  
- **Patreon Button**: Quick link to support the project.  
