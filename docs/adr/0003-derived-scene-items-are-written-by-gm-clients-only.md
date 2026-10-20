# Derived scene items are written by GM clients only

Range rings and elevation labels are scene items computed from combatant data. Only GM clients create, update or delete them, always using deterministic item ids so two GMs reconciling at once converge on the same items instead of creating duplicates. Player clients never write them, even though every client sees the change that caused them. One-off migrations of saved data run on GM clients only, for the same reason.

## Considered Options

- **Every client reconciles, then deduplicates** (the previous behaviour): produced duplicate elevation labels and multi-tier discovery and dedupe heuristics to clean them up.
- **The client that made the change writes the derived item**: fails when the change arrives from somewhere else (another GM, a scene copy).

## Consequences

- With no GM connected, derived items do not update. Players cannot change elevation or turns, so nothing needs redrawing.
