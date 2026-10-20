# Saved metadata stays backwards compatible

Users prep scenes ahead of sessions, so token, scene and room metadata already saved by older versions must keep loading with no user action. Metadata keys (`<plugin>/metadata`, `<plugin>/sceneState`, `<plugin>/roomSettings`) and existing field meanings are frozen. Shape changes are absorbed by a read-time normaliser; old fields are rewritten only when that token or setting is next written. No bulk migrations of users' scenes.

## Consequences

- Legacy shapes (e.g. `encounterGroups` on tokens, scene-stored settings and groups, `displayPlayerHealthNumbers`, member initiatives offset by `+0.1·i`) must still be read correctly.
- New fields must be optional with defaults that reproduce old behaviour.
