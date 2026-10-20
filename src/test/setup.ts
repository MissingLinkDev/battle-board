// The Owlbear SDK connects to its parent frame as soon as it is imported.
// Give it just enough of a browser to load, so tests can use its pure helpers
// (builders, type guards) without a DOM library.
const g = globalThis as unknown as { window?: unknown };
g.window ??= {
    location: { search: "" },
    parent: { postMessage() {} },
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    clearTimeout,
};
