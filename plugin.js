// Teammate access — a Buzz API v1 plugin. No build step, no dependencies.
//
// Your agents normally answer only you. This plugin lets other people talk to
// the agents you choose by @mentioning them, in two ways:
//   • Channels: everyone in a channel you pick. In a private channel only its
//     members can post, and the relay enforces that, so channel membership is
//     the permission. New members are covered automatically.
//   • People: specific teammates, in any channel you and they share.
// When an allowed message @mentions an enabled agent, the plugin wakes that
// agent in the thread of the message, so it answers there directly.
//
// Agents still run on THIS computer, as you, with your account or API key, and
// only while this Buzz app is open. Each person gets an hourly limit.

export const inject = ["react", "pages", "relay", "agents"];

const PLUGIN_ID = "letitia.teammate-access";
const STORAGE_KEY = "letitia.teammate-access:v1";
const CHAT_KINDS = [9, 40003, 40007, 46010];
const POLL_MS = 20_000;
const LOOKBACK_S = 120;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const DEFAULT_LIMIT = 10;
const DEFAULT_DAILY = 50;
/** Channels or agents reaching more people than this ask for confirmation. */
const LARGE_REACH = 20;
const HEX64 = /^[0-9a-f]{64}$/;

// ---------- config (device-local) ----------
// {
//   agents: { [agentPubkey]: { channels: string[] } },  // enabled agents
//   teammates: [{ name, pubkey }],                      // people, any channel
//   limitPerHour: number,                               // per person, per agent
//   dailyPerAgent: number                               // everyone together, per agent
// }

const emptyConfig = () => ({
  agents: {},
  teammates: [],
  limitPerHour: DEFAULT_LIMIT,
  dailyPerAgent: DEFAULT_DAILY,
});
const intIn = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

function loadConfig() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!raw || typeof raw !== "object") return emptyConfig();
    const agents = {};
    for (const [key, value] of Object.entries(raw.agents || {})) {
      if (!HEX64.test(key)) continue;
      // v1 stored `true`; it meant "approved people only".
      if (value === true) agents[key] = { channels: [] };
      else if (value && Array.isArray(value.channels))
        agents[key] = {
          channels: value.channels.filter((id) => typeof id === "string" && id),
        };
    }
    const teammates = (Array.isArray(raw.teammates) ? raw.teammates : [])
      .filter((t) => t && HEX64.test(t.pubkey))
      .map((t) => ({ name: String(t.name || "").slice(0, 60), pubkey: t.pubkey }));
    return {
      agents,
      teammates,
      limitPerHour: intIn(raw.limitPerHour, 1, 1000, DEFAULT_LIMIT),
      dailyPerAgent: intIn(raw.dailyPerAgent, 1, 10000, DEFAULT_DAILY),
    };
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

/** Who may wake `agentPubkey` with `event`, or undefined when nobody. */
function grantFor(config, agentPubkey, event, channel) {
  const agent = config.agents[agentPubkey];
  if (!agent) return undefined;
  const person = config.teammates.find((t) => t.pubkey === event.pubkey);
  if (person) return { label: person.name || "an approved teammate", via: "person" };
  if (agent.channels.includes(channel)) return { label: "a member of this channel", via: "channel" };
  return undefined;
}

