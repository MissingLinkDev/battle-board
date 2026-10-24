# Players end turns by flagging their own token; a GM client advances

With the turn bar on, a player presses End turn and the turn moves on. The player's client never moves the turn itself. It writes `ended` into its own token's turn resources, and GM clients watching the encounter advance once every counted member of the active turn has ended. A player can always write tokens they own, but under Owlbear's `CHARACTER_OWNER_ONLY` permission they cannot write the next combatant's `active` flag, so a player-side `next()` would fail in some rooms.

GM clients advance with `advanceFrom(turnKey)`, which moves on only if that turn is still active. Two GMs seeing the same ended turn therefore write the same result, and the turn cannot be skipped twice.

## Considered Options

- **The player's client calls `next()`**: breaks under `CHARACTER_OWNER_ONLY`, and makes players a source of turn changes.
- **A broadcast asking the GM to advance**: works, but the request is lost if no GM is listening, and a group turn needs per-member state anyway. Storing the flag on the token keeps that state where all creature data lives (ADR-0001).

## Consequences

- With no GM connected, End turn is still saved, and the turn advances when a GM joins.
- Tokens hold only the current turn resources. The GM's turn write clears them for a combatant whose turn starts (so stepping back with Previous also starts that turn fresh) and clears End turn for one whose turn ends.
