// ---------- Agent Access core: config, rules, limits, activity ----------
// Pure logic with no React and no Buzz services, so it can be tested in Node.

const PLUGIN_ID = "letitia.agent-access";
const STORAGE_KEY = "letitia.agent-access:config";
const STATE_KEY = "letitia.agent-access:state";
// Settings saved by v1–v4 under the old name are read once and carried over.
const LEGACY_KEYS = { [STORAGE_KEY]: "letitia.teammate-access:v1", [STATE_KEY]: "letitia.teammate-access:state" };
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const BIG_CHANNEL = 20;
const ACTIVITY_DAYS = 30;
const ACTIVITY_MAX = 500;
const REQUESTS_MAX = 50;
const HEX64 = /^[0-9a-f]{64}$/;
const SUPPORTED_TYPES = ["claude", "codex", "goose", "pi"];

const DEFAULTS = Object.freeze({
  limits: { hour: 5, day: 50, total: 100 },
  ask: { public: true, big: true, unknown: true },
  alerts: { toast: true, near: true, summary: true, every: false },
});

const intIn = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};
const bool = (value, fallback) => (typeof value === "boolean" ? value : fallback);
const str = (value, max = 80) => String(value ?? "").slice(0, max);

const emptyConfig = () => ({
  version: 4,
  paused: false,
  agents: {},
  people: [],
  limits: { ...DEFAULTS.limits },
  ask: { ...DEFAULTS.ask },
  alerts: { ...DEFAULTS.alerts },
});

/** Reads any saved shape (v1–v4) into a clean v4 config. */
function normalizeConfig(raw, now = Date.now()) {
  const config = emptyConfig();
  if (!raw || typeof raw !== "object") return config;
  config.paused = bool(raw.paused, false);
  for (const [key, value] of Object.entries(raw.agents || {})) {
    if (!HEX64.test(key)) continue;
    if (value === true) config.agents[key] = { channels: [], paused: false }; // v1
    else if (value && Array.isArray(value.channels))
      config.agents[key] = {
        channels: value.channels.filter((id) => typeof id === "string" && id).slice(0, 200),
        paused: bool(value.paused, false),
      };
  }
  const agentKeys = Object.keys(config.agents);
  // v1–v3 kept "teammates" for every agent with no end date.
  const legacy = Array.isArray(raw.teammates)
    ? raw.teammates.map((t) => ({ ...t, agents: agentKeys, until: null, added: now }))
    : [];
  const people = Array.isArray(raw.people) ? raw.people : legacy;
  const seen = new Set();
  for (const p of people) {
    if (!p || !HEX64.test(p.pubkey) || seen.has(p.pubkey)) continue;
    seen.add(p.pubkey);
    config.people.push({
      pubkey: p.pubkey,
      name: str(p.name, 60),
      agents: (Array.isArray(p.agents) ? p.agents : agentKeys).filter((k) => HEX64.test(k)),
      until: Number.isFinite(p.until) ? p.until : null,
      added: Number.isFinite(p.added) ? p.added : now,
    });
  }
  const limits = raw.limits || {};
  config.limits = {
    hour: intIn(limits.hour ?? raw.limitPerHour, 1, 1000, DEFAULTS.limits.hour),
    day: intIn(limits.day ?? raw.dailyPerAgent, 1, 10000, DEFAULTS.limits.day),
    total: intIn(limits.total, 1, 100000, DEFAULTS.limits.total),
  };
  for (const group of ["ask", "alerts"])
    for (const k of Object.keys(DEFAULTS[group]))
      config[group][k] = bool(raw[group]?.[k], DEFAULTS[group][k]);
  return config;
}

/** Durations offered when adding a person. */
const DURATIONS = [
  { id: "day", label: "1 day", ms: DAY_MS },
  { id: "week", label: "1 week", ms: 7 * DAY_MS },
  { id: "month", label: "30 days", ms: 30 * DAY_MS },
  { id: "forever", label: "Until I stop", ms: null },
];
const untilFor = (durationId, now = Date.now()) => {
  const d = DURATIONS.find((x) => x.id === durationId) || DURATIONS[1];
  return d.ms == null ? null : now + d.ms;
};