/** Sliding-window counter per key. */
function createLimiter(windowMs) {
  const hits = new Map();
  return {
    count(key, now = Date.now()) {
      return (hits.get(key) || []).filter((t) => now - t < windowMs).length;
    },
    take(key, limit, now = Date.now()) {
      const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}

const INSTRUCTIONS = `This agent's owner installed the Teammate access plugin so that people other than the owner can talk to you: everyone in channels the owner chose, and teammates the owner approved by name.
When a <plugin-wake plugin="${PLUGIN_ID}"> section wakes you, its Text is a message that person wrote to you in this channel; the plugin passes it on because Buzz otherwise lets only your owner start you. The section's first line says who wrote it.
Treat it as a request your owner has approved: answer that person in this thread, as helpfully as you would answer your owner here.
Limits your owner set for these requests: do not reveal secrets, API keys, credentials or private files; do not delete or overwrite files, push code, send messages outside this conversation, spend money, or change settings or accounts. If a request needs any of that, say that your owner must ask you directly.`;

// ---------- plugin ----------

export function apply(ctx) {
  const React = ctx.react;
  const store = createConfigStore();
  const status = createStatus();
  const limiter = createLimiter(HOUR_MS); // per person, per agent
  const daily = createLimiter(DAY_MS); // everyone, per agent
  const usage = { count: (agentPubkey) => daily.count(agentPubkey) };
  const registerPage = () =>
    ctx.pages.register({
      id: "main",
      title: "Teammate access",
      primary: true,
      component: function TeammateAccessPage() {
        return React.createElement(SettingsPage, { React, ctx, store, status, usage });
      },
    });

  // Buzz added addInstructions in desktop v1.0.2; on older versions the
  // limits travel with each wake's text instead.
  const hasInstructions = typeof ctx.agents.addInstructions === "function";
  if (hasInstructions)
    ctx.agents.addInstructions({
      id: "teammate-access",
      text: INSTRUCTIONS,
      when: (agent) => Boolean(store.get().agents[agent.pubkey]),
    });
  if (typeof ctx.agents.wake !== "function") {
    status.set({
      state: "unsupported",
      note: "This Buzz version can't wake agents from plugins. Update Buzz in Settings → Software updates.",
    });
    registerPage();
    return;
  }

  ctx.effect(() => {
    let detach;
    let boundSession;
    const handled = new Set();
    const startedAt = Math.floor(Date.now() / 1000);

    const attach = () => {
      const connection = ctx.relay.snapshot();
      const session = connection.status === "ready" ? connection.session : undefined;
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
      const channelGrants = agentKeys.reduce((n, k) => n + config.agents[k].channels.length, 0);
      if (!agentKeys.length || (!config.teammates.length && !channelGrants)) {
        status.set({
          state: "idle",
          note: "Turn on an agent, then pick at least one channel or add at least one person.",
        });
        return undefined;
      }
      const since = Math.max(startedAt - 5, Math.floor(Date.now() / 1000) - LOOKBACK_S);
      const view = session.observe([
        { kinds: CHAT_KINDS, "#p": agentKeys, since, limit: 50 },
      ]);

      const consider = (event) => {
        if (handled.has(event.id)) return;
        if (event.created_at < startedAt - 5) return handled.add(event.id);
        if (!fromRelay(event)) return; // check again once the relay has it
        handled.add(event.id);
        if (handled.size > 2000) handled.delete(handled.values().next().value);
        const channel = channelOf(event);
        if (!channel) return;
        const root = threadRoot(event) || event.id.toLowerCase();
        const current = store.get();
        for (const agentPubkey of agentKeys) {
          if (!mentions(event, agentPubkey) || event.pubkey === agentPubkey) continue;
          const grant = grantFor(current, agentPubkey, event, channel);
          if (!grant) continue; // not allowed here
          const agent = ctx.agents.find(agentPubkey);
          if (!agent) {
            status.log(`Skipped: ${agentPubkey.slice(0, 8)}… isn't running in this community.`);
            continue;
          }
          if (agent.owner === event.pubkey) continue; // the owner is answered directly
          const who = grant.via === "person" ? grant.label : event.pubkey.slice(0, 8) + "…";
          if (daily.count(agentPubkey) >= current.dailyPerAgent) {
            status.log(`${agent.name} reached its daily limit (${current.dailyPerAgent}); ${who}'s message not passed on.`);
            continue;
          }
          if (!limiter.take(`${agentPubkey}:${event.pubkey}`, current.limitPerHour)) {
            status.log(`Hourly limit reached for ${who} on ${agent.name}; not passed on.`);
            continue;
          }
          daily.take(agentPubkey, current.dailyPerAgent);
          status.bump();
          try {
            ctx.agents.wake(agent.key, {
              channel,
              root,
              text:
                `From ${grant.label} (${event.pubkey}):\n${event.content}` +
                (hasInstructions ? "" : `\n\n---\n${INSTRUCTIONS}`),
            });
            status.log(`Passed ${who}'s message to ${agent.name}.`);
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
      const timer = setInterval(() => void view.refresh(), POLL_MS);
      status.set({
        state: "watching",
        note: `Watching ${agentKeys.length} agent(s): ${channelGrants} channel grant(s), ${config.teammates.length} approved person(s).`,
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

  registerPage();
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
    /** Re-render readers after usage counters change. */
    bump() {
      value = { ...value };
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

const EMPTY_LIST = { status: "loading", channels: [] };

function useChannels(React, ctx) {
  const connection = React.useSyncExternalStore(
    (l) => ctx.relay.subscribe(l),
    () => ctx.relay.snapshot(),
  );
  const queries = connection.status === "ready" ? connection.session.channels : undefined;
  React.useEffect(() => queries?.ensureList?.(), [queries]);
  return React.useSyncExternalStore(
    React.useCallback((l) => (queries ? queries.subscribeList(l) : () => {}), [queries]),
    () => (queries ? queries.list() : EMPTY_LIST),
  );
}

/** People who can start `agent`: members of its channels plus approved people. */
function reachOf(config, agent, channels) {
  const picked = config.agents[agent.pubkey]?.channels || [];
  const people = new Set(config.teammates.map((t) => t.pubkey));
  let unknown = 0;
  for (const id of picked) {
    const channel = channels.find((c) => c.id === id);
    if (!channel?.members) unknown++;
    else for (const member of channel.members) people.add(member);
  }
  people.delete(agent.pubkey);
  if (agent.owner) people.delete(agent.owner);
  return { count: people.size, unknown };
}

const memberCount = (channel) => (channel.members ? channel.members.length : undefined);

function SettingsPage({ React, ctx, store, status, usage }) {
  const h = React.createElement;
  const config = React.useSyncExternalStore(store.subscribe, store.get);
  const state = React.useSyncExternalStore(status.subscribe, status.get);
  const agentsSnap = React.useSyncExternalStore(
    (l) => ctx.agents.subscribe(l),
    () => ctx.agents.snapshot(),
  );
  const channelList = useChannels(React, ctx);
  const [name, setName] = React.useState("");
  const [key, setKey] = React.useState("");
  const [error, setError] = React.useState("");
  const [pending, setPending] = React.useState(undefined); // { agent, channel }

  const mine = (agentsSnap.agents || []).filter((a) =>
    (agentsSnap.running || []).some((r) => r.key === a.key),
  );
  const channels = [...(channelList.channels || [])].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const setAgents = (agents) => store.set({ ...config, agents });
  const toggleAgent = (pubkey) => {
    const agents = { ...config.agents };
    if (agents[pubkey]) delete agents[pubkey];
    else agents[pubkey] = { channels: [] };
    setAgents(agents);
  };
  const setChannel = (pubkey, id, on) => {
    const current = config.agents[pubkey]?.channels || [];
    const next = on ? [...new Set([...current, id])] : current.filter((c) => c !== id);
    setAgents({ ...config.agents, [pubkey]: { channels: next } });
  };
  // Granting a big or non-private channel asks first: every member would be
  // able to spend your credits and run commands on this computer.
  const toggleChannel = (agent, channel) => {
    const on = !(config.agents[agent.pubkey]?.channels || []).includes(channel.id);
    const size = memberCount(channel);
    const risky = channel.visibility !== "private" || size === undefined || size > LARGE_REACH;
    if (on && risky) return setPending({ agent: agent.pubkey, channel: channel.id });
    setPending(undefined);
    setChannel(agent.pubkey, channel.id, on);
  };
  const addTeammate = (e) => {
    e.preventDefault();
    const pubkey = toPubkey(key);
    if (!pubkey) return setError("Paste a 64-character hex key or an npub.");
    if (config.teammates.some((t) => t.pubkey === pubkey))
      return setError("That person is already on the list.");
    store.set({ ...config, teammates: [...config.teammates, { name: name.trim(), pubkey }] });
    setName("");
    setKey("");
    setError("");
  };
  const removeTeammate = (pubkey) =>
    store.set({ ...config, teammates: config.teammates.filter((t) => t.pubkey !== pubkey) });

  const card = { padding: "var(--space-panel-inset, 16px)", marginBottom: 16 };
  const row = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 0",
    borderBottom: "1px solid var(--color-border-subtle, rgba(127,127,127,.2))",
  };
  const mono = { fontFamily: "ui-monospace, monospace", fontSize: 12, opacity: 0.7 };
  const muted = { opacity: 0.7, fontSize: 13 };
  const warn = { color: "var(--color-text-warning, #b26a00)", fontSize: 13 };
  const callout = {
    margin: "6px 0 8px 24px",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid var(--color-border-warning, rgba(178,106,0,.45))",
    background: "var(--color-surface-warning, rgba(178,106,0,.08))",
    fontSize: 13,
  };
  const pill = {
    fontSize: 12,
    padding: "2px 8px",
    borderRadius: 999,
    background: "var(--color-surface-subtle, rgba(127,127,127,.12))",
    whiteSpace: "nowrap",
  };

  const channelPicker = (agent) => {
    const picked = config.agents[agent.pubkey]?.channels || [];
    const pickedPublic = channels.filter(
      (c) => picked.includes(c.id) && c.visibility !== "private",
    );
    return h(
      "div",
      { style: { padding: "4px 0 12px 28px" } },
      h("div", { style: muted }, "Everyone in these channels can talk to it:"),
      channelList.status !== "ready" && !channels.length
        ? h("p", { style: muted }, "Loading channels…")
        : channels.map((c) =>
            h(
              "label",
              { key: c.id, style: { display: "flex", gap: 8, alignItems: "center", padding: "3px 0" } },
              h("input", {
                type: "checkbox",
                checked: picked.includes(c.id),
                onChange: () => toggleChannel(agent, c),
              }),
              h("span", null, c.visibility === "private" ? "🔒 " : "# ", c.name),
              h(
                "span",
                { style: muted },
                memberCount(c) === undefined ? "members unknown" : `${memberCount(c)} members`,
                c.visibility === "private" ? "" : c.visibility === "public" ? " · public" : " · visibility unknown",
              ),
            ),
          ),
      pending && pending.agent === agent.pubkey
        ? (() => {
            const c = channels.find((x) => x.id === pending.channel);
            if (!c) return null;
            const size = memberCount(c);
            return h(
              "div",
              { style: callout, role: "alert" },
              h(
                "p",
                { style: { margin: "0 0 8px" } },
                h("strong", null, `Give everyone in ${c.name} access to ${agent.name}?`),
                " ",
                size === undefined
                  ? "Buzz hasn't loaded this channel's member list, so you can't see how many people that is."
                  : `That's ${size} people.`,
                c.visibility === "private"
                  ? ""
                  : " This channel isn't private, so anyone in the community can join it and get access.",
                ` Each of their requests runs on this computer and uses your Claude credits (up to ${config.limitPerHour} per person per hour, ${config.dailyPerAgent} per day for ${agent.name}).`,
              ),
              h(
                "div",
                { style: { display: "flex", gap: 8 } },
                h(
                  "button",
                  {
                    type: "button",
                    onClick: () => {
                      setChannel(agent.pubkey, c.id, true);
                      setPending(undefined);
                    },
                  },
                  "Grant access",
                ),
                h("button", { type: "button", onClick: () => setPending(undefined) }, "Cancel"),
              ),
            );
          })()
        : null,
      pickedPublic.length
        ? h(
            "p",
            { style: warn },
            "Not private: anyone in the community can join and talk to this agent. Prefer private channels.",
          )
        : null,
    );
  };

  return h(
    "div",
    { style: { maxWidth: 760, margin: "0 auto", padding: 24 } },
    h("h1", null, "Teammate access"),
    h(
      "p",
      null,
      "Let other people talk to your agents by @mentioning them. Give a whole channel access, or name specific people. The agent answers in a thread under their message. It runs on this computer, as you, only while Buzz is open.",
    ),

    h(
      "section",
      { className: "ui-card", style: card },
      h("h2", null, "Status"),
      h("p", null, state.note),
      state.log.length
        ? h("pre", { style: { ...mono, whiteSpace: "pre-wrap", margin: 0 } }, state.log.join("\n"))
        : null,
    ),

    h(
      "section",
      { className: "ui-card", style: card },
      h("h2", null, "Agents"),
      h("p", { style: muted }, "Turn an agent on, then pick the channels whose members may talk to it. Only agents running on this computer are listed."),
      mine.length
        ? mine.map((agent) =>
            h(
              "div",
              { key: agent.key },
              h(
                "label",
                { style: row },
                h("input", {
                  type: "checkbox",
                  checked: Boolean(config.agents[agent.pubkey]),
                  onChange: () => toggleAgent(agent.pubkey),
                }),
                h("span", { style: { flex: 1, fontWeight: 600 } }, agent.name),
                config.agents[agent.pubkey]
                  ? (() => {
                      const reach = reachOf(config, agent, channels);
                      const big = reach.count > LARGE_REACH;
                      return h(
                        React.Fragment,
                        null,
                        h(
                          "span",
                          { style: { ...pill, ...(big ? { color: warn.color } : null) } },
                          `${reach.count}${reach.unknown ? "+" : ""} ${reach.count === 1 ? "person" : "people"} can use it`,
                        ),
                        h(
                          "span",
                          { style: pill },
                          `${usage.count(agent.pubkey)}/${config.dailyPerAgent} today`,
                        ),
                      );
                    })()
                  : h("span", { style: mono }, `${agent.pubkey.slice(0, 12)}…`),
              ),
              config.agents[agent.pubkey] ? channelPicker(agent) : null,
            ),
          )
        : h("p", { style: muted }, "No agents are running here yet."),
    ),

    h(
      "section",
      { className: "ui-card", style: card },
      h("h2", null, "Approved people"),
      h("p", { style: muted }, "Optional. These people may talk to every agent you turned on, in any channel you share with them."),
      config.teammates.length
        ? config.teammates.map((t) =>
            h(
              "div",
              { key: t.pubkey, style: row },
              h("span", { style: { flex: 1 } }, t.name || "(no name)"),
              h("span", { style: mono }, `${t.pubkey.slice(0, 12)}…`),
              h("button", { type: "button", onClick: () => removeTeammate(t.pubkey) }, "Remove"),
            ),
          )
        : null,
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
      "section",
      { className: "ui-card", style: card },
      h("h2", null, "Limits"),
      h(
        "label",
        { style: { display: "flex", gap: 8, alignItems: "center", marginBottom: 8 } },
        "Each agent answers at most",
        h("input", {
          type: "number",
          min: 1,
          max: 10000,
          value: config.dailyPerAgent,
          onChange: (e) => {
            const n = Math.round(Number(e.target.value));
            if (n >= 1 && n <= 10000) store.set({ ...config, dailyPerAgent: n });
          },
          style: { width: 80 },
        }),
        "requests a day from other people, all together.",
      ),
      h(
        "label",
        { style: { display: "flex", gap: 8, alignItems: "center" } },
        "Each person may start each agent at most",
        h("input", {
          type: "number",
          min: 1,
          max: 1000,
          value: config.limitPerHour,
          onChange: (e) => {
            const n = Math.round(Number(e.target.value));
            if (n >= 1 && n <= 1000) store.set({ ...config, limitPerHour: n });
          },
          style: { width: 70 },
        }),
        "times per hour.",
      ),
      h(
        "p",
        { style: muted },
        "These protect your Claude credits when many people have access. Your own messages to your agents never count. Counts reset when Buzz restarts.",
      ),
    ),

    h(
      "p",
      { style: { fontSize: 13, opacity: 0.75 } },
      "Anyone with access can make your agent run commands on this computer and use your account. Your agent is told not to reveal secrets, delete files, push code or change accounts for them, but that is an instruction, not a hard block. Settings are saved on this computer only.",
    ),
  );
}
