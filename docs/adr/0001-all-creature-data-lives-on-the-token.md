# All per-creature data lives on the token, including group membership

Everything about a creature in the encounter (stats, turn state, and which group it belongs to, plus that group's name and staged flag) is stored in the token's own metadata, not in scene metadata. A group has no record of its own: it is derived from the tokens that share a `groupId`. We accept the duplication of group name/staged across members so that deleting, copying or moving a token never requires updating scene-level data. Writes that change a group must update every member in one `updateItems` call so members cannot drift apart.

## Considered Options

- **Group records in scene metadata** (the original design, migrated away from by `migrateOldGroupsToTokens`): rejected because a deleted token would leave dangling membership to clean up.
