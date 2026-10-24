# Battle Board

An Owlbear Rodeo extension for running combat encounters: initiative order, turns and rounds, health, range rings, elevation and distances between tokens on the map.

## Language

### Encounter

**Encounter**:
The combat currently being run in a scene: whether it has started, the current round, and which combatants take part.
_Avoid_: Combat, fight, battle

**Round**:
One full pass through the turn order; increments when the order wraps from last to first.

**Combatant**:
A token taking part in the encounter, i.e. listed in initiative.
_Avoid_: Creature, entry, row, initiative item

**Token**:
The map item underneath a combatant. It keeps its data (stats, group membership) whether or not it is currently a combatant.

**Remove**:
Take a combatant out of the initiative list. Its token keeps all its data, so adding it again restores it exactly.

**Clear all**:
Remove every combatant at once.

**Turn**:
One slot in the turn order, taken by either a single combatant or a whole group.

**Active**:
Whose turn it currently is. Exactly one turn is active while the encounter has started.
_Avoid_: Current, selected

**Initiative**:
The number that places a turn in the turn order; higher goes first.

### Groups

**Group**:
Several combatants that share one turn and one initiative. Grouping affects only turn order: each member is still its own token on the map, with its own distances, rings and elevation. A group exists only as a property of its member tokens.
_Avoid_: Encounter group, encounters (legacy names)

**Member order**:
The fixed order of members within a group, shown as the group's initiative followed by the member's position (15, 15.1, … 15.9, 15.10, 15.11). A member added later goes last.

**Staged**:
A group listed separately and excluded from the turn order until released, optionally with its members hidden on the map.

**Ungroup**:
Dissolve a group so each member takes its own turn.

### Combatants

**PC**:
A combatant controlled by a player. Determines turn rings, which health visibility rule applies, and whether players may edit its HP.
_Avoid_: Player character flag, hero

**NPC**:
Any combatant that is not a PC.
_Avoid_: Monster, enemy

**Bloodied**:
Health status of a combatant below half its max HP.

**Dying** / **Dead**:
Health status at 0 HP: Dying for a PC, Dead for an NPC.

**Health mode**:
What players may see of a combatant's health: none, status only, or numbers. Set separately for PCs and NPCs.

**Concentration check**:
A prompt raised when a concentrating combatant takes damage, with DC equal to the greater of 10 and half the damage. Shown to the GM always, and to players only for PCs.

**Owner**:
The player who owns a token: Owlbear's `createdUserId`, which the GM can reassign in Owlbear. A combatant owned by the GM has no owner in this sense.

### Turn bar

**Turn bar**:
A player's floating tracker, shown during an encounter when the room setting is on and they own a visible combatant in the turn order. One slide per owned combatant, never per group.
_Avoid_: Action bar

**Turn resources**:
What a combatant has used of its turn: action, bonus action, reaction and movement (in grid cells, may exceed its speed). They reset when the combatant's turn starts, including as part of a group turn or by stepping back with Previous. Off-turn only the reaction can be marked used. Starting or ending the encounter, or joining initiative, clears them.

**End turn**:
A combatant saying it has finished. The turn advances once every counted member has ended: members that are visible and owned by a connected player. A turn with no counted members is driven by the GM as before; the GM's controls always work.

### Map

**Elevation**:
The height of a token's bottom face above the map, in scene units; may be negative.

**Movement ring**:
A circle around a combatant showing how far it can move this turn.

**Attack-range ring**:
An outline around a combatant showing its attack reach.

**DM preview**:
A ring visible only to the GM, toggled per combatant, independent of whose turn it is.
