import type { ObrPort, Unsubscribe } from "../obr/port";
import { DEFAULT_SETTINGS, migrateSettings, ROOM_META_KEY, type InitiativeSettings } from "./settings";

export type SettingsState = { ready: boolean; settings: InitiativeSettings };
export type SettingsStore = ReturnType<typeof createSettingsStore>;

/**
 * Room settings. Every inbound path (first read, change events, writes) goes
 * through `migrateSettings`, so callers always see complete settings.
 */
export function createSettingsStore(port: ObrPort) {
    let state: SettingsState = { ready: false, settings: DEFAULT_SETTINGS };
    const listeners = new Set<() => void>();
    let stopSync: Unsubscribe | null = null;
    let writes: Promise<void> = Promise.resolve();

    function apply(settings: InitiativeSettings) {
        state = { ready: true, settings };
        listeners.forEach((l) => l());
    }

    function startSync() {
        stopSync = port.roomMetadata.onChange((metadata) => apply(migrateSettings(metadata[ROOM_META_KEY])));
        port.roomMetadata.get()
            .then((metadata) => apply(migrateSettings(metadata[ROOM_META_KEY])))
            .catch(console.error);
    }

    return {
        getState: () => state,

        subscribe(listener: () => void): Unsubscribe {
            listeners.add(listener);
            if (!stopSync) startSync();
            return () => listeners.delete(listener);
        },

        dispose() {
            stopSync?.();
            stopSync = null;
            listeners.clear();
        },

        /** Read the current settings without subscribing. */
        async read(): Promise<InitiativeSettings> {
            return migrateSettings((await port.roomMetadata.get())[ROOM_META_KEY]);
        },

        /**
         * Change some settings, merged onto the latest stored values so changes
         * to other settings (from this or another GM) are kept. Writes from this
         * client run in order; if two GMs change the same setting, the last
         * write wins.
         */
        update(patch: Partial<InitiativeSettings>): Promise<void> {
            const run = writes.then(async () => {
                const latest = migrateSettings((await port.roomMetadata.get())[ROOM_META_KEY]);
                const next = { ...latest, ...patch };
                if (listeners.size) apply(next);
                await port.roomMetadata.set({ [ROOM_META_KEY]: next });
            });
            writes = run.catch(() => {});
            return run;
        },
    };
}