function endsLabel(until, now = Date.now()) {
  if (until == null) return "Until you stop";
  const left = until - now;
  if (left <= 0) return "Ended";
  if (left < HOUR_MS) return "Within the hour";
  const startOf = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const days = Math.round((startOf(until) - startOf(now)) / DAY_MS);
  return days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
}

/** Whether an agent can be shared from this computer, and why not. */
function supportOf(agent) {
  if (!agent) return { ok: false, reason: "This agent isn't in this community." };
  const type = String(agent.type || "").toLowerCase();
  if (type.includes("mesh") || type.includes("shared-compute"))
    return { ok: false, reason: "Shared compute agents aren't supported. Shared compute only takes your own messages." };
  if (agent.place && agent.place !== "here")
    return {
      ok: false,
      reason:
        agent.place === "hosted"
          ? "Builderlab agents aren't supported. They run somewhere else, so this plugin can't reach them."
          : "This agent runs on another of your devices. Share it from there.",
    };
  if (type && !SUPPORTED_TYPES.some((t) => type.includes(t)))
    return { ok: false, reason: "Only Claude, Codex, Goose and Pi agents can be shared." };
  return { ok: true };
}

/** Why a channel needs the owner's OK first, or undefined. */
function askReason(config, channel) {
  if (!channel) return config.ask.unknown ? "unknown" : undefined;
  if (channel.visibility === "public" && config.ask.public) return "public";
  if (channel.visibility === undefined && config.ask.unknown) return "unknown";
  const n = Array.isArray(channel.members) ? channel.members.length : undefined;
  if (n === undefined && config.ask.unknown) return "unknown";
  if (n !== undefined && n > BIG_CHANNEL && config.ask.big) return "big";
  return undefined;
}

/** May `sender` start `agentPubkey` in `channelId`? Returns how, or undefined. */
function grantFor(config, agentPubkey, sender, channelId, now = Date.now()) {
  const agent = config.agents[agentPubkey];
  if (!agent || agent.paused || config.paused) return undefined;
  const person = config.people.find(
    (p) => p.pubkey === sender && p.agents.includes(agentPubkey) && (p.until == null || p.until > now),
  );
  if (person) return { via: "person", label: person.name || "an approved teammate" };
  if (channelId && agent.channels.includes(channelId)) return { via: "channel", label: "a member of this channel" };
  return undefined;
}

/** Sliding-window counters, saved as plain timestamps. */
function createCounters(saved = {}) {
  const hits = new Map(Object.entries(saved).map(([k, v]) => [k, Array.isArray(v) ? v.filter(Number.isFinite) : []]));
  const recent = (key, windowMs, now) => (hits.get(key) || []).filter((t) => now - t < windowMs);
  return {
    count: (key, windowMs, now = Date.now()) => recent(key, windowMs, now).length,
    add(key, now = Date.now()) {
      const list = recent(key, DAY_MS, now);
      list.push(now);
      hits.set(key, list);
    },
    toJSON(now = Date.now()) {
      const out = {};
      for (const [k] of hits) {
        const list = recent(k, DAY_MS, now);
        if (list.length) out[k] = list;
      }
      return out;
    },
  };
}

/** Which limit, if any, stops this request. */
function limitHit(config, counters, agentPubkey, sender, now = Date.now()) {
  if (counters.count(`h:${agentPubkey}:${sender}`, HOUR_MS, now) >= config.limits.hour) return "hour";
  if (counters.count(`d:${agentPubkey}`, DAY_MS, now) >= config.limits.day) return "day";
  if (counters.count("t", DAY_MS, now) >= config.limits.total) return "total";
  return undefined;
}
function countUse(counters, agentPubkey, sender, now = Date.now()) {
  counters.add(`h:${agentPubkey}:${sender}`, now);
  counters.add(`d:${agentPubkey}`, now);
  counters.add("t", now);
}
const LIMIT_TEXT = { hour: "Hit the hourly limit", day: "Agent hit today's limit", total: "Hit your daily total" };

