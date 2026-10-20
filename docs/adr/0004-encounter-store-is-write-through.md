---
status: accepted
---

# The Encounter store is write-through, with no optimistic local copy

Combatant commands write straight to token metadata, and the combatant list is rendered only from Owlbear's item change events. There is no local optimistic copy to merge with remote changes. The previous merge (a single "local edit in progress" flag) both dropped other clients' changes and lost local ones, causing the recurring update race bugs. Owlbear applies local item updates immediately and reports them through the same change event, and input fields already hold in-progress text locally, so no lag is visible.

## Evidence

Measured in a real room (Oct 2026, SDK 3.1): over five writes of one token's metadata, the writing client's own `items.onChange` fired every time, 4–5 ms after `updateItems` was called, and always before the `updateItems` promise resolved.
