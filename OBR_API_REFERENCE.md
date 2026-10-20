# OBR (Owlbear Rodeo) Extension API Reference

**SDK Version:** 3.1.0
**Package:** `@owlbear-rodeo/sdk`
**Source:** https://github.com/owlbear-rodeo/sdk

---

## Table of Contents

1. [Overview & Setup](#overview--setup)
2. [OBR.viewport](#obr-viewport)
3. [OBR.player](#obr-player)
4. [OBR.party](#obr-party)
5. [OBR.notifications](#obr-notifications)
6. [OBR.scene](#obr-scene)
   - [scene.items / scene.local](#sceneitems--scenelocal)
   - [scene.grid](#scenegrid)
   - [scene.fog](#scenefog)
   - [scene.history](#scenehistory)
7. [OBR.contextMenu](#obr-contextmenu)
8. [OBR.tools](#obr-tools)
9. [OBR.popovers](#obr-popovers)
10. [OBR.modals](#obr-modals)
11. [OBR.actions](#obr-actions)
12. [OBR.interactions](#obr-interactions)
13. [OBR.rooms](#obr-rooms)
14. [OBR.theme](#obr-theme)
15. [OBR.assets](#obr-assets)
16. [OBR.broadcast](#obr-broadcast)
17. [Item Types & Builders](#item-types--builders)
18. [Common Types](#common-types)
19. [Patterns & Examples](#patterns--examples)

---

## Overview & Setup

### Installation

```bash
npm install @owlbear-rodeo/sdk
```

### manifest.json

Every extension requires a `manifest.json` at its root:

```json
{
  "name": "My Extension",
  "version": "1.0.0",
  "manifest": "2.0",
  "thumbnail": "thumbnail.png",
  "permissions": ["ALLOW_ALL"],
  "action": {
    "title": "My Extension",
    "icon": "icon.svg",
    "popover": {
      "url": "/",
      "height": 400,
      "width": 300
    }
  }
}
```

Key manifest fields:
- `manifest`: Must be `"2.0"`
- `permissions`: Array of `Permission` strings or `"ALLOW_ALL"`
- `action`: Configures the action bar button and its popover
- `contextMenu`: Optional context menu items
- `tools`: Optional custom tools

### Initialization

All API calls must happen after OBR is ready:

```ts
import OBR from "@owlbear-rodeo/sdk";

OBR.onReady(async () => {
  // Safe to use any OBR API here
  const playerId = await OBR.player.getId();
  const role = await OBR.player.getRole();
  console.log(`Player ${playerId} is a ${role}`);
});
```

> **Important:** `OBR.onReady` fires once when the extension iframe is loaded. Use `OBR.scene.onReadyChange` to react to scene load/unload.

---

## OBR.viewport

Control the map viewport (pan, zoom, coordinate transforms).

| Method | Signature | Description |
|--------|-----------|-------------|
| `reset` | `() => Promise<void>` | Restore default viewport |
| `animateTo` | `(transform: ViewportTransform) => Promise<void>` | Smooth transition to transform |
| `animateToBounds` | `(bounds: BoundingBox) => Promise<void>` | Animate to fit bounding box |
| `getPosition` | `() => Promise<Vector2>` | Get viewport center in world coords |
| `setPosition` | `(position: Vector2) => Promise<void>` | Set viewport center |
| `getScale` | `() => Promise<number>` | Get zoom level (1.0 = 100%) |
| `setScale` | `(scale: number) => Promise<void>` | Set zoom level |
| `getWidth` | `() => Promise<number>` | Get viewport width in pixels |
| `getHeight` | `() => Promise<number>` | Get viewport height in pixels |
| `transformPoint` | `(point: Vector2) => Promise<Vector2>` | World coords → screen coords |
| `inverseTransformPoint` | `(point: Vector2) => Promise<Vector2>` | Screen coords → world coords |

```ts
// Pan to item and zoom in
await OBR.viewport.animateTo({
  position: { x: 100, y: 200 },
  scale: 1.5,
});

// Fit all selected items in view
const bounds = await OBR.scene.items.getItemBounds(selectedIds);
await OBR.viewport.animateToBounds(bounds);
```

---

## OBR.player

Access and modify the current player's data.

| Method | Signature | Description |
|--------|-----------|-------------|
| `id` | `string` (getter) | Player ID (sync) |
| `getId` | `() => Promise<string>` | Player ID |
| `getName` | `() => Promise<string>` | Display name |
| `setName` | `(name: string) => Promise<void>` | Set display name |
| `getColor` | `() => Promise<string>` | Player color (hex string) |
| `setColor` | `(color: string) => Promise<void>` | Set player color |
| `getRole` | `() => Promise<"GM" \| "PLAYER">` | Player role |
| `getConnectionId` | `() => Promise<string>` | Unique connection ID |
| `getSelection` | `() => Promise<string[] \| undefined>` | Selected item IDs |
| `select` | `(items: string[], replace?: boolean) => Promise<void>` | Select items |
| `deselect` | `(items?: string[]) => Promise<void>` | Deselect items (all if no arg) |
| `getSyncView` | `() => Promise<boolean>` | Is view sync enabled |
| `setSyncView` | `(syncView: boolean) => Promise<void>` | Enable/disable view sync |
| `getMetadata` | `() => Promise<Metadata>` | Get player metadata |
| `setMetadata` | `(update: Partial<Metadata>) => Promise<void>` | Merge update into metadata |
| `hasPermission` | `(permission: Permission) => Promise<boolean>` | Check a permission |
| `onChange` | `(callback: (player: Player) => void) => () => void` | Subscribe to changes |

```ts
// Check if player is GM
const role = await OBR.player.getRole();
const isGM = role === "GM";

// Subscribe to selection changes
const unsubscribe = OBR.player.onChange((player) => {
  console.log("Selection:", player.selection);
});
// Later: unsubscribe();
```

---

## OBR.party

List all players in the room.

| Method | Signature | Description |
|--------|-----------|-------------|
| `getPlayers` | `() => Promise<Player[]>` | All players (including self) |
| `onChange` | `(callback: (players: Player[]) => void) => () => void` | Subscribe to party changes |

```ts
const players = await OBR.party.getPlayers();
const gmPlayers = players.filter(p => p.role === "GM");
```

**Player type:**
```ts
type Player = {
  id: string;
  name: string;
  color: string;
  role: "GM" | "PLAYER";
  connectionId: string;
  selection?: string[];
  metadata: Metadata;
};
```

---

## OBR.notifications

Display toast notifications to the current user.

| Method | Signature | Description |
|--------|-----------|-------------|
| `show` | `(message: string, variant?: NotificationVariant) => Promise<string>` | Show notification, returns ID |
| `close` | `(id: string) => Promise<void>` | Dismiss notification |

**NotificationVariant:** `"DEFAULT" | "ERROR" | "INFO" | "SUCCESS" | "WARNING"`

```ts
const id = await OBR.notification.show("Item saved!", "SUCCESS");
// Dismiss after 2s
setTimeout(() => OBR.notification.close(id), 2000);
```

---

## OBR.scene

Manage scene state. Check scene readiness before accessing scene data.

| Method | Signature | Description |
|--------|-----------|-------------|
| `isReady` | `() => Promise<boolean>` | Is a scene currently loaded |
| `onReadyChange` | `(callback: (ready: boolean) => void) => () => void` | Subscribe to ready state |
| `getMetadata` | `() => Promise<Metadata>` | Get scene-level metadata |
| `setMetadata` | `(update: Partial<Metadata>) => Promise<void>` | Update scene metadata |
| `onMetadataChange` | `(callback: (metadata: Metadata) => void) => () => void` | Subscribe to metadata changes |

**Sub-APIs:** `OBR.scene.items`, `OBR.scene.local`, `OBR.scene.grid`, `OBR.scene.fog`, `OBR.scene.history`

```ts
OBR.onReady(() => {
  // React to scene load/unload
  OBR.scene.onReadyChange(async (ready) => {
    if (ready) {
      const items = await OBR.scene.items.getItems();
      console.log(`Scene has ${items.length} items`);
    }
  });
});
```

---

### scene.items / scene.local

`OBR.scene.items` — shared items visible to all players.
`OBR.scene.local` — local-only items visible only to the current player (not persisted).

Both APIs share the same interface:

| Method | Signature | Description |
|--------|-----------|-------------|
| `getItems` | `<T>(filter?: ItemFilter<T>) => Promise<T[]>` | Get items by IDs, predicate, or all |
| `addItems` | `(items: Item[]) => Promise<void>` | Add new items |
| `updateItems` | `<T>(filter: ItemFilter<T>, update: (draft: Draft<T>) => void, fastUpdate?: boolean) => Promise<void>` | Update items via Immer draft |
| `deleteItems` | `(ids: string[]) => Promise<void>` | Delete items by ID |
| `getItemAttachments` | `(ids: string[]) => Promise<Item[]>` | Get child attachments |
| `getItemBounds` | `(ids: string[]) => Promise<BoundingBox>` | Get bounding box |
| `onChange` | `(callback: (items: Item[]) => void) => () => void` | Subscribe to all item changes |

**ItemFilter types:**
```ts
type ItemFilter<T> =
  | string[]                          // Array of item IDs
  | ((item: Item) => item is T)       // Type guard predicate
  | undefined;                        // All items
```

```ts
import { buildShape, isImage } from "@owlbear-rodeo/sdk";

// Get all items
const allItems = await OBR.scene.items.getItems();

// Get by IDs
const specific = await OBR.scene.items.getItems(["id1", "id2"]);

// Get by type predicate
const images = await OBR.scene.items.getItems(isImage);

// Add a shape
const shape = buildShape()
  .width(100).height(100)
  .shapeType("CIRCLE")
  .fillColor("#ff0000")
  .position({ x: 0, y: 0 })
  .layer("PROP")
  .build();
await OBR.scene.items.addItems([shape]);

// Update items with Immer
await OBR.scene.items.updateItems(["id1"], (items) => {
  for (const item of items) {
    item.position = { x: 50, y: 50 };
    item.visible = false;
  }
});

// Subscribe to changes
const unsubscribe = OBR.scene.items.onChange((items) => {
  console.log("Items changed:", items.length);
});
```

> **fastUpdate:** When `true`, skips undo history — use for frequent updates like dragging.

---

### scene.grid

Read and configure the scene grid.

| Method | Signature | Description |
|--------|-----------|-------------|
| `getDpi` | `() => Promise<number>` | Dots per inch (pixels per grid cell) |
| `getScale` | `() => Promise<GridScale>` | Grid scale (e.g., "5 ft") |
| `getType` | `() => Promise<GridType>` | Grid type |
| `getColor` | `() => Promise<GridColor>` | Grid color |
| `getOpacity` | `() => Promise<number>` | Grid opacity (0–1) |
| `getLineType` | `() => Promise<GridLineType>` | Line style |
| `getMeasurement` | `() => Promise<GridMeasurement>` | Measurement system |
| `getLineWidth` | `() => Promise<number>` | Line thickness |
| `setScale` | `(scale: string) => Promise<void>` | Set scale string (e.g., `"5 ft"`) |
| `setColor` | `(color: GridColor) => Promise<void>` | Set color |
| `setOpacity` | `(opacity: number) => Promise<void>` | Set opacity |
| `setType` | `(type: GridType) => Promise<void>` | Set grid type |
| `setLineType` | `(lineType: GridLineType) => Promise<void>` | Set line style |
| `setMeasurement` | `(measurement: GridMeasurement) => Promise<void>` | Set measurement system |
| `setLineWidth` | `(lineWidth: number) => Promise<void>` | Set line width |
| `snapPosition` | `(position: Vector2, sensitivity?: number, corners?: boolean, center?: boolean) => Promise<Vector2>` | Snap position to grid |
| `getDistance` | `(from: Vector2, to: Vector2) => Promise<number>` | Distance in grid units |
| `onChange` | `(callback: (grid: Grid) => void) => () => void` | Subscribe to grid changes |

**Enums:**
```ts
type GridType = "SQUARE" | "HEX_VERTICAL" | "HEX_HORIZONTAL" | "DIMETRIC" | "ISOMETRIC";
type GridColor = "DARK" | "LIGHT" | "HIGHLIGHT" | string;
type GridLineType = "SOLID" | "DASHED" | "DOTTED";
type GridMeasurement = "CHEBYSHEV" | "ALTERNATING" | "EUCLIDEAN" | "MANHATTAN";
```

```ts
const dpi = await OBR.scene.grid.getDpi();
// Convert world pixels to grid cells: pixels / dpi
const gridCells = pixelDistance / dpi;

// Snap a position to the nearest grid corner
const snapped = await OBR.scene.grid.snapPosition(
  { x: 123, y: 456 },
  0.25,  // sensitivity (0–1)
  true,  // snap to corners
  true   // snap to center
);
```

---

### scene.fog

Read and configure fog of war settings.

| Method | Signature | Description |
|--------|-----------|-------------|
| `getColor` | `() => Promise<string>` | Fog color (hex) |
| `getStrokeWidth` | `() => Promise<number>` | Stroke width |
| `getFilled` | `() => Promise<boolean>` | Is fog filled (covering non-revealed areas) |
| `setColor` | `(color: string) => Promise<void>` | Set fog color |
| `setStrokeWidth` | `(width: number) => Promise<void>` | Set stroke width |
| `setFilled` | `(filled: boolean) => Promise<void>` | Set fill state |
| `onChange` | `(callback: (fog: Fog) => void) => () => void` | Subscribe to changes |

---

### scene.history

Undo/redo support for scene changes.

| Method | Signature | Description |
|--------|-----------|-------------|
| `undo` | `() => Promise<void>` | Undo last action |
| `redo` | `() => Promise<void>` | Redo last undone action |
| `canUndo` | `() => Promise<boolean>` | Is undo available |
| `canRedo` | `() => Promise<boolean>` | Is redo available |

---

## OBR.contextMenu

Register right-click context menu items that appear when players right-click on items.

| Method | Signature | Description |
|--------|-----------|-------------|
| `create` | `(contextMenu: ContextMenuItem) => Promise<void>` | Register menu item |
| `remove` | `(id: string) => Promise<void>` | Unregister menu item |

**ContextMenuItem:**
```ts
type ContextMenuItem = {
  id: string;
  icons: ContextMenuIcon[];
  onClick: (context: ContextMenuContext) => void;
  shortcut?: string;
  embed?: {
    url: string;
    height: number;
  };
};

type ContextMenuIcon = {
  icon: string;        // URL to icon image
  label: string;
  filter?: ToolFilter;
};

type ContextMenuContext = {
  items: Item[];              // Right-clicked items
  selectionBounds: BoundingBox;
};
```

```ts
await OBR.contextMenu.create({
  id: "my-extension/context-menu",
  icons: [
    {
      icon: "/icon.svg",
      label: "Add HP",
      filter: {
        roles: ["GM"],
        every: [{ key: "layer", value: "CHARACTER" }],
      },
    },
  ],
  onClick(context) {
    const itemIds = context.items.map(i => i.id);
    console.log("Right-clicked:", itemIds);
  },
});
```

---

## OBR.tools

Register custom tools that appear in the toolbar.

| Method | Signature | Description |
|--------|-----------|-------------|
| `create` | `(tool: Tool) => Promise<void>` | Register tool |
| `remove` | `(id: string) => Promise<void>` | Unregister tool |
| `activateTool` | `(id: string) => Promise<void>` | Switch to tool |
| `getActiveTool` | `() => Promise<string>` | Get active tool ID |
| `onToolChange` | `(callback: (id: string) => void) => () => void` | Subscribe to active tool changes |
| `getMetadata` | `(id: string) => Promise<Metadata \| undefined>` | Get tool metadata |
| `setMetadata` | `(toolId: string, update: Partial<Metadata>) => Promise<void>` | Update tool metadata |
| `createAction` | `(action: ToolAction) => Promise<void>` | Register toolbar action button |
| `removeAction` | `(id: string) => Promise<void>` | Unregister action |
| `createMode` | `(mode: ToolMode) => Promise<void>` | Register tool mode |
| `removeMode` | `(id: string) => Promise<void>` | Unregister mode |
| `activateMode` | `(toolId: string, modeId: string) => Promise<void>` | Switch mode |
| `getActiveToolMode` | `() => Promise<string \| undefined>` | Get active mode ID |
| `onToolModeChange` | `(callback: (id: string) => void) => () => void` | Subscribe to mode changes |

**Key interfaces:**
```ts
type Tool = {
  id: string;
  icons: ToolIcon[];
  onClick?: (context: ToolContext, elementId: string) => void;
  shortcut?: string;
  defaultMode?: string;
  defaultMetadata?: Metadata;
  disabledFilter?: ToolFilter;
};

type ToolMode = {
  id: string;
  icons: ToolIcon[];
  cursors?: ToolCursor[];
  onToolClick?: (context: ToolContext, elementId: string) => void;
  onToolDoubleClick?: (context: ToolContext, elementId: string) => void;
  onToolDown?: (context: ToolContext) => void;
  onToolMove?: (context: ToolContext) => void;
  onToolUp?: (context: ToolContext) => void;
  onToolDragStart?: (context: ToolContext) => void;
  onToolDragMove?: (context: ToolContext) => void;
  onToolDragEnd?: (context: ToolContext) => void;
  onToolDragCancel?: (context: ToolContext) => void;
  onKeyDown?: (context: ToolContext) => void;
  onKeyUp?: (context: ToolContext) => void;
  onActivate?: () => void;
  onDeactivate?: () => void;
};

type ToolAction = {
  id: string;
  icons: ToolIcon[];
  onClick?: (context: ToolContext, elementId: string) => void;
  shortcut?: string;
  disabledFilter?: ToolFilter;
};

type ToolContext = {
  position: Vector2;
  target?: Item;
  pointerType: "mouse" | "touch" | "pen";
  modifierKeys: ModifierKey[];
};

type ToolFilter = {
  roles?: ("GM" | "PLAYER")[];
  permissions?: Permission[];
  activeTool?: string[];
  activeMode?: string[];
  every?: { key: string; value: unknown; operator?: "==" | "!=" }[];
  some?: { key: string; value: unknown; operator?: "==" | "!=" }[];
};
```

---

## OBR.popovers

Open floating popover panels anchored to elements or positions.

| Method | Signature | Description |
|--------|-----------|-------------|
| `open` | `(popover: Popover) => Promise<void>` | Open popover |
| `close` | `(id: string) => Promise<void>` | Close popover |
| `getWidth` | `(id: string) => Promise<number \| undefined>` | Get width |
| `setWidth` | `(id: string, width: number) => Promise<void>` | Set width |
| `getHeight` | `(id: string) => Promise<number \| undefined>` | Get height |
| `setHeight` | `(id: string, height: number) => Promise<void>` | Set height |

**Popover type:**
```ts
type Popover = {
  id: string;
  url: string;
  width: number;
  height: number;
  anchorElementId?: string;
  anchorPosition?: { left: number; top: number };
  anchorOrigin?: {
    horizontal: "LEFT" | "CENTER" | "RIGHT";
    vertical: "TOP" | "CENTER" | "BOTTOM";
  };
  transformOrigin?: {
    horizontal: "LEFT" | "CENTER" | "RIGHT";
    vertical: "TOP" | "CENTER" | "BOTTOM";
  };
  anchorReference?: "ELEMENT" | "POSITION";
  hidePaper?: boolean;
  disableClickAway?: boolean;
  marginThreshold?: number;
};
```

```ts
await OBR.popovers.open({
  id: "my-extension/popover",
  url: "/popover",
  width: 300,
  height: 400,
  anchorElementId: "my-button",
  anchorOrigin: { horizontal: "CENTER", vertical: "BOTTOM" },
  transformOrigin: { horizontal: "CENTER", vertical: "TOP" },
});
```

---

## OBR.modals

Open modal dialogs that block the UI.

| Method | Signature | Description |
|--------|-----------|-------------|
| `open` | `(modal: Modal) => Promise<void>` | Open modal |
| `close` | `(id: string) => Promise<void>` | Close modal |

**Modal type:**
```ts
type Modal = {
  id: string;
  url: string;
  width?: number;
  height?: number;
  fullScreen?: boolean;
  hideBackdrop?: boolean;
  hidePaper?: boolean;
  disablePointerEvents?: boolean;
};
```

```ts
await OBR.modal.open({
  id: "my-extension/settings",
  url: "/settings",
  width: 500,
  height: 600,
});

// Close from inside the modal iframe:
await OBR.modal.close("my-extension/settings");
```

---

## OBR.actions

Control the action bar button for this extension.

| Method | Signature | Description |
|--------|-----------|-------------|
| `getWidth` | `() => Promise<number>` | Get popover width |
| `setWidth` | `(width: number) => Promise<void>` | Set popover width |
| `getHeight` | `() => Promise<number>` | Get popover height |
| `setHeight` | `(height: number) => Promise<void>` | Set popover height |
| `getBadgeText` | `() => Promise<string \| undefined>` | Get badge text |
| `setBadgeText` | `(text?: string) => Promise<void>` | Set badge (pass `undefined` to clear) |
| `getBadgeBackgroundColor` | `() => Promise<string>` | Get badge background color |
| `setBadgeBackgroundColor` | `(color: string) => Promise<void>` | Set badge background color |
| `getIcon` | `() => Promise<string>` | Get icon URL |
| `setIcon` | `(icon: string) => Promise<void>` | Set icon URL |
| `getTitle` | `() => Promise<string>` | Get tooltip title |
| `setTitle` | `(title: string) => Promise<void>` | Set tooltip title |
| `isOpen` | `() => Promise<boolean>` | Is the action popover open |
| `open` | `() => Promise<void>` | Open action popover |
| `close` | `() => Promise<void>` | Close action popover |
| `onOpenChange` | `(callback: (isOpen: boolean) => void) => () => void` | Subscribe to open/close |

```ts
// Show a notification badge
await OBR.action.setBadgeText("3");
await OBR.action.setBadgeBackgroundColor("#ff0000");
```

---

## OBR.interactions

Temporarily render item state updates locally (optimistic UI) before committing.

| Method | Signature | Description |
|--------|-----------|-------------|
| `startItemInteraction` | `<S extends Item \| Item[]>(baseState: S) => Promise<InteractionManager<S>>` | Start an interaction |

**InteractionManager** returns a tuple `[update, stop]`:
- `update(fn: (draft: Draft<S>) => void): S` — Apply Immer mutation, returns updated state
- `stop(): void` — End the interaction (commits nothing automatically — you must call `updateItems` separately if needed)

```ts
const [updateInteraction, stopInteraction] =
  await OBR.interaction.startItemInteraction(item);

// During drag/move - updates local rendering only
function onMouseMove(pos: Vector2) {
  updateInteraction((draft) => {
    draft.position = pos;
  });
}

// On release - commit to scene
function onMouseUp(pos: Vector2) {
  stopInteraction();
  await OBR.scene.items.updateItems([item.id], (items) => {
    items[0].position = pos;
  });
}
```

---

## OBR.rooms

Access room-level data and permissions.

| Method | Signature | Description |
|--------|-----------|-------------|
| `id` | `string` (getter) | Room ID (sync) |
| `getPermissions` | `() => Promise<Permission[]>` | Active room permissions |
| `getMetadata` | `() => Promise<Metadata>` | Room metadata |
| `setMetadata` | `(update: Partial<Metadata>) => Promise<void>` | Update room metadata |
| `onMetadataChange` | `(callback: (metadata: Metadata) => void) => () => void` | Subscribe to metadata |
| `onPermissionsChange` | `(callback: (permissions: Permission[]) => void) => () => void` | Subscribe to permissions |

**All Permission values:**
```ts
type Permission =
  | "FOG_CREATE" | "FOG_UPDATE" | "FOG_DELETE"
  | "MAP_CREATE" | "MAP_UPDATE" | "MAP_DELETE"
  | "PROP_CREATE" | "PROP_UPDATE" | "PROP_DELETE"
  | "MOUNT_CREATE" | "MOUNT_UPDATE" | "MOUNT_DELETE"
  | "CHARACTER_CREATE" | "CHARACTER_UPDATE" | "CHARACTER_DELETE" | "CHARACTER_OWNER_ONLY"
  | "ATTACHMENT_CREATE" | "ATTACHMENT_UPDATE" | "ATTACHMENT_DELETE"
  | "NOTE_CREATE" | "NOTE_UPDATE" | "NOTE_DELETE"
  | "DRAWING_CREATE" | "DRAWING_UPDATE" | "DRAWING_DELETE"
  | "RULER_CREATE" | "RULER_UPDATE" | "RULER_DELETE"
  | "POINTER_CREATE" | "POINTER_UPDATE" | "POINTER_DELETE"
  | "TEXT_CREATE" | "TEXT_UPDATE" | "TEXT_DELETE";
```

---

## OBR.theme

Get and watch the current UI theme.

| Method | Signature | Description |
|--------|-----------|-------------|
| `getTheme` | `() => Promise<Theme>` | Get current theme |
| `onChange` | `(callback: (theme: Theme) => void) => () => void` | Subscribe to theme changes |

**Theme type:**
```ts
type Theme = {
  mode: "DARK" | "LIGHT";
  primary: { light: string; main: string; dark: string; contrastText: string };
  secondary: { light: string; main: string; dark: string; contrastText: string };
  background: { default: string; paper: string };
  text: { primary: string; secondary: string; disabled: string };
};
```

```ts
const theme = await OBR.theme.getTheme();
document.body.style.backgroundColor = theme.background.default;

OBR.theme.onChange((theme) => {
  document.body.dataset.theme = theme.mode.toLowerCase();
});
```

---

## OBR.assets

Upload and download image and scene assets.

| Method | Signature | Description |
|--------|-----------|-------------|
| `uploadImages` | `(images: ImageUpload[], typeHint?: ImageAssetType) => Promise<void>` | Upload images to asset library |
| `uploadScenes` | `(scenes: SceneUpload[], disableShowScenes?: boolean) => Promise<void>` | Upload scenes |
| `downloadImages` | `(multiple?: boolean, defaultSearch?: string, typeHint?: ImageAssetType) => Promise<ImageDownload[]>` | Open image picker |
| `downloadScenes` | `(multiple?: boolean, defaultSearch?: string) => Promise<SceneDownload[]>` | Open scene picker |

**ImageAssetType:** `"MAP" | "PROP" | "MOUNT" | "CHARACTER" | "ATTACHMENT" | "NOTE"`

```ts
// Open image picker (returns selected images)
const images = await OBR.assets.downloadImages(false, "", "CHARACTER");
if (images.length > 0) {
  const { url, width, height } = images[0];
  // Use url to build an IMAGE item
}
```

---

## OBR.broadcast

Send and receive messages between players/extension iframes.

| Method | Signature | Description |
|--------|-----------|-------------|
| `sendMessage` | `(channel: string, data: unknown, options?: BroadcastOptions) => Promise<void>` | Send message on channel |
| `onMessage` | `(channel: string, callback: (event: BroadcastEvent) => void) => () => void` | Subscribe to channel |

**BroadcastOptions:**
```ts
type BroadcastOptions = {
  destination?: "LOCAL" | "REMOTE" | "ALL"; // Default: "ALL"
};
```

```ts
// Sender
await OBR.broadcast.sendMessage("my-extension/ping", { timestamp: Date.now() });

// Receiver
const unsubscribe = OBR.broadcast.onMessage("my-extension/ping", (event) => {
  console.log("Received:", event.data);
});
```

> Use namespaced channels (`"extension-id/channel-name"`) to avoid collisions.

---

## Item Types & Builders

All items extend the base `Item` interface:

```ts
type Item = {
  id: string;              // Immutable, auto-generated
  type: string;            // Discriminator field
  name: string;
  visible: boolean;
  locked: boolean;
  layer: Layer;
  zIndex: number;
  position: Vector2;
  rotation: number;        // Degrees
  scale: Vector2;
  metadata: Metadata;
  createdUserId: string;   // Immutable
  lastModified: number;    // Immutable timestamp
  lastModifiedUserId: string; // Immutable
  attachedTo?: string;     // Parent item ID
  disableHit?: boolean;    // Not clickable
  disableAutoZIndex?: boolean;
  disableAttachmentBehavior?: AttachmentBehavior[];
};
```

**Layer values:**
```ts
type Layer =
  | "MAP" | "GRID" | "DRAWING" | "PROP" | "MOUNT" | "CHARACTER"
  | "ATTACHMENT" | "NOTE" | "TEXT" | "RULER" | "FOG" | "POINTER"
  | "POST_PROCESS" | "CONTROL" | "POPOVER";
```

### Builder Base Methods (all builders)

```ts
builder
  .id(string)
  .name(string)
  .position({ x, y })
  .rotation(degrees)
  .scale({ x, y })
  .visible(boolean)
  .locked(boolean)
  .layer(Layer)
  .zIndex(number)
  .metadata(Metadata)
  .attachedTo(parentId)
  .disableHit(boolean)
  .disableAutoZIndex(boolean)
  .createdUserId(string)
  .build()  // Returns the final Item
```

---

### IMAGE

```ts
import { buildImage } from "@owlbear-rodeo/sdk";

const image = buildImage(
  {
    url: "https://example.com/token.png",
    mime: "image/png",
    width: 256,
    height: 256,
  },
  { dpi: 300, offset: { x: 128, y: 128 } }  // grid config
)
  .name("Token")
  .position({ x: 0, y: 0 })
  .layer("CHARACTER")
  // Optional text overlay:
  .text({ type: "PLAIN", plainText: "10 HP" })
  .textItemType("LABEL")
  .build();
```

**Image-specific builder methods:**
- `.text(TextContent)`, `.plainText(string)`, `.richText(string)`
- `.textItemType("LABEL" | "TEXT")`
- `.fontFamily(string)`, `.fontSize(number)`, `.fontWeight(number)`
- `.textAlign("LEFT" | "CENTER" | "RIGHT")`
- `.textAlignVertical("TOP" | "MIDDLE" | "BOTTOM")`
- `.textFillColor(string)`, `.textFillOpacity(number)`
- `.textStrokeColor(string)`, `.textStrokeOpacity(number)`, `.textStrokeWidth(number)`
- `.textPadding(number)`, `.textLineHeight(number)`, `.textWidth(number)`, `.textHeight(number)`

---

### SHAPE

```ts
import { buildShape } from "@owlbear-rodeo/sdk";

const rect = buildShape()
  .shapeType("RECTANGLE")   // "RECTANGLE" | "CIRCLE" | "TRIANGLE" | "HEXAGON"
  .width(150)
  .height(100)
  .fillColor("#4488ff")
  .fillOpacity(0.5)
  .strokeColor("#ffffff")
  .strokeOpacity(1)
  .strokeWidth(2)
  .strokeDash([5, 3])        // Dash pattern
  .position({ x: 0, y: 0 })
  .layer("DRAWING")
  .build();
```

---

### TEXT

```ts
import { buildText } from "@owlbear-rodeo/sdk";

const text = buildText()
  .plainText("Hello World")
  .fontSize(24)
  .fontFamily("Arial")
  .fontWeight(700)
  .fillColor("#ffffff")
  .textAlign("CENTER")
  .position({ x: 0, y: 0 })
  .layer("TEXT")
  .build();
```

**Text builder methods:**
- `.text(TextContent)`, `.plainText(string)`, `.richText(string)`
- `.textType("PLAIN" | "RICH")`
- `.width(number)`, `.height(number)`, `.padding(number)`, `.lineHeight(number)`
- `.fontFamily(string)`, `.fontSize(number)`, `.fontWeight(number)`
- `.textAlign("LEFT" | "CENTER" | "RIGHT")`
- `.textAlignVertical("TOP" | "MIDDLE" | "BOTTOM")`
- `.fillColor(string)`, `.fillOpacity(number)`
- `.strokeColor(string)`, `.strokeOpacity(number)`, `.strokeWidth(number)`

---

### LABEL

```ts
import { buildLabel } from "@owlbear-rodeo/sdk";

const label = buildLabel()
  .plainText("5 ft")
  .fontSize(16)
  .backgroundColor("#000000")
  .backgroundOpacity(0.7)
  .pointerDirection("DOWN")  // "UP" | "DOWN" | "LEFT" | "RIGHT"
  .pointerWidth(10)
  .pointerHeight(10)
  .cornerRadius(4)
  .position({ x: 0, y: 0 })
  .layer("TEXT")
  .build();
```

**Label-specific builder methods:**
- `.style(LabelStyle)`, `.backgroundColor(string)`, `.backgroundOpacity(number)`
- `.cornerRadius(number)`
- `.pointerDirection("UP" | "DOWN" | "LEFT" | "RIGHT")`
- `.pointerWidth(number)`, `.pointerHeight(number)`
- `.maxViewScale(number)`, `.minViewScale(number)` — auto-hide at zoom levels

---

### CURVE

```ts
import { buildCurve } from "@owlbear-rodeo/sdk";

const curve = buildCurve()
  .points([{ x: 0, y: 0 }, { x: 100, y: 50 }, { x: 200, y: 0 }])
  .tension(0.5)      // 0 = straight lines, 1 = maximum curve
  .closed(false)
  .fillColor("#ff0000")
  .fillOpacity(0.3)
  .strokeColor("#ff0000")
  .strokeWidth(3)
  .layer("DRAWING")
  .build();
```

---

### RULER

```ts
import { buildRuler } from "@owlbear-rodeo/sdk";

const ruler = buildRuler()
  .startPosition({ x: 0, y: 0 })
  .endPosition({ x: 300, y: 0 })
  .measurement("5 ft")
  .layer("RULER")
  .build();
```

---

### WALL

```ts
import { buildWall } from "@owlbear-rodeo/sdk";

const wall = buildWall()
  .points([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }])
  .doubleSided(false)
  .blocking(true)
  .layer("FOG")
  .build();
```

---

### LIGHT

```ts
import { buildLight } from "@owlbear-rodeo/sdk";

const light = buildLight()
  .attenuationRadius(300)
  .sourceRadius(10)
  .falloff(1)
  .innerAngle(360)
  .outerAngle(360)
  .lightType("PRIMARY")   // "PRIMARY" | "SECONDARY" | "AUXILIARY"
  .attachedTo(tokenId)
  .layer("CHARACTER")
  .build();
```

---

### POINTER

```ts
import { buildPointer } from "@owlbear-rodeo/sdk";

const pointer = buildPointer()
  .color("#ff0000")
  .radius(20)
  .position({ x: 0, y: 0 })
  .layer("POINTER")
  .build();
```

---

### EFFECT

```ts
import { buildEffect } from "@owlbear-rodeo/sdk";

const effect = buildEffect()
  .effectType("STANDALONE")  // "STANDALONE" | "ATTACHMENT" | "VIEWPORT"
  .width(200)
  .height(200)
  .sksl(`/* SkSL shader code */`)
  .uniforms([{ name: "iTime", value: 0 }])
  .blendMode("SRC_OVER")
  .layer("POST_PROCESS")
  .build();
```

---

### BILLBOARD

A billboard image always faces the camera (useful for 3D/isometric scenes).

```ts
import { buildBillboard } from "@owlbear-rodeo/sdk";

const billboard = buildBillboard(
  { url: "...", mime: "image/png", width: 128, height: 256 },
  { dpi: 150, offset: { x: 64, y: 256 } }
)
  .maxViewScale(2)
  .minViewScale(0.5)
  .layer("CHARACTER")
  .build();
```

---

### PATH / LINE

```ts
import { buildPath, buildLine } from "@owlbear-rodeo/sdk";

const path = buildPath()
  // Similar to SVG path data
  .layer("DRAWING")
  .build();

const line = buildLine()
  .startPosition({ x: 0, y: 0 })
  .endPosition({ x: 100, y: 0 })
  .layer("DRAWING")
  .build();
```

---

## Common Types

```ts
// 2D coordinate
type Vector2 = { x: number; y: number };

// 3D coordinate
type Vector3 = { x: number; y: number; z: number };

// Axis-aligned bounding box
type BoundingBox = {
  min: Vector2;
  max: Vector2;
  center: Vector2;
  width: number;
  height: number;
};

// Flexible key-value store — namespaced to avoid collisions
type Metadata = Record<string, unknown>;
// Convention: { "com.example.extension/key": value }

// Item filter (used by getItems/updateItems)
type ItemFilter<T> =
  | string[]                         // Item IDs
  | ((item: Item) => item is T)      // Type guard
  | undefined;                       // All items

// Immer draft (passed to update callbacks)
type Draft<T> = WritableDraft<T>;   // From immer

// Grid scale
type GridScale = {
  parsed: { multiplier: number; unit: string; digits: number };
  raw: string;   // e.g., "5 ft"
};

// Attachment behaviors that can be disabled
type AttachmentBehavior =
  | "ROTATION"
  | "SCALE"
  | "VISIBLE"
  | "LOCKED"
  | "COPY"
  | "DELETE";
```

---

## Patterns & Examples

### Subscribe & Unsubscribe

All `onChange`/`onMessage`/`onReady` methods return an unsubscribe function:

```ts
const unsubscribe = OBR.scene.items.onChange((items) => {
  // ...handle change
});

// Clean up in React useEffect:
useEffect(() => {
  const unsub = OBR.scene.items.onChange(handleChange);
  return () => unsub();
}, []);
```

### Checking Scene Ready State

```ts
OBR.onReady(async () => {
  const isReady = await OBR.scene.isReady();
  if (isReady) {
    initScene();
  }

  OBR.scene.onReadyChange((ready) => {
    if (ready) initScene();
    else cleanupScene();
  });
});
```

### Updating Items with Immer

```ts
// Update multiple items atomically
await OBR.scene.items.updateItems(
  (item): item is Image => isImage(item) && item.layer === "CHARACTER",
  (items) => {
    for (const item of items) {
      item.visible = true;
      item.metadata["com.example/hp"] = 20;
    }
  }
);
```

### Metadata Namespacing

Always namespace metadata keys with your extension ID to avoid collisions:

```ts
const METADATA_KEY = "com.example.my-extension/data";

// Write
await OBR.scene.items.updateItems([itemId], (items) => {
  items[0].metadata[METADATA_KEY] = { hp: 20, maxHp: 30 };
});

// Read
const items = await OBR.scene.items.getItems([itemId]);
const data = items[0].metadata[METADATA_KEY] as { hp: number; maxHp: number };
```

### Attaching Items

Items attached to a parent follow the parent's movement/rotation:

```ts
const label = buildLabel()
  .plainText("10 HP")
  .attachedTo(parentItem.id)
  .disableHit(true)                         // Not selectable
  .disableAttachmentBehavior(["ROTATION"])  // Don't rotate with parent
  .layer("TEXT")
  .position(parentItem.position)
  .build();

await OBR.scene.items.addItems([label]);
```

### GM-Only Operations

```ts
const role = await OBR.player.getRole();
if (role === "GM") {
  // Only GMs can do this
  await OBR.scene.items.deleteItems(selectedIds);
}

// Or check a specific permission
const canCreate = await OBR.player.hasPermission("CHARACTER_CREATE");
```

### React Integration Pattern

```ts
import { useEffect, useState } from "react";
import OBR, { Item } from "@owlbear-rodeo/sdk";

function useSceneItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    OBR.onReady(() => {
      OBR.scene.onReadyChange(async (isReady) => {
        setReady(isReady);
        if (isReady) {
          setItems(await OBR.scene.items.getItems());
        } else {
          setItems([]);
        }
      });

      const unsub = OBR.scene.items.onChange(setItems);
      return () => unsub();
    });
  }, []);

  return { items, ready };
}
```

### Cross-Player Communication via Broadcast

```ts
// GM sends a command
await OBR.broadcast.sendMessage("my-extension/reveal", {
  itemIds: ["id1", "id2"],
});

// All clients listen
OBR.broadcast.onMessage("my-extension/reveal", async (event) => {
  const { itemIds } = event.data as { itemIds: string[] };
  await OBR.scene.items.updateItems(itemIds, (items) => {
    for (const item of items) item.visible = true;
  });
});
```

### Type Guards (built-in)

```ts
import {
  isImage, isShape, isText, isLabel, isCurve,
  isRuler, isWall, isLight, isPointer, isEffect,
  isBillboard, isPath, isLine,
} from "@owlbear-rodeo/sdk";

const images = await OBR.scene.items.getItems(isImage);
const shapes = await OBR.scene.items.getItems(isShape);
```
