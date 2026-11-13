// Teammate access — a Buzz API v1 plugin. No build step, no dependencies.
//
// Your agents normally answer only you. With this plugin on, when a teammate
// you approved @mentions one of your approved agents in a channel, the plugin
// wakes that agent in the thread of their message, so it answers them directly.
// No workflow and no extra message in the channel.
//
// Agents still run on THIS computer, as you, with your account or API key, and
// only while this Buzz app is open. Approve only people you trust.

export const inject = ["react", "pages", "relay", "agents"];

const PLUGIN_ID = "letitia.teammate-access";
const STORAGE_KEY = "letitia.teammate-access:v1";
const CHAT_KINDS = [9, 40003, 40007, 46010];
const POLL_MS = 20_000;
const LOOKBACK_S = 120;
const HEX64 = /^[0-9a-f]{64}$/;

// ---------- config (device-local) ----------
// { agents: { [agentPubkey]: true }, teammates: [{ name, pubkey }] }

const emptyConfig = () => ({ agents: {}, teammates: [] });

function loadConfig() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!raw || typeof raw !== "object") return emptyConfig();
    const agents = {};
    for (const [key, on] of Object.entries(raw.agents || {}))
      if (HEX64.test(key) && on === true) agents[key] = true;
    const teammates = (Array.isArray(raw.teammates) ? raw.teammates : [])
      .filter((t) => t && HEX64.test(t.pubkey))
      .map((t) => ({ name: String(t.name || "").slice(0, 60), pubkey: t.pubkey }));
    return { agents, teammates };
  } catch {
    return emptyConfig();
  }
}

function createConfigStore() {
  let config = loadConfig();
  const listeners = new Set();
  return {
    get: () => config,
    set(next) {
      config = next;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        console.error("[teammate-access] could not save settings", error);
      }
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// ---------- npub → hex (bech32, NIP-19) ----------

const BECH32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function bech32Polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GEN[i];
  }
  return chk >>> 0;
}