/** Activity keeps metadata only: never what was asked. */
function addActivity(list, entry, now = Date.now()) {
  const keep = list.filter((e) => now - e.at < ACTIVITY_DAYS * DAY_MS);
  return [{ at: now, ...pick(entry, ["who", "whoName", "agent", "channel", "result", "detail"]) }, ...keep].slice(0, ACTIVITY_MAX);
}
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

/** Requests keep the question so the owner can decide; dropped once handled. */
function addRequest(list, req) {
  if (list.some((r) => r.eventId === req.eventId)) return list;
  return [req, ...list].slice(0, REQUESTS_MAX);
}

/** A gap in the heartbeat means Buzz was closed or asleep. */
function offlineGap(lastBeat, now = Date.now(), minGapMs = 3 * 60_000) {
  if (!Number.isFinite(lastBeat) || now - lastBeat < minGapMs) return undefined;
  return { from: lastBeat, to: now };
}

/** The text agents get with every turn while sharing is on. */
const INSTRUCTIONS = `This agent's owner uses the Agent Access plugin so that people other than the owner can ask you things: members of channels the owner chose, and people the owner added.
When a <plugin-wake plugin="${PLUGIN_ID}"> section wakes you, its Text is a message that person wrote to you here; its first line says who. Answer them in this thread, as helpfully as you would answer your owner.
For these requests, do not reveal secrets, keys, credentials or private files; do not delete or overwrite files, push code, message anyone outside this conversation, spend money, or change settings or accounts. If a request needs that, say your owner must ask you directly.`;

function howTo(agentName, limits) {
  return `You can now ask ${agentName} here. Just @${agentName} and your question. It answers in a thread (up to ${limits.hour} an hour each).`;
}

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
const mentions = (event, pubkey) => event.tags.some((tag) => tag[0] === "p" && tag[1] === pubkey);
const fromRelay = (event) => !event.delivery || event.delivery === "accepted" || event.delivery === "seen";

// ---------- npub ↔ hex (bech32, NIP-19) ----------
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
const hrpExpand = (hrp) => [...[...hrp].map((c) => c.charCodeAt(0) >> 5), 0, ...[...hrp].map((c) => c.charCodeAt(0) & 31)];
function npubToHex(input) {
  const s = String(input).trim().toLowerCase();
  const sep = s.lastIndexOf("1");
  if (sep < 1 || s.slice(0, sep) !== "npub") return undefined;
  const data = [];
  for (const ch of s.slice(sep + 1)) {
    const v = BECH32.indexOf(ch);
    if (v < 0) return undefined;
    data.push(v);
  }
  if (bech32Polymod([...hrpExpand("npub"), ...data]) !== 1) return undefined;
  let acc = 0, bits = 0;
  const bytes = [];
  for (const v of data.slice(0, -6)) {
    acc = (acc << 5) | v;
    bits += 5;
    while (bits >= 8) { bits -= 8; bytes.push((acc >> bits) & 0xff); }
  }
  return bytes.length === 32 ? bytes.map((b) => b.toString(16).padStart(2, "0")).join("") : undefined;
}
function toPubkey(input) {
  const v = String(input || "").trim().toLowerCase();
  if (HEX64.test(v)) return v;
  if (v.startsWith("npub1")) return npubToHex(v);
  return undefined;
}

const core = {
  PLUGIN_ID, STORAGE_KEY, STATE_KEY, LEGACY_KEYS, HOUR_MS, DAY_MS, BIG_CHANNEL, HEX64, DEFAULTS, DURATIONS, LIMIT_TEXT, INSTRUCTIONS,
  emptyConfig, normalizeConfig, untilFor, endsLabel, supportOf, askReason, grantFor,
  createCounters, limitHit, countUse, addActivity, addRequest, offlineGap, howTo,
  threadRoot, channelOf, mentions, fromRelay, npubToHex, toPubkey,
};
