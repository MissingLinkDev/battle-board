import { encounterStore } from "../encounter";

export function useTurns() {
    return {
        handleStart: () => encounterStore.start().catch(console.error),
        handleEnd: () => encounterStore.end().catch(console.error),
        handleNext: () => encounterStore.next().catch(console.error),
        handlePrev: () => encounterStore.prev().catch(console.error),
    };
}