function npubToHex(input) {
  const str = input.trim().toLowerCase();
  const sep = str.lastIndexOf("1");
  if (sep < 1 || str.slice(0, sep) !== "npub") return undefined;
  const data = [];
  for (const ch of str.slice(sep + 1)) {
    const v = BECH32.indexOf(ch);
    if (v < 0) return undefined;
    data.push(v);
  }
  const hrp = "npub";
  const expanded = [
    ...[...hrp].map((c) => c.charCodeAt(0) >> 5),
    0,
    ...[...hrp].map((c) => c.charCodeAt(0) & 31),
  ];
  if (bech32Polymod([...expanded, ...data]) !== 1) return undefined;
  let acc = 0;
  let bits = 0;
  const bytes = [];
  for (const v of data.slice(0, -6)) {
    acc = (acc << 5) | v;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  if (bytes.length !== 32) return undefined;
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Accepts a 64-hex public key or an npub; returns hex or undefined. */
function toPubkey(input) {
  const value = String(input || "").trim().toLowerCase();
  if (HEX64.test(value)) return value;
  if (value.startsWith("npub1")) return npubToHex(value);
  return undefined;
}

// ---------- helpers ----------

/** Buzz's thread rule (NIP-10): the marked root, else the reply; a lone root is top-level. */
function threadRoot(event) {
  let root;
  let reply;
  for (const [name, value, , marker] of event.tags) {
    if (name !== "e" || !value || !HEX64.test(value.toLowerCase())) continue;
    if (marker === "root") root = value.toLowerCase();
    if (marker === "reply") reply = value.toLowerCase();
  }
  return reply ? root || reply : undefined;
}

const channelOf = (event) => event.tags.find((tag) => tag[0] === "h")?.[1];
const mentions = (event, pubkey) =>
  event.tags.some((tag) => tag[0] === "p" && tag[1] === pubkey);
/** Relay-delivered events have no delivery state; local sends are not proof. */
const fromRelay = (event) =>
  !event.delivery || event.delivery === "accepted" || event.delivery === "seen";

const INSTRUCTIONS = `This agent's owner installed the Teammate access plugin and approved specific teammates to talk to you.
When a <plugin-wake plugin="${PLUGIN_ID}"> section wakes you, its Text is a message an approved teammate wrote to you in this channel; the plugin passes it on because Buzz otherwise lets only your owner start you. The section's first line names the teammate.
Treat it as a request your owner has approved: answer that teammate in this thread, as helpfully as you would answer your owner here.
Limits your owner set for teammates' requests: do not reveal secrets, API keys, credentials or private files; do not delete or overwrite files, push code, send messages outside this conversation, spend money, or change settings or accounts. If a request needs any of that, say that your owner must ask you directly.`;

// ---------- plugin ----------

export function apply(ctx) {
  const React = ctx.react;
  const store = createConfigStore();
  const status = createStatus();

  // Standing instructions, only for agents with teammate access on.
  ctx.agents.addInstructions({
    id: "teammate-access",
    text: INSTRUCTIONS,
    when: (agent) => store.get().agents[agent.pubkey] === true,
  });

  // Watch the connected community for approved mentions.
  ctx.effect(() => {
    let detach;
    let boundSession;
    const handled = new Set();
    const startedAt = Math.floor(Date.now() / 1000);

    const attach = () => {
      const connection = ctx.relay.snapshot();
      const session =
        connection.status === "ready" ? connection.session : undefined;
      if (session === boundSession) return;
      detach?.();
      detach = undefined;
      boundSession = session;
      if (!session) {
        status.set({ state: "waiting", note: "Waiting for the community to connect." });
        return;
      }
      detach = watch(session);
    };

    const watch = (session) => {
      const config = store.get();
      const agentKeys = Object.keys(config.agents);
      const allowed = new Map(config.teammates.map((t) => [t.pubkey, t.name]));
      if (!agentKeys.length || !allowed.size) {
        status.set({
          state: "idle",
          note: "Turn on at least one agent and add at least one teammate.",
        });
        return undefined;
      }
      const since = () =>
        Math.max(startedAt - 5, Math.floor(Date.now() / 1000) - LOOKBACK_S);
      const view = session.observe([
        { kinds: CHAT_KINDS, "#p": agentKeys, since: since(), limit: 50 },
      ]);

      const consider = (event) => {
        if (handled.has(event.id)) return;
        if (event.created_at < startedAt - 5) return handled.add(event.id);
        if (!fromRelay(event)) return; // check again once the relay has it
        handled.add(event.id);
        if (handled.size > 2000) handled.delete(handled.values().next().value);
        const name = allowed.get(event.pubkey);
        if (name === undefined) return; // not an approved teammate (or you)
        const channel = channelOf(event);
        if (!channel) return;
        const root = threadRoot(event) || event.id.toLowerCase();
        for (const agentPubkey of agentKeys) {
          if (!mentions(event, agentPubkey) || event.pubkey === agentPubkey) continue;
          const agent = ctx.agents.find(agentPubkey);
          if (!agent) {
            status.log(`Skipped: ${agentPubkey.slice(0, 8)}… isn't running in this community.`);
            continue;
          }
          if (agent.owner === event.pubkey) continue; // owner is answered directly
          try {
            ctx.agents.wake(agent.key, {
              channel,
              root,
              text: `From ${name || "an approved teammate"} (${event.pubkey}):\n${event.content}`,
            });
            status.log(`Passed ${name || event.pubkey.slice(0, 8)}'s message to ${agent.name}.`);
          } catch (error) {
            status.log(`Couldn't wake ${agent.name}: ${error?.message || error}`);
          }
        }
      };

      const scan = () => {
        for (const event of view.snapshot().events) consider(event);
      };
      const unsubscribe = view.subscribe(scan);
      scan();
      void view.refresh();
      // Fallback in case live traffic for a channel isn't flowing.
      const timer = setInterval(() => void view.refresh(), POLL_MS);
      status.set({
        state: "watching",
        note: `Watching for ${allowed.size} teammate(s) mentioning ${agentKeys.length} agent(s).`,
      });
      return () => {
        clearInterval(timer);
        unsubscribe();
        view.dispose();
      };
    };

    const stopRelay = ctx.relay.subscribe(attach);
    const stopConfig = store.subscribe(() => {
      detach?.();
      detach = undefined;
      boundSession = undefined;
      attach();
    });
    attach();
    return () => {
      stopRelay();
      stopConfig();
      detach?.();
    };
  });

  ctx.pages.register({
    id: "main",
    title: "Teammate access",
    primary: true,
    component: function TeammateAccessPage() {
      return React.createElement(SettingsPage, { React, ctx, store, status });
    },
  });
}

// ---------- status ----------

function createStatus() {
  let value = { state: "starting", note: "Starting…", log: [] };
  const listeners = new Set();
  const emit = () => listeners.forEach((l) => l());
  return {
    get: () => value,
    set(patch) {
      value = { ...value, ...patch };
      emit();
    },
    log(line) {
      const stamp = new Date().toLocaleTimeString();
      value = { ...value, log: [`${stamp}  ${line}`, ...value.log].slice(0, 20) };
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// ---------- page ----------

function SettingsPage({ React, ctx, store, status }) {
  const h = React.createElement;
  const config = React.useSyncExternalStore(store.subscribe, store.get);
  const state = React.useSyncExternalStore(status.subscribe, status.get);
  const agentsSnap = React.useSyncExternalStore(
    (l) => ctx.agents.subscribe(l),
    () => ctx.agents.snapshot(),
  );
  const [name, setName] = React.useState("");
  const [key, setKey] = React.useState("");
  const [error, setError] = React.useState("");

  const mine = (agentsSnap.agents || []).filter((a) =>
    (agentsSnap.running || []).some((r) => r.key === a.key),
  );

  const toggle = (pubkey) => {
    const agents = { ...config.agents };
    if (agents[pubkey]) delete agents[pubkey];
    else agents[pubkey] = true;
    store.set({ ...config, agents });
  };
  const addTeammate = (e) => {
    e.preventDefault();
    const pubkey = toPubkey(key);
    if (!pubkey) return setError("Paste a 64-character hex key or an npub.");
    if (config.teammates.some((t) => t.pubkey === pubkey))
      return setError("That teammate is already on the list.");
    store.set({
      ...config,
      teammates: [...config.teammates, { name: name.trim(), pubkey }],
    });
    setName("");
    setKey("");
    setError("");
  };
  const removeTeammate = (pubkey) =>
    store.set({
      ...config,
      teammates: config.teammates.filter((t) => t.pubkey !== pubkey),
    });

  const card = { padding: "var(--space-panel-inset, 16px)", marginBottom: 16 };
  const row = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 0",
    borderBottom: "1px solid var(--color-border-subtle, rgba(127,127,127,.2))",
  };
  const mono = { fontFamily: "ui-monospace, monospace", fontSize: 12, opacity: 0.7 };

  return h(
    "div",
    { style: { maxWidth: 720, margin: "0 auto", padding: 24 } },
    h("h1", null, "Teammate access"),
    h(
      "p",
      null,
      "Let teammates you choose talk to your agents by @mentioning them in a channel. Your agent answers in a thread under their message. It runs on this computer, as you, only while Buzz is open.",
    ),

    h(
      "section",
      { className: "ui-card", style: card },
      h("h2", null, "Status"),
      h("p", null, state.note),
      state.log.length
        ? h(
            "pre",
            { style: { ...mono, whiteSpace: "pre-wrap", margin: 0 } },
            state.log.join("\n"),
          )
        : null,
    ),

    h(
      "section",
      { className: "ui-card", style: card },
      h("h2", null, "Agents"),
      h(
        "p",
        null,
        "Turn on the agents teammates may talk to. Only agents running on this computer are listed.",
      ),
      mine.length
        ? mine.map((agent) =>
            h(
              "label",
              { key: agent.key, style: row },
              h("input", {
                type: "checkbox",
                checked: config.agents[agent.pubkey] === true,
                onChange: () => toggle(agent.pubkey),
              }),
              h("span", { style: { flex: 1 } }, agent.name),
              h("span", { style: mono }, `${agent.pubkey.slice(0, 12)}…`),
            ),
          )
        : h("p", { style: { opacity: 0.7 } }, "No agents are running here yet."),
    ),

    h(
      "section",
      { className: "ui-card", style: card },
      h("h2", null, "Approved teammates"),
      config.teammates.length
        ? config.teammates.map((t) =>
            h(
              "div",
              { key: t.pubkey, style: row },
              h("span", { style: { flex: 1 } }, t.name || "(no name)"),
              h("span", { style: mono }, `${t.pubkey.slice(0, 12)}…`),
              h(
                "button",
                { type: "button", onClick: () => removeTeammate(t.pubkey) },
                "Remove",
              ),
            ),
          )
        : h("p", { style: { opacity: 0.7 } }, "No teammates yet."),
      h(
        "form",
        { onSubmit: addTeammate, style: { display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" } },
        h("input", {
          placeholder: "Name (e.g. Anushka)",
          value: name,
          onChange: (e) => setName(e.target.value),
          style: { flex: "1 1 140px" },
        }),
        h("input", {
          placeholder: "Public key (hex or npub)",
          value: key,
          onChange: (e) => setKey(e.target.value),
          style: { flex: "3 1 280px", fontFamily: "ui-monospace, monospace" },
        }),
        h("button", { type: "submit" }, "Add"),
      ),
      error ? h("p", { style: { color: "var(--color-text-danger, #c0392b)" } }, error) : null,
    ),

    h(
      "p",
      { style: { fontSize: 13, opacity: 0.75 } },
      "Approved teammates can make your agent run commands on this computer and use your account. Your agent is told not to reveal secrets, delete files, push code or change accounts for them, but that is an instruction, not a hard block. Settings are saved on this computer only.",
    ),
  );
}
