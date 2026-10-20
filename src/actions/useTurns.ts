import { clearRings } from "../components/rings";
import { encounterStore } from "../encounter";

export function useTurns() {
    return {
        handleStart: () => encounterStore.start().catch(console.error),
        handleEnd: () => encounterStore.end().then(() => clearRings("normal")).catch(console.error),
        handleNext: () => encounterStore.next().catch(console.error),
        handlePrev: () => encounterStore.prev().catch(console.error),
    };
}
