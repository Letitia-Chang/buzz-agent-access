// ---------- Agent Access runtime: watching mentions and acting on them ----------

const CHAT_KINDS = [9, 40003, 40007, 46010];
const POLL_MS = 20_000;
const LOOKBACK_S = 120;
const AWAY_MAX_S = 24 * 3600;
const BEAT_MS = 60_000;
const PAGE_TARGET = { version: 1, kind: "plugin", pluginId: core.PLUGIN_ID, pageId: "main" };

function createStore(key, read, fallback) {
  let value;
  try {
    const saved = localStorage.getItem(key) ?? localStorage.getItem(core.LEGACY_KEYS[key] || "") ?? "null";
    value = read(JSON.parse(saved));
  } catch {
    value = fallback();
  }
  const listeners = new Set();
  let timer;
  const save = () => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("[agent-access] could not save", error);
    }
  };
  return {
    get: () => value,
    set(next, { now = false } = {}) {
      value = typeof next === "function" ? next(value) : next;
      clearTimeout(timer);
      if (now) save();
      else timer = setTimeout(save, 300);
      for (const l of listeners) l();
    },
    flush: () => { clearTimeout(timer); save(); },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const emptyState = () => ({
  activity: [], requests: [], counters: {}, lastBeat: undefined, away: undefined,
  nearSent: {}, summarySent: undefined, tab: "overview", prefill: undefined, firstSeen: Date.now(),
});
function readState(raw) {
  const s = emptyState();
  if (!raw || typeof raw !== "object") return s;
  return {
    ...s,
    activity: Array.isArray(raw.activity) ? raw.activity.slice(0, 500) : [],
    requests: Array.isArray(raw.requests) ? raw.requests.slice(0, 50) : [],
    counters: raw.counters && typeof raw.counters === "object" ? raw.counters : {},
    lastBeat: Number.isFinite(raw.lastBeat) ? raw.lastBeat : undefined,
    nearSent: raw.nearSent && typeof raw.nearSent === "object" ? raw.nearSent : {},
    summarySent: typeof raw.summarySent === "string" ? raw.summarySent : undefined,
    firstSeen: Number.isFinite(raw.firstSeen) ? raw.firstSeen : Date.now(),
  };
}

/** Channel summaries from the session, whatever shape this host returns. */
function channelList(session) {
  try {
    const list = session?.channels?.list?.();
    if (Array.isArray(list)) return list;
    if (list && Array.isArray(list.channels)) return list.channels;
  } catch {}
  return [];
}
function profileName(session, pubkey) {
  try {
    const p = session?.profiles?.snapshot?.()?.get?.(pubkey);
    return p?.displayName || p?.display_name || p?.name || undefined;
  } catch {
    return undefined;
  }
}
const today = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

function createRuntime(ctx) {
  const config = createStore(core.STORAGE_KEY, (raw) => core.normalizeConfig(raw), core.emptyConfig);
  const state = createStore(core.STATE_KEY, readState, emptyState);
  const counters = core.createCounters(state.get().counters);
  const notices = () => ctx.reflect?.get?.("notices");
  const navigation = () => ctx.reflect?.get?.("navigation") || ctx.navigation;
  const guarded = ctx.agents.supportsGuardedWake === true;
  const hasInstructions = typeof ctx.agents.addInstructions === "function";
  const canWake = typeof ctx.agents.wake === "function";
  let session;
  let notifier;
  try {
    const n = ctx.reflect?.get?.("notifications") || ctx.notifications;
    notifier = n?.register?.({ id: "agent-access", label: "Agent Access" });
  } catch {}

  const notify = (sourceKey, title, body) => {
    try {
      void notifier?.submit({ sourceKey, target: PAGE_TARGET, title, body });
    } catch {}
  };
  const nameOf = (pubkey) =>
    config.get().people.find((p) => p.pubkey === pubkey)?.name || profileName(liveSession(), pubkey) || pubkey.slice(0, 8) + "…";
  const liveSession = () => session || (() => { try { const c = ctx.relay.snapshot(); return c.status === "ready" ? c.session : undefined; } catch { return undefined; } })();
  const channelById = (id) => channelList(liveSession()).find((c) => c.id === id);
  const channelName = (id) => {
    const c = channelById(id);
    return c?.name ? "#" + c.name : "a channel";
  };
  const log = (entry) => state.set((s) => ({ ...s, activity: core.addActivity(s.activity, entry) }));
  const saveCounters = () => state.set((s) => ({ ...s, counters: counters.toJSON() }));

  async function wake(agent, req) {
    const cfg = config.get();
    countUse(agent.pubkey, req.from);
    const text = `From ${req.fromName} (${req.from}):\n${req.text}` + (hasInstructions ? "" : `\n\n---\n${core.INSTRUCTIONS}`);
    const meta = { who: req.from, whoName: req.fromName, agent: agent.pubkey, channel: req.channel };
    try {
      if (guarded) {
        const result = await ctx.agents.wake(
          agent.key,
          { channel: req.channel, root: req.root, text },
          { current: () => !config.get().paused && !config.get().agents[agent.pubkey]?.paused },
        );
        if (result?.status === "delivered") log({ ...meta, result: "ok" });
        else log({ ...meta, result: "drop", detail: dropText(result?.reason) });
      } else {
        ctx.agents.wake(agent.key, { channel: req.channel, root: req.root, text });
        log({ ...meta, result: "ok" });
      }
      if (cfg.alerts.every) notify(`answer:${req.eventId}`, `${agent.name} answered ${req.fromName}`, `In ${channelName(req.channel)}`);
    } catch (error) {
      log({ ...meta, result: "drop", detail: "Couldn't start the agent" });
      console.warn("[agent-access] wake failed", error);
    }
    nearLimit(agent);
  }
  const countUse = (agentPubkey, from) => {
    core.countUse(counters, agentPubkey, from);
    saveCounters();
  };
  const dropText = (reason) =>
    ({ aborted: "Stopped", stale: "Sharing changed first", "guard-error": "Check failed", unavailable: "Agent wasn't running", refused: "Buzz refused it" })[reason] || "Not delivered";

  function nearLimit(agent) {
    const cfg = config.get();
    if (!cfg.alerts.near) return;
    const used = counters.count(`d:${agent.pubkey}`, core.DAY_MS);
    const key = `${agent.pubkey}:${today()}`;
    if (used >= Math.ceil(cfg.limits.day * 0.9) && !state.get().nearSent[key]) {
      state.set((s) => ({ ...s, nearSent: { [key]: true } }));
      notify(`near:${key}`, `${agent.name} is close to today's limit`, `${used} of ${cfg.limits.day} answers used. You can raise it in Agent Access.`);
    }
  }

  async function askToast(req, agent, kind) {
    const show = notices()?.show;
    if (!show || !config.get().alerts.toast) return false;
    const reasonText = { public: "a public channel", big: "a channel with more than 20 people", unknown: "a channel Agent Access can't check" };
    const title = kind === "access" ? `${req.fromName} asked ${agent.name}` : `${req.fromName} asked ${agent.name} in ${reasonText[kind]}`;
    const description = `${channelName(req.channel)}: “${req.text.slice(0, 140)}${req.text.length > 140 ? "…" : ""}”`;
    const actions =
      kind === "access"
        ? [{ id: "approve", label: "Give access for 1 week" }, { id: "once", label: "Answer once" }, { id: "dismiss", label: "Dismiss" }]
        : [{ id: "once", label: "Answer" }, { id: "dismiss", label: "Skip" }];
    try {
      const picked = await show({ title, description, actions });
      if (!state.get().requests.some((r) => r.eventId === req.eventId)) return true; // handled on the page first
      if (picked === "approve") await approve(req.eventId, "week");
      else if (picked === "once") await answerOnce(req.eventId);
      else if (picked === "dismiss") dismiss(req.eventId);
      return true;
    } catch {
      return false;
    }
  }

  function queue(req, agent, kind) {
    state.set((s) => ({ ...s, requests: core.addRequest(s.requests, { ...req, kind, agentName: agent.name, at: Date.now() }) }));
    if (kind !== "away") void askToast(req, agent, kind);
  }

  async function consider(event, startedAt) {
    const cfg = config.get();
    const channel = core.channelOf(event);
    if (!channel) return;
    const root = core.threadRoot(event) || event.id.toLowerCase();
    for (const pubkey of Object.keys(cfg.agents)) {
      if (!core.mentions(event, pubkey) || event.pubkey === pubkey) continue;
      const agent = ctx.agents.find(pubkey);
      if (!agent || event.pubkey === agent.owner) continue;
      const req = { eventId: event.id, from: event.pubkey, fromName: nameOf(event.pubkey), agent: pubkey, channel, root, text: String(event.content || "") };
      if (event.created_at < startedAt - 5) {
        queue(req, agent, "away");
        log({ who: req.from, whoName: req.fromName, agent: pubkey, channel, result: "away", detail: "Came in while Buzz was closed" });
        continue;
      }
      const grant = core.grantFor(cfg, pubkey, event.pubkey, channel);
      if (!grant) {
        if (cfg.paused || cfg.agents[pubkey]?.paused) {
          log({ who: req.from, whoName: req.fromName, agent: pubkey, channel, result: "held", detail: "Sharing was paused" });
          continue;
        }
        queue(req, agent, "access");
        log({ who: req.from, whoName: req.fromName, agent: pubkey, channel, result: "req", detail: "Waiting for you" });
        continue;
      }
      const hit = core.limitHit(cfg, counters, pubkey, event.pubkey);
      if (hit) {
        log({ who: req.from, whoName: req.fromName, agent: pubkey, channel, result: "held", detail: core.LIMIT_TEXT[hit] });
        continue;
      }
      const reason = grant.via === "channel" ? core.askReason(cfg, channelById(channel)) : undefined;
      if (reason) {
        queue(req, agent, reason);
        continue;
      }
      await wake(agent, req);
    }
  }

  function takeRequest(eventId) {
    const req = state.get().requests.find((r) => r.eventId === eventId);
    if (req) state.set((s) => ({ ...s, requests: s.requests.filter((r) => r.eventId !== eventId) }));
    return req;
  }
  async function approve(eventId, durationId = "week") {
    const req = takeRequest(eventId);
    if (!req) return;
    addPerson({ pubkey: req.from, name: req.fromName, agents: [req.agent], durationId });
    const agent = ctx.agents.find(req.agent);
    if (agent) await wake(agent, req);
  }
  async function answerOnce(eventId) {
    const req = takeRequest(eventId);
    const agent = req && ctx.agents.find(req.agent);
    if (agent) await wake(agent, req);
  }
  function dismiss(eventId) {
    const req = takeRequest(eventId);
    if (req) log({ who: req.from, whoName: req.fromName, agent: req.agent, channel: req.channel, result: "refused", detail: "You dismissed it" });
  }
  function addPerson({ pubkey, name, agents, durationId }) {
    const until = core.untilFor(durationId);
    config.set((c) => {
      const rest = c.people.filter((p) => p.pubkey !== pubkey);
      const old = c.people.find((p) => p.pubkey === pubkey);
      const merged = [...new Set([...(old?.agents || []), ...agents])];
      return { ...c, people: [{ pubkey, name: name || old?.name || "", agents: merged, until, added: Date.now() }, ...rest] };
    }, { now: true });
  }

  // ----- watcher -----
  function start() {
    if (!canWake) return () => {};
    let detach;
    let bound;
    const handled = new Set();
    const startedAt = Math.floor(Date.now() / 1000);
    const away = state.get().away;
    const since0 = away ? Math.max(Math.floor(away.from / 1000), startedAt - AWAY_MAX_S) : startedAt - LOOKBACK_S;

    const watch = (s) => {
      const keys = Object.keys(config.get().agents);
      if (!keys.length) return undefined;
      const view = s.observe([{ kinds: CHAT_KINDS, "#p": keys, since: since0, limit: 200 }]);
      const scan = () => {
        for (const event of view.snapshot().events) {
          if (handled.has(event.id) || !core.fromRelay(event)) continue;
          handled.add(event.id);
          if (handled.size > 3000) handled.delete(handled.values().next().value);
          if (event.created_at < since0) continue;
          if (event.created_at < startedAt - 5 && !away) continue;
          void consider(event, startedAt);
        }
      };
      const unsubscribe = view.subscribe(scan);
      scan();
      void view.refresh();
      const timer = setInterval(() => void view.refresh(), POLL_MS);
      return () => { clearInterval(timer); unsubscribe(); view.dispose(); };
    };
    const attach = () => {
      const c = ctx.relay.snapshot();
      const s = c.status === "ready" ? c.session : undefined;
      if (s === bound) return;
      detach?.();
      bound = s;
      session = s;
      detach = s ? watch(s) : undefined;
    };
    const stopRelay = ctx.relay.subscribe(attach);
    let lastKeys = Object.keys(config.get().agents).join();
    const stopConfig = config.subscribe(() => {
      const keys = Object.keys(config.get().agents).join();
      if (keys === lastKeys) return;
      lastKeys = keys;
      detach?.();
      detach = undefined;
      bound = undefined;
      attach();
    });
    attach();
    return () => { stopRelay(); stopConfig(); detach?.(); };
  }

  // ----- heartbeat, away gap and daily summary -----
  function heartbeat() {
    const gap = core.offlineGap(state.get().lastBeat);
    state.set((s) => ({ ...s, away: gap || undefined, lastBeat: Date.now() }), { now: true });
    const timer = setInterval(() => {
      state.set((s) => ({ ...s, lastBeat: Date.now() }));
      const cfg = config.get();
      const now = new Date();
      const day = today();
      if (cfg.alerts.summary && now.getHours() >= 18 && state.get().summarySent !== day) {
        const todays = state.get().activity.filter((a) => today(a.at) === day);
        state.set((s) => ({ ...s, summarySent: day }));
        if (todays.length) {
          const answered = todays.filter((a) => a.result === "ok").length;
          const people = new Set(todays.map((a) => a.who)).size;
          notify(`summary:${day}`, "Agent Access today", `${answered} answered for ${people} people. ${state.get().requests.length} waiting for you.`);
        }
      }
    }, BEAT_MS);
    return () => { clearInterval(timer); state.set((s) => ({ ...s, lastBeat: Date.now() }), { now: true }); };
  }

  // ----- channel menu: "Share an agent here…" -----
  function channelMenu(React) {
    const rows = ctx.reflect?.get?.("sidebarRows");
    if (!rows?.register) return;
    try {
      rows.register({
        version: 1,
        id: "share-here",
        menuItems: (row) =>
          row.kind === "team"
            ? [{
                id: "share-agent",
                label: "Share an agent here…",
                icon: React.createElement("span", { "aria-hidden": true }, "☕"),
                onSelect: () => {
                  state.set((s) => ({ ...s, tab: "share", prefill: row.channel?.id }));
                  void navigation()?.open?.(PAGE_TARGET);
                },
              }]
            : [],
      });
    } catch (error) {
      console.warn("[agent-access] channel menu unavailable", error);
    }
  }

  const copy = async (text) => {
    try {
      if (ctx.host?.writeClipboardText) await ctx.host.writeClipboardText(text);
      else await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  return {
    config, state, counters, guarded, canWake, hasInstructions,
    session: liveSession, channelList: () => channelList(liveSession()), nameOf, channelName,
    approve, answerOnce, dismiss, addPerson, copy, start, heartbeat, channelMenu,
    removePerson: (pubkey) => config.set((c) => ({ ...c, people: c.people.filter((p) => p.pubkey !== pubkey) }), { now: true }),
  };
}

export const inject = ["react", "pages", "relay", "agents"];

export function apply(ctx) {
  const React = ctx.react;
  const rt = createRuntime(ctx);
  if (rt.hasInstructions)
    ctx.agents.addInstructions({
      id: "agent-access",
      text: core.INSTRUCTIONS,
      when: (agent) => Boolean(rt.config.get().agents[agent.pubkey]) && !rt.config.get().paused,
    });
  ctx.effect(() => rt.heartbeat());
  ctx.effect(() => rt.start());
  ctx.effect(() => () => { rt.config.flush(); rt.state.flush(); });
  rt.channelMenu(React);
  ctx.pages.register({
    id: "main",
    title: "Agent Access",
    primary: true,
    component: function AgentAccessPage() {
      return React.createElement(App, { React, ctx, rt });
    },
  });
}
