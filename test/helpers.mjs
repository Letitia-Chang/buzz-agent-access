// Loads the built plugin.js as a module and gives tests a fake Buzz host.
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../plugin.js", import.meta.url), "utf8");

/** The plugin's internals: `core`, `createRuntime`, `App`, plus `apply`. */
export async function loadPlugin() {
  const exposed = src + "\nexport const __test = { core, createRuntime, App };\n";
  const url = "data:text/javascript;base64," + Buffer.from(exposed).toString("base64");
  return import(url);
}

export function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    clear: () => data.clear(),
    data,
  };
}

export const hex = (n) => n.toString(16).padStart(64, "0");
export const OWNER = hex(1);
export const COFFEE = hex(0xc0ffee);
export const POTATO = hex(0xbada55);
export const ANUSHKA = hex(0xa1);
export const OMAR = hex(0x0a);
export const TEAM = "team-channel";
export const PUBLIC = "discover";

/** A fake host: relay session with channels and an observable view, agents, notices. */
export function fakeHost({ guarded = true, notices = true, noticeAnswer = undefined } = {}) {
  const listeners = new Set();
  const viewListeners = new Set();
  let events = [];
  const channels = [
    { id: TEAM, name: "north-star", visibility: "private", members: [OWNER, ANUSHKA] },
    { id: PUBLIC, name: "discover", visibility: "public", members: Array.from({ length: 30 }, (_, i) => hex(1000 + i)) },
  ];
  const session = {
    channels: { list: () => channels, ensureList: () => {}, subscribeList: () => () => {} },
    profiles: { snapshot: () => new Map([[ANUSHKA, { name: "Anushka" }], [OMAR, { name: "Omar" }]]) },
    observe: () => ({
      snapshot: () => ({ events }),
      subscribe: (l) => { viewListeners.add(l); return () => viewListeners.delete(l); },
      refresh: async () => {},
      dispose: () => {},
    }),
  };
  const agents = [
    { key: "k-coffee", pubkey: COFFEE, name: "Coffeehead", type: "buzz.claude-code/claude", owner: OWNER, place: "here" },
    { key: "k-potato", pubkey: POTATO, name: "Mr. Potato", type: "buzz.builderlab/kiwi", owner: OWNER, place: "hosted" },
  ];
  const wakes = [];
  const shown = [];
  const ctx = {
    react: undefined,
    reflect: {
      get: (name) =>
        name === "notices" && notices
          ? { show: async (n) => { shown.push(n); return noticeAnswer; } }
          : undefined,
    },
    relay: { snapshot: () => ({ status: "ready", session }), subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); } },
    agents: {
      find: (pk) => agents.find((a) => a.pubkey === pk),
      snapshot: () => ({ agents, running: agents.filter((a) => a.place === "here") }),
      subscribe: () => () => {},
      addInstructions: () => {},
      ...(guarded ? { supportsGuardedWake: true } : {}),
      wake: guarded
        ? async (key, wake, opts) => { wakes.push({ key, ...wake, guarded: true }); return opts.current() ? { status: "delivered" } : { status: "dropped", reason: "stale" }; }
        : (key, wake) => { wakes.push({ key, ...wake }); },
    },
    host: { writeClipboardText: async () => {} },
    pages: { register: () => {} },
    effect: () => {},
  };
  return {
    ctx, wakes, shown, channels, agents,
    post(event) {
      events = [...events, { kind: 9, created_at: Math.floor(Date.now() / 1000), content: "hi", tags: [], ...event }];
      for (const l of viewListeners) l();
    },
  };
}

export const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
