// ---------- Agent Access page ----------
// Host colour tokens keep light and dark themes working. Three fixed accents are
// used sparingly: sky for the one important button, yellow for highlights and
// near-limit, red for things waiting on you.

const SKY = "#8ED6F0";
const INK = "#191918";
const RED = "#D93036";
const YELLOW = "#FFD84D";
const T = {
  text: "var(--text-standard)", subtle: "var(--text-subtle)", meta: "var(--text-metadata)",
  panel: "var(--surface-panel)", inset: "var(--surface-inset)", border: "var(--border-standard)",
  prominent: "var(--border-prominent)", focus: "var(--border-focus)",
  primary: "var(--affordance-prominent)", onPrimary: "var(--text-inverse)", subtleBg: "var(--affordance-subtle)",
  selected: "var(--affordance-selected)", danger: "var(--text-danger)", dangerBg: "var(--affordance-danger)",
  warn: "var(--text-warning)", warnBg: "var(--affordance-warning)", ok: "var(--text-success)", okBg: "var(--affordance-success)",
  online: "var(--status-online)", pad: "var(--space-panel-inset, 16px)",
};
const TABS = [
  ["overview", "Overview"], ["share", "Share an agent"], ["people", "People"],
  ["activity", "Activity"], ["limits", "Limits & alerts"], ["settings", "Settings"],
];
const RESULTS = {
  ok: ["Answered", T.okBg, T.ok], req: ["Asked you", "rgba(217,48,54,.12)", T.danger], held: ["Held", T.warnBg, T.warn],
  drop: ["Not delivered", T.inset, T.subtle], refused: ["Dismissed", T.inset, T.subtle], away: ["While away", T.warnBg, T.warn],
};
const AGENT_ICONS = ["☕", "🦓", "🦉", "🐙", "🦊", "🐢", "🦄", "🐝"];
const iconFor = (pubkey) => AGENT_ICONS[[...String(pubkey)].reduce((n, ch) => (Math.imul(n ^ ch.charCodeAt(0), 16777619)) >>> 0, 2166136261) % AGENT_ICONS.length];
const timeLabel = (at) => {
  const d = new Date(at);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
};
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;

function useStore(React, store) {
  return React.useSyncExternalStore(store.subscribe, store.get);
}

function App({ React, ctx, rt }) {
  const h = React.createElement;
  const config = useStore(React, rt.config);
  const state = useStore(React, rt.state);
  const agentsSnap = React.useSyncExternalStore((l) => ctx.agents.subscribe(l), () => ctx.agents.snapshot());
  const connection = React.useSyncExternalStore((l) => ctx.relay.subscribe(l), () => ctx.relay.snapshot());
  const queries = connection.status === "ready" ? connection.session.channels : undefined;
  React.useEffect(() => queries?.ensureList?.(), [queries]);
  const channelSnap = React.useSyncExternalStore(
    React.useCallback((l) => (queries?.subscribeList ? queries.subscribeList(l) : () => {}), [queries]),
    () => (queries?.list ? queries.list() : undefined),
  );
  const channels = (Array.isArray(channelSnap) ? channelSnap : channelSnap?.channels || [])
    .filter((c) => c && c.id && c.name)
    .sort((a, b) => a.name.localeCompare(b.name));
  const [toast, setToast] = React.useState("");
  const flash = (text) => { setToast(text); clearTimeout(flash.t); flash.t = setTimeout(() => setToast(""), 2600); };
  const tab = state.tab || "overview";
  const go = (id) => rt.state.set((s) => ({ ...s, tab: id }));
  const ui = ctx.reflect?.get?.("ui");

  const allAgents = agentsSnap?.agents || [];
  const runningKeys = new Set((agentsSnap?.running || []).map((r) => r.key));
  const agentList = allAgents.map((a) => {
    const support = core.supportOf(a);
    const running = runningKeys.size ? runningKeys.has(a.key) : true;
    return { ...a, support: support.ok && !running ? { ok: false, reason: "Start this agent on this computer first." } : support };
  });
  const shared = agentList.filter((a) => config.agents[a.pubkey]);
  const people = config.people.filter((p) => p.until == null || p.until > Date.now());
  const env = { React, h, ctx, rt, ui, config, state, channels, agentList, shared, people, flash, go, connection };

  if (!rt.canWake)
    return h(Page, { h }, h(Callout, { h, icon: "⬆️", tone: "warn" }, "This version of Buzz can't pass messages to agents from plugins. Update Buzz in Settings → Software updates, then reopen this page."));

  const firstRun = !Object.keys(config.agents).length;
  return h(
    Page, { h },
    h(Header, env),
    state.away && h(AwayBanner, env),
    config.paused && h(PausedBanner, env),
    h(Tabs, { ...env, tab, firstRun }),
    tab === "overview" && (firstRun ? h(FirstRun, env) : h(Overview, env)),
    tab === "share" && h(Share, env),
    tab === "people" && h(People, env),
    tab === "activity" && h(Activity, env),
    tab === "limits" && h(Limits, env),
    tab === "settings" && h(Settings, env),
    toast && h("div", { role: "status", style: { position: "sticky", bottom: 16, alignSelf: "center", padding: "10px 16px", borderRadius: 10, background: T.primary, color: T.onPrimary, fontWeight: 600, fontSize: 14, boxShadow: "0 10px 30px rgba(0,0,0,.2)" } }, toast),
  );
}

// ----- building blocks -----
function Page({ h, children }) {
  return h("div", { style: { padding: "32px clamp(16px, 4vw, 48px) 64px", color: T.text, overflowY: "auto", height: "100%", boxSizing: "border-box" } },
    h("div", { style: { maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 } }, children));
}
const btnBase = { minHeight: 36, padding: "0 14px", borderRadius: 8, font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap" };
const BTN = {
  primary: { ...btnBase, border: `1px solid ${T.primary}`, background: T.primary, color: T.onPrimary },
  quiet: { ...btnBase, border: `1px solid ${T.border}`, background: T.panel, color: T.text },
  sky: { ...btnBase, border: `1.5px solid ${INK}`, background: SKY, color: INK },
  danger: { ...btnBase, border: `1px solid ${T.danger}`, background: T.panel, color: T.danger },
};
function Btn({ h, kind = "quiet", onClick, disabled, children, label, style }) {
  return h("button", { type: "button", onClick, disabled, "aria-label": label, style: { ...BTN[kind], ...(disabled ? { opacity: 0.45, cursor: "not-allowed" } : null), ...style } }, children);
}
function Card({ h, children, style }) {
  return h("div", { style: { border: `1px solid ${T.border}`, borderRadius: 12, background: T.panel, ...style } }, children);
}
function Callout({ h, icon, tone, children }) {
  const bg = tone === "warn" ? T.warnBg : tone === "danger" ? T.dangerBg : T.inset;
  return h("div", { style: { display: "flex", gap: 12, padding: "14px 16px", borderRadius: 8, background: bg, fontSize: 14, lineHeight: 1.55 } },
    h("span", { "aria-hidden": true, style: { fontSize: 18 } }, icon), h("div", { style: { flex: 1 } }, children));
}
function H2({ h, children, badge }) {
  return h("h2", { style: { margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 10 } }, children, badge ? h(Badge, { h }, badge) : null);
}
function Badge({ h, children }) {
  return h("span", { style: { minWidth: 22, height: 22, padding: "0 7px", borderRadius: 999, background: RED, color: "#fff", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" } }, children);
}
function Chip({ h, children, bg, color }) {
  return h("span", { style: { display: "inline-flex", alignItems: "center", height: 24, padding: "0 8px", borderRadius: 6, background: bg || T.inset, color: color || T.text, fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" } }, children);
}
const Sub = ({ h, children, style }) => h("p", { style: { margin: 0, fontSize: 14, lineHeight: 1.55, color: T.subtle, ...style } }, children);
const Kicker = ({ h, children }) => h("span", { style: { fontSize: 12, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: T.meta } }, children);
function Paper({ h, art, alt, style }) {
  // Black-ink drawings sit on white paper so they read in dark mode too.
  return h("div", { style: { background: "#fff", border: `2px solid ${INK}`, borderRadius: 12, overflow: "hidden", ...style } },
    h("img", { src: ART[art], alt: alt || "", style: { display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 0" } }));
}
function Toggle({ h, ui, on, onChange, label }) {
  if (ui?.Switch) return h(ui.Switch, { checked: on, onCheckedChange: onChange, "aria-label": label });
  return h("button", { type: "button", role: "switch", "aria-checked": on, "aria-label": label, onClick: () => onChange(!on),
    style: { position: "relative", width: 40, height: 24, flex: "0 0 40px", borderRadius: 999, border: 0, cursor: "pointer", background: on ? T.primary : "#8F8A84" } },
    h("span", { style: { position: "absolute", top: 3, left: on ? 19 : 3, width: 18, height: 18, borderRadius: "50%", background: on ? SKY : "#fff", transition: "left .15s" } }));
}
function Pills({ h, options, value, onChange, label }) {
  return h("div", { role: "group", "aria-label": label, style: { display: "flex", flexWrap: "wrap", gap: 6 } },
    options.map(([id, text]) => h("button", { key: id, type: "button", "aria-pressed": value === id, onClick: () => onChange(id),
      style: { height: 32, padding: "0 12px", borderRadius: 999, font: "inherit", fontSize: 14, cursor: "pointer", border: `1px solid ${value === id ? T.primary : T.border}`, background: value === id ? T.primary : T.panel, color: value === id ? T.onPrimary : T.text } }, text)));
}
function Segmented({ h, options, value, onChange, label }) {
  return h("div", { role: "group", "aria-label": label, style: { display: "inline-flex", padding: 3, borderRadius: 8, background: T.inset } },
    options.map(([id, text]) => h("button", { key: id, type: "button", "aria-pressed": value === id, onClick: () => onChange(id),
      style: { height: 30, padding: "0 12px", borderRadius: 6, border: 0, font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", background: value === id ? "var(--surface-control-selected)" : "transparent", color: value === id ? "var(--text-control-selected)" : T.subtle, boxShadow: value === id ? "0 1px 2px rgba(0,0,0,.12)" : "none" } }, text)));
}
function Avatar({ h, name }) {
  const initials = String(name || "?").split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  return h("span", { "aria-hidden": true, style: { width: 34, height: 34, flex: "0 0 34px", borderRadius: "50%", background: "#FFF6D1", border: `2px solid ${INK}`, color: INK, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 } }, initials);
}
function Field({ h, value, onChange, placeholder, label, style }) {
  return h("input", { value, placeholder, "aria-label": label, onChange: (e) => onChange(e.target.value),
    style: { height: 38, padding: "0 12px", borderRadius: 8, border: `1px solid ${T.prominent}`, background: T.panel, color: T.text, font: "inherit", fontSize: 14, ...style } });
}
function MoreMenu({ h, React, ui, items, label }) {
  if (ui?.Menu) return h(ui.Menu, { "aria-label": label, align: "end", items: items.map((i) => ({ label: i.label, onSelect: i.onSelect, tone: i.danger ? "destructive" : undefined })) });
  const [open, setOpen] = React.useState(false);
  return h("span", { style: { position: "relative" } },
    h("button", { type: "button", "aria-label": label, "aria-expanded": open, onClick: () => setOpen(!open), style: { width: 32, height: 32, borderRadius: 6, border: 0, background: "transparent", color: T.subtle, fontSize: 20, cursor: "pointer" } }, "⋯"),
    open && h("div", { role: "menu", style: { position: "absolute", right: 0, top: 36, zIndex: 5, minWidth: 210, padding: 6, borderRadius: 10, background: "var(--surface-popover)", border: `1px solid ${T.border}`, boxShadow: "0 12px 32px rgba(0,0,0,.14)" } },
      items.map((i) => h("button", { key: i.label, type: "button", role: "menuitem", onClick: () => { setOpen(false); i.onSelect(); },
        style: { display: "block", width: "100%", textAlign: "left", padding: "8px 10px", border: 0, borderRadius: 6, background: "transparent", font: "inherit", fontSize: 14, cursor: "pointer", color: i.danger ? T.danger : T.text } }, i.label))));
}

// ----- header, banners, tabs -----
function Header({ h, rt, config, flash }) {
  const togglePause = () => { rt.config.set((c) => ({ ...c, paused: !c.paused }), { now: true }); flash(config.paused ? "Sharing is back on" : "Sharing paused. Nobody else can use your agents."); };
  return h("header", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 } },
    h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
      h("span", { "aria-hidden": true, style: { width: 30, height: 30, borderRadius: 8, background: T.inset, display: "inline-flex", alignItems: "center", justifyContent: "center" } }, "☕"),
      h("h1", { style: { margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" } }, "Agent Access")),
    h("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } },
      h("span", { style: { display: "inline-flex", alignItems: "center", gap: 8, height: 30, padding: "0 12px", borderRadius: 999, background: config.paused ? T.dangerBg : T.inset, fontSize: 13, fontWeight: 600, color: config.paused ? T.danger : T.text } },
        h("span", { style: { width: 8, height: 8, borderRadius: "50%", background: config.paused ? RED : T.online } }), config.paused ? "Paused" : "Sharing · Buzz is open"),
      h(Btn, { h, onClick: togglePause }, config.paused ? "Resume sharing" : "Pause all sharing")));
}
function AwayBanner({ h, rt, state, go }) {
  const away = state.away;
  const waiting = state.requests.filter((r) => r.kind === "away").length;
  const fmt = (t) => new Date(t).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
  return h(Callout, { h, icon: "🌙", tone: "warn" },
    h("strong", null, `Buzz was closed on this computer from ${fmt(away.from)} to ${fmt(away.to)}. `),
    "Nobody could use your agents then. ",
    waiting ? `${plural(waiting, "mention")} came in while you were away. None were answered.` : "No mentions came in.",
    h("div", { style: { display: "flex", gap: 8, marginTop: 10 } },
      waiting ? h(Btn, { h, kind: "quiet", onClick: () => go("people") }, "Review them") : null,
      h(Btn, { h, kind: "quiet", onClick: () => rt.state.set((s) => ({ ...s, away: undefined })) }, "Got it")));
}
function PausedBanner({ h, rt }) {
  return h("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, padding: "12px 18px", borderRadius: 12, background: T.dangerBg } },
    h(Paper, { h, art: "MeditatingDoodle", style: { width: 110, height: 80, borderWidth: 0 } }),
    h("div", { style: { flex: "999 1 260px" } }, h("strong", null, "Sharing is paused"), h(Sub, { h }, "Nobody else can use your agents. Mentions are held, not answered, and no credits are used.")),
    h(Btn, { h, kind: "primary", onClick: () => rt.config.set((c) => ({ ...c, paused: false }), { now: true }) }, "Resume sharing"));
}
function Tabs({ h, tab, go, state }) {
  const waiting = state.requests.length;
  return h("nav", { "aria-label": "Agent Access sections", style: { display: "flex", gap: 2, overflowX: "auto", borderBottom: `1px solid ${T.border}` } },
    TABS.map(([id, label]) => h("button", { key: id, type: "button", "aria-current": tab === id ? "page" : undefined, onClick: () => go(id),
      style: { display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 12px", border: 0, background: "transparent", font: "inherit", fontSize: 14, whiteSpace: "nowrap", cursor: "pointer", color: tab === id ? T.text : T.subtle, fontWeight: tab === id ? 700 : 500, boxShadow: tab === id ? `inset 0 -2px 0 ${T.focus}` : "none" } },
      label, id === "people" && waiting ? h(Badge, { h }, waiting) : null)));
}

// ----- overview -----
function Limitations({ h }) {
  return h(Callout, { h, icon: "💡" },
    "Works with ", h("strong", null, "Claude, Codex, Goose and Pi"), " agents running on this computer, only while Buzz is open. ",
    h("strong", null, "Shared compute and Builderlab agents aren't supported."), " Direct messages to your agent aren't passed on yet. Your agent answers with your account and credits.");
}
function FirstRun({ h, go }) {
  return h(React_Fragment, { h },
    h("section", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "24px 40px" } },
      h("div", { style: { flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 14 } },
        h(Kicker, { h }, "Welcome"),
        h("p", { style: { margin: 0, fontSize: 38, lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.035em" } }, "Let ", h("span", { style: { background: `linear-gradient(transparent 70%, ${YELLOW} 70%, ${YELLOW} 95%, transparent 95%)` } }, "your team"), " ask your agents."),
        h(Sub, { h, style: { fontSize: 16 } }, "Pick an agent, pick who can ask, set a few limits. Teammates @mention it in Buzz and it answers in a thread, here on your computer, as you."),
        h("div", null, h(Btn, { h, kind: "sky", onClick: () => go("share"), style: { minHeight: 42, fontSize: 15 } }, "Share your first agent"))),
      h(Paper, { h, art: "UnboxingDoodle", alt: "Someone opening a box", style: { flex: "1 1 260px", maxWidth: 340, aspectRatio: "4 / 3", border: 0 } })),
    h(Limitations, { h }));
}
const React_Fragment = ({ children }) => children;

function Requests({ h, rt, state, flash, compact, config }) {
  const reqs = state.requests;
  if (!reqs.length) return null;
  const where = { away: " while you were away", public: " in a public channel", big: " in a big channel", unknown: " in a channel it can't check" };
  return h("section", { "aria-label": "Waiting for you", style: { display: "flex", flexDirection: "column", gap: 10 } },
    h(H2, { h, badge: reqs.length }, "Waiting for you"),
    !compact && h(Sub, { h }, config.paused ? "Sharing is paused. Resume it to answer these." : "Nothing has run for these, and no credits were used."),
    reqs.map((r) => h(Card, { h, key: r.eventId, style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 14px", padding: "12px 14px" } },
      h(Avatar, { h, name: r.fromName }),
      h("div", { style: { flex: "999 1 260px", minWidth: 0 } },
        h("p", { style: { margin: 0, fontSize: 14 } }, h("strong", null, r.fromName), " asked ", h("strong", null, r.agentName), where[r.kind] || "", h("span", { style: { color: T.subtle } }, ` · ${rt.channelName(r.channel)} · ${timeLabel(r.at)}`)),
        h("p", { style: { margin: "3px 0 0", fontSize: 14, color: T.subtle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, `“${r.text}”`)),
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
        r.kind === "access" || r.kind === "away"
          ? h(Btn, { h, kind: "sky", disabled: config.paused, onClick: async () => { await rt.approve(r.eventId, "week"); flash(`${r.fromName} can ask ${r.agentName} for 1 week. Answering now.`); } }, "Approve and answer")
          : null,
        h(Btn, { h, kind: r.kind === "access" || r.kind === "away" ? "quiet" : "sky", disabled: config.paused, onClick: async () => { await rt.answerOnce(r.eventId); flash(`Answering ${r.fromName} once`); } }, r.kind === "access" || r.kind === "away" ? "Answer once" : "Answer"),
        h(Btn, { h, onClick: () => { rt.dismiss(r.eventId); flash("Dismissed"); } }, "Dismiss")))));
}

function Overview(env) {
  const { h, React, rt, config, state, shared, people, flash, go, ui } = env;
  const [period, setPeriod] = React.useState("today");
  const now = Date.now();
  const windowMs = period === "today" ? core.DAY_MS : 7 * core.DAY_MS;
  const recent = state.activity.filter((a) => now - a.at < windowMs);
  const answered = recent.filter((a) => a.result === "ok").length;
  const held = recent.filter((a) => a.result === "held").length;
  const cap = period === "today" ? config.limits.total : config.limits.total * 7;
  const near = answered / cap >= 0.8;
  const askers = new Set(people.map((p) => p.pubkey));
  for (const a of shared) for (const id of config.agents[a.pubkey].channels) for (const m of env.channels.find((c) => c.id === id)?.members || []) askers.add(m);
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return h(React_Fragment, { h },
    h("section", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "20px 36px" } },
      h("div", { style: { flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 } },
        h(Kicker, { h }, "Overview"),
        h("p", { style: { margin: 0, fontSize: 34, lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.03em" } }, `${hello}.`),
        h(Sub, { h, style: { fontSize: 16 } }, `${plural(shared.length, "agent")} shared with ${plural(askers.size, "person", "people")}. `, state.requests.length ? h("strong", { style: { color: T.text } }, `${plural(state.requests.length, "request")} waiting for you.`) : "Nothing is waiting for you."),
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: 10 } },
          h(Btn, { h, kind: "primary", onClick: () => go("share") }, "＋ Share an agent"))),
      h("div", { "aria-hidden": true, style: { flex: "1 1 280px", maxWidth: 400, position: "relative", aspectRatio: "520 / 380" } },
        h(Paper, { h, art: "p_device", style: { position: "absolute", left: 0, top: "12%", width: "42%", aspectRatio: "1", transform: "rotate(-5deg)" } }),
        h(Paper, { h, art: "p_coffee", style: { position: "absolute", right: 0, top: "6%", width: "52%", aspectRatio: "1 / 1.05", transform: "rotate(3deg)" } }),
        h("span", { style: { position: "absolute", left: "12%", bottom: "2%", padding: "8px 14px", borderRadius: "12px 12px 4px 12px", background: INK, color: "#fff", fontSize: 13, fontWeight: 600, transform: "rotate(-2deg)", boxShadow: `4px 4px 0 ${SKY}`, whiteSpace: "nowrap" } }, `${shared[0] ? iconFor(shared[0].pubkey) + " " + shared[0].name : "☕ Your agent"}: here's the answer`))),
    h(Limitations, { h }),
    h(Requests, env),
    h("section", { "aria-label": "Usage", style: { display: "flex", flexDirection: "column", gap: 14 } },
      h("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 } },
        h(H2, { h }, "Usage"), h(Segmented, { h, label: "Period", value: period, onChange: setPeriod, options: [["today", "Today"], ["week", "This week"]] })),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 } },
        h(Stat, { h, label: "Requests answered", value: answered, of: cap, meter: answered / cap, near, note: near ? `Close to ${period === "today" ? "today's" : "this week's"} limit` : "Plenty left" }),
        h(Stat, { h, label: "People who can ask", value: askers.size, note: `${plural(people.length, "person", "people")} added by you` }),
        h(Stat, { h, label: "Held by a limit", value: held, note: "Nothing ran for these" }))),
    h(SharedAgents, env));
}
function Stat({ h, label, value, of, meter, near, note }) {
  return h(Card, { h, style: { padding: 18, display: "flex", flexDirection: "column", gap: 10 } },
    h("span", { style: { fontSize: 14, color: T.subtle } }, label),
    h("span", { style: { fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, fontVariantNumeric: "tabular-nums" } }, value, of != null ? h("span", { style: { fontSize: 18, fontWeight: 600, color: T.meta } }, ` / ${of}`) : null),
    meter != null && h("div", { role: "img", "aria-label": `${value} of ${of} used`, style: { height: 8, borderRadius: 999, background: T.inset, overflow: "hidden" } },
      h("div", { style: { height: "100%", width: `${Math.min(100, Math.round(meter * 100))}%`, background: near ? YELLOW : T.primary, borderRadius: 999 } })),
    h("span", { style: { fontSize: 13, color: near ? T.warn : T.subtle, fontWeight: near ? 600 : 400 } }, note));
}
function SharedAgents({ h, React, rt, ui, config, shared, channels, people, flash, go }) {
  if (!shared.length) return null;
  const today = (pk) => rt.counters.count(`d:${pk}`, core.DAY_MS);
  return h("section", { "aria-label": "Shared agents", style: { display: "flex", flexDirection: "column", gap: 12 } },
    h(H2, { h }, "Shared agents"),
    h(Card, { h, style: { overflow: "hidden" } },
      shared.map((a, i) => {
        const cfg = config.agents[a.pubkey];
        const used = today(a.pubkey);
        const nearDay = used / config.limits.day >= 0.8;
        const off = config.paused || cfg.paused;
        const chans = cfg.channels.map((id) => "#" + (channels.find((c) => c.id === id)?.name || "channel"));
        const names = people.filter((p) => p.agents.includes(a.pubkey)).map((p) => p.name || "Someone");
        const status = off ? ["Paused", T.inset, T.subtle] : nearDay ? ["Near limit", T.warnBg, T.warn] : ["Sharing", T.okBg, T.ok];
        return h("div", { key: a.pubkey, style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 16px", padding: "12px 14px", borderTop: i ? `1px solid ${T.border}` : 0 } },
          h("span", { style: { display: "flex", alignItems: "center", gap: 10, flex: "1 1 180px", minWidth: 0 } },
            h("span", { "aria-hidden": true, style: { width: 34, height: 34, borderRadius: 8, background: T.inset, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18 } }, iconFor(a.pubkey)),
            h("span", null, h("strong", { style: { display: "block" } }, a.name), h("span", { style: { fontSize: 12, color: T.subtle } }, "This computer"))),
          h("span", { style: { display: "flex", flexWrap: "wrap", gap: 6, flex: "2 1 220px" } }, [...chans, ...names].slice(0, 5).map((c) => h(Chip, { h, key: c }, c)), chans.length + names.length > 5 ? h(Chip, { h }, `+${chans.length + names.length - 5}`) : null, !chans.length && !names.length ? h(Sub, { h }, "Nobody yet") : null),
          h("span", { style: { fontSize: 14, fontVariantNumeric: "tabular-nums", flex: "0 0 auto" } }, `${used} / ${config.limits.day} today`),
          h(Chip, { h, bg: status[1], color: status[2] }, status[0]),
          h(MoreMenu, { h, React, ui, label: `More actions for ${a.name}`, items: [
            { label: "Edit who can ask", onSelect: () => { rt.state.set((s) => ({ ...s, tab: "share", prefillAgent: a.pubkey })); } },
            { label: "Change limits", onSelect: () => go("limits") },
            { label: cfg.paused ? "Resume this agent" : "Pause this agent", onSelect: () => rt.config.set((c) => ({ ...c, agents: { ...c.agents, [a.pubkey]: { ...c.agents[a.pubkey], paused: !cfg.paused } } }), { now: true }) },
            { label: "Copy how-to", onSelect: async () => flash((await rt.copy(core.howTo(a.name, config.limits))) ? "How-to copied. Paste it in your channel." : "Couldn't copy") },
            { label: "Stop sharing", danger: true, onSelect: () => { rt.config.set((c) => { const agents = { ...c.agents }; delete agents[a.pubkey]; return { ...c, agents, people: c.people.map((p) => ({ ...p, agents: p.agents.filter((k) => k !== a.pubkey) })) }; }, { now: true }); flash(`${a.name} is no longer shared`); } },
          ] }));
      })));
}

// ----- share wizard -----
function Share(env) {
  const { h, React, rt, config, state, channels, agentList, flash, go } = env;
  const [step, setStep] = React.useState(1);
  const [picked, setPicked] = React.useState(state.prefillAgent || agentList.find((a) => a.support.ok)?.pubkey);
  const pickedAgent = agentList.find((a) => a.pubkey === picked);
  const startChannels = config.agents[picked]?.channels || [];
  const [chosen, setChosen] = React.useState(() => new Set([...(startChannels || []), ...(state.prefill ? [state.prefill] : [])]));
  const [added, setAdded] = React.useState([]);
  const [query, setQuery] = React.useState("");
  const [dur, setDur] = React.useState("week");
  const [confirmed, setConfirmed] = React.useState(false);
  const [done, setDone] = React.useState(false);
  React.useEffect(() => { if (state.prefill || state.prefillAgent) rt.state.set((s) => ({ ...s, prefill: undefined, prefillAgent: undefined })); }, []);
  React.useEffect(() => { setChosen(new Set(config.agents[picked]?.channels || [])); }, [picked]);

  const risky = channels.filter((c) => chosen.has(c.id) && core.askReason({ ask: { public: true, big: true, unknown: true } }, c));
  const needsConfirm = risky.length > 0 && !confirmed;
  const reach = new Set(added.map((p) => p.pubkey));
  for (const id of chosen) for (const m of channels.find((c) => c.id === id)?.members || []) reach.add(m);
  const candidates = React.useMemo(() => {
    const s = rt.session();
    const seen = new Map();
    for (const c of channels) for (const m of c.members || []) if (!seen.has(m)) seen.set(m, rt.nameOf(m));
    return [...seen].map(([pubkey, name]) => ({ pubkey, name })).filter((c) => !c.name.endsWith("…"));
  }, [channels]);
  const q = query.trim().toLowerCase();
  const asKey = core.toPubkey(query);
  const matches = q ? candidates.filter((c) => c.name.toLowerCase().includes(q) && !added.some((a) => a.pubkey === c.pubkey)).slice(0, 5) : [];
  if (asKey && !matches.some((m) => m.pubkey === asKey)) matches.unshift({ pubkey: asKey, name: rt.nameOf(asKey) });

  const titles = ["Which agent?", "Who can ask it?", "Set some limits", "Check and share"];
  const helps = ["Only agents running on this computer can be shared.", "Pick channels, add people one by one, or both.", "Mentions over a limit are held, not answered. You can change these any time.", "Nothing is shared until you press the button."];
  const canNext = step === 1 ? Boolean(pickedAgent?.support.ok) : step === 2 ? (chosen.size > 0 || added.length > 0) && !needsConfirm : true;
  const finish = () => {
    rt.config.set((c) => ({ ...c, agents: { ...c.agents, [picked]: { channels: [...chosen], paused: false } } }), { now: true });
    for (const p of added) rt.addPerson({ pubkey: p.pubkey, name: p.name, agents: [picked], durationId: p.dur });
    setDone(true);
  };

  if (done)
    return h("section", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px 28px", padding: "18px 22px", borderRadius: 12, background: "var(--surface-categorical-blue)" } },
      h(Paper, { h, art: "SelfieDoodle", style: { width: 120, height: 100, border: 0 } }),
      h("div", { style: { flex: "999 1 260px" } }, h("p", { style: { margin: 0, fontSize: 18, fontWeight: 700 } }, `${pickedAgent.name} is shared.`), h(Sub, { h }, "Post a short how-to so people know they can ask it.")),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
        h(Btn, { h, kind: "primary", onClick: async () => flash((await rt.copy(core.howTo(pickedAgent.name, config.limits))) ? "How-to copied" : "Couldn't copy") }, "Copy how-to"),
        h(Btn, { h, onClick: () => go("overview") }, "Back to overview")));

  return h("section", { style: { display: "flex", flexDirection: "column", gap: 22 } },
    h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, h(Kicker, { h }, "Share an agent"), h("p", { style: { margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em" } }, titles[step - 1]), h(Sub, { h }, helps[step - 1])),
    h("ol", { "aria-label": "Steps", style: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 8 } },
      ["Agent", "Who can ask", "Limits", "Review"].map((l, i) => {
        const n = i + 1, on = step === n, past = step > n;
        return h("li", { key: l, "aria-current": on ? "step" : undefined, style: { display: "inline-flex", alignItems: "center", gap: 8, height: 32, padding: "0 12px 0 5px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: on ? T.primary : T.inset, color: on ? T.onPrimary : T.text } },
          h("span", { style: { width: 22, height: 22, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: on ? SKY : past ? T.okBg : T.panel, color: INK, fontSize: 12 } }, past ? "✓" : n), l);
      })),
    step === 1 && h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 } },
      agentList.length ? agentList.map((a) => {
        const on = picked === a.pubkey;
        return h("button", { key: a.pubkey, type: "button", disabled: !a.support.ok, "aria-pressed": on, onClick: () => setPicked(a.pubkey),
          style: { display: "flex", flexDirection: "column", gap: 8, padding: 16, textAlign: "left", borderRadius: 12, font: "inherit", color: T.text, cursor: a.support.ok ? "pointer" : "not-allowed", background: a.support.ok ? T.panel : T.inset, border: on ? `2px solid ${T.focus}` : `1px solid ${T.border}`, opacity: a.support.ok ? 1 : 0.8 } },
          h("span", { style: { display: "flex", alignItems: "center", gap: 10 } },
            h("span", { "aria-hidden": true, style: { width: 34, height: 34, borderRadius: 8, background: T.inset, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18 } }, iconFor(a.pubkey)),
            h("strong", null, a.name), on ? h("span", { style: { marginLeft: "auto", width: 22, height: 22, borderRadius: "50%", background: SKY, color: INK, border: `1.5px solid ${INK}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 } }, "✓") : null),
          h("span", { style: { fontSize: 13, lineHeight: 1.45, color: a.support.ok ? T.subtle : T.danger } }, a.support.ok ? (config.agents[a.pubkey] ? "Already shared. Change who can ask." : "Ready to share") : a.support.reason));
      }) : h(Sub, { h }, "You have no agents in this community yet. Create one in Agents first.")),
    step === 2 && h("div", { style: { display: "flex", flexDirection: "column", gap: 22 } },
      h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
        h(H2, { h }, "Channels"), h(Sub, { h }, "Anyone in a channel you pick can ask. Buzz checks who's in it, so people who leave lose access."),
        h(Card, { h, style: { overflow: "hidden" } },
          channels.length ? channels.map((c, i) => {
            const reason = core.askReason({ ask: { public: true, big: true, unknown: true } }, c);
            const n = c.members?.length;
            return h("label", { key: c.id, style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 12px", padding: "11px 14px", borderTop: i ? `1px solid ${T.border}` : 0, cursor: "pointer" } },
              h("input", { type: "checkbox", checked: chosen.has(c.id), onChange: () => { const next = new Set(chosen); next.has(c.id) ? next.delete(c.id) : next.add(c.id); setChosen(next); setConfirmed(false); }, style: { width: 18, height: 18 } }),
              h("strong", { style: { fontSize: 14 } }, "#" + c.name),
              h("span", { style: { fontSize: 13, color: T.subtle } }, `${n != null ? plural(n, "member") : "Members unknown"} · ${c.visibility === "public" ? "Public" : c.visibility === "private" ? "Private" : "Visibility unknown"}`),
              reason === "public" ? h(Chip, { h, bg: T.dangerBg, color: T.danger }, "Public · anyone can join") : reason === "big" ? h(Chip, { h, bg: T.warnBg, color: T.warn }, `Over ${core.BIG_CHANNEL} people`) : reason === "unknown" ? h(Chip, { h, bg: T.warnBg, color: T.warn }, "Can't check members") : null);
          }) : h("div", { style: { padding: 14 } }, h(Sub, { h }, "Loading your channels…"))),
        risky.length > 0 && h("div", { role: "alert", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 14px", padding: "12px 14px", borderRadius: 10, background: T.dangerBg } },
          h("span", { "aria-hidden": true }, "⚠️"),
          h("p", { style: { margin: 0, flex: "999 1 280px", fontSize: 14, lineHeight: 1.5 } }, h("strong", null, risky.map((c) => "#" + c.name).join(", ")), " could let many people, or people you don't know, use your account and credits. ", pickedAgent?.name, " will ask you before answering there."),
          h("label", { style: { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 } }, h("input", { type: "checkbox", checked: confirmed, onChange: () => setConfirmed(!confirmed), style: { width: 18, height: 18 } }), "I understand"))),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
        h(H2, { h }, "People, one by one"), h(Sub, { h }, "For someone who isn't in those channels. Their access ends on its own."),
        added.length ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } }, added.map((p) => h(Chip, { h, key: p.pubkey }, `${p.name} · ${core.DURATIONS.find((d) => d.id === p.dur).label}`, h("button", { type: "button", "aria-label": `Remove ${p.name}`, onClick: () => setAdded(added.filter((x) => x.pubkey !== p.pubkey)), style: { border: 0, background: "none", cursor: "pointer", color: T.subtle, marginLeft: 4 } }, "✕")))) : null,
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" } },
          h(Field, { h, value: query, onChange: setQuery, label: "Search people", placeholder: "Search by name, or paste an npub", style: { flex: "1 1 240px" } }),
          h(Pills, { h, label: "How long", value: dur, onChange: setDur, options: core.DURATIONS.map((d) => [d.id, d.label]) })),
        matches.length ? h(Card, { h, style: { padding: 4 } }, matches.map((m) => h("button", { key: m.pubkey, type: "button", onClick: () => { setAdded([...added, { ...m, dur }]); setQuery(""); },
          style: { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "6px 10px", border: 0, borderRadius: 6, background: "transparent", font: "inherit", fontSize: 14, color: T.text, cursor: "pointer", textAlign: "left" } },
          h(Avatar, { h, name: m.name }), m.name, h("span", { style: { marginLeft: "auto", color: T.subtle, fontSize: 13 } }, `Add for ${core.DURATIONS.find((d) => d.id === dur).label.toLowerCase()}`)))) : null)),
    step === 3 && h(LimitFields, env),
    step === 4 && h(Card, { h, style: { padding: 20, display: "flex", flexDirection: "column", gap: 12 } },
      h("p", { style: { margin: 0, fontSize: 18, fontWeight: 700 } }, `${iconFor(picked)} ${pickedAgent?.name}`),
      h("p", { style: { margin: 0, fontSize: 15 } }, h("strong", null, "Who: "), [...[...chosen].map((id) => "#" + (channels.find((c) => c.id === id)?.name || "channel")), ...added.map((p) => `${p.name} (${core.DURATIONS.find((d) => d.id === p.dur).label})`)].join(", ") || "Nobody yet"),
      h("p", { style: { margin: 0, fontSize: 15 } }, h("strong", null, "Limits: "), `${config.limits.hour} an hour per person · ${config.limits.day} a day for this agent · ${config.limits.total} a day in total`),
      h("p", { style: { margin: 0, fontSize: 15 } }, h("strong", null, "Asks you first: "), [config.ask.public && "public channels", config.ask.big && `channels over ${core.BIG_CHANNEL} people`, config.ask.unknown && "channels it can't check"].filter(Boolean).join(", ") || "never"),
      h("p", { style: { margin: 0, padding: "10px 12px", borderRadius: 8, background: T.inset, fontSize: 14 } }, "Reach: ", h("strong", null, plural(reach.size, "person", "people")), ` will be able to ask ${pickedAgent?.name}.`)),
    h("div", { style: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` } },
      h(Btn, { h, onClick: () => (step > 1 ? setStep(step - 1) : go("overview")) }, step > 1 ? "← Back" : "Cancel"),
      h(Btn, { h, kind: "sky", disabled: !canNext, onClick: () => (step < 4 ? setStep(step + 1) : finish()) }, step < 4 ? "Next →" : "Start sharing")));
}

function LimitFields({ h, rt, config }) {
  const defs = [["hour", "Per person, each hour", "How many questions one person can ask", 1], ["day", "Per agent, each day", "Answers each agent gives in a day", 5], ["total", "All agents, each day", "Your total across every agent", 10]];
  const set = (k, v) => rt.config.set((c) => ({ ...c, limits: { ...c.limits, [k]: Math.max(1, v) } }), { now: true });
  return h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 } },
    defs.map(([k, label, help, step]) => h(Card, { h, key: k, style: { padding: 16, display: "flex", flexDirection: "column", gap: 8 } },
      h("strong", null, label), h(Sub, { h }, help),
      h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
        h(Btn, { h, label: `Lower ${label}`, onClick: () => set(k, config.limits[k] - step), style: { width: 36, padding: 0 } }, "−"),
        h("span", { "aria-live": "polite", style: { minWidth: 56, textAlign: "center", fontSize: 26, fontWeight: 800, fontVariantNumeric: "tabular-nums" } }, config.limits[k]),
        h(Btn, { h, label: `Raise ${label}`, onClick: () => set(k, config.limits[k] + step), style: { width: 36, padding: 0 } }, "＋")))));
}

// ----- people -----
function People(env) {
  const { h, React, rt, config, people, channels, shared, flash } = env;
  const [query, setQuery] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [pick, setPick] = React.useState(null);
  const [agents, setAgents] = React.useState(() => new Set(shared.slice(0, 1).map((a) => a.pubkey)));
  const [dur, setDur] = React.useState("week");
  const [addQuery, setAddQuery] = React.useState("");
  const viaChannel = [];
  for (const a of shared) for (const id of config.agents[a.pubkey].channels) {
    const c = channels.find((x) => x.id === id);
    for (const m of c?.members || []) if (m !== a.owner && !people.some((p) => p.pubkey === m)) viaChannel.push({ pubkey: m, channel: c.name, agent: a });
  }
  const byMember = new Map();
  for (const v of viaChannel) {
    const e = byMember.get(v.pubkey) || { pubkey: v.pubkey, channels: new Set(), agents: new Set() };
    e.channels.add(v.channel); e.agents.add(v.agent.pubkey); byMember.set(v.pubkey, e);
  }
  const rows = [
    ...people.map((p) => ({ pubkey: p.pubkey, name: p.name || rt.nameOf(p.pubkey), how: "Added by you", agents: p.agents, ends: core.endsLabel(p.until), manual: true })),
    ...[...byMember.values()].map((e) => ({ pubkey: e.pubkey, name: rt.nameOf(e.pubkey), how: [...e.channels].map((c) => "#" + c).join(", "), agents: [...e.agents], ends: "While in the channel", manual: false })),
  ].filter((r) => !query || r.name.toLowerCase().includes(query.toLowerCase()));
  const candidates = [];
  const seen = new Set();
  for (const c of channels) for (const m of c.members || []) if (!seen.has(m)) { seen.add(m); const name = rt.nameOf(m); if (!name.endsWith("…")) candidates.push({ pubkey: m, name }); }
  const aq = addQuery.trim().toLowerCase();
  const key = core.toPubkey(addQuery);
  const options = (aq ? candidates.filter((c) => c.name.toLowerCase().includes(aq)) : candidates).slice(0, 8);
  if (key && !options.some((o) => o.pubkey === key)) options.unshift({ pubkey: key, name: rt.nameOf(key) });
  const give = () => {
    if (!pick || !agents.size) return;
    rt.addPerson({ pubkey: pick.pubkey, name: pick.name, agents: [...agents], durationId: dur });
    flash(`${pick.name} can ask now`);
    setAdding(false); setPick(null); setAddQuery("");
  };
  return h("section", { style: { display: "flex", flexDirection: "column", gap: 24 } },
    h("div", { style: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 12 } },
      h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, h(Kicker, { h }, "People"), h("p", { style: { margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em" } }, "Who can ask your agents")),
      h(Btn, { h, kind: "primary", disabled: !shared.length, onClick: () => setAdding(!adding) }, "＋ Add a person")),
    adding && h(Card, { h, style: { padding: 18, display: "flex", flexDirection: "column", gap: 14, borderColor: T.focus } },
      h(H2, { h }, "Add a person"),
      h(Field, { h, value: addQuery, onChange: setAddQuery, label: "Search by name", placeholder: "Search by name, or paste an npub" }),
      h(Pills, { h, label: "Person", value: pick?.pubkey, onChange: (pk) => setPick(options.find((o) => o.pubkey === pk)), options: options.map((o) => [o.pubkey, o.name]) }),
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" } }, h("strong", { style: { fontSize: 14 } }, "Agents"),
        shared.map((a) => h("label", { key: a.pubkey, style: { display: "inline-flex", gap: 6, fontSize: 14, alignItems: "center" } }, h("input", { type: "checkbox", checked: agents.has(a.pubkey), onChange: () => { const n = new Set(agents); n.has(a.pubkey) ? n.delete(a.pubkey) : n.add(a.pubkey); setAgents(n); } }), `${iconFor(a.pubkey)} ${a.name}`))),
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" } }, h("strong", { style: { fontSize: 14 } }, "For"), h(Pills, { h, label: "How long", value: dur, onChange: setDur, options: core.DURATIONS.map((d) => [d.id, d.label]) })),
      h("div", null, h(Btn, { h, kind: "sky", disabled: !pick || !agents.size, onClick: give }, pick ? `Give ${pick.name} access` : "Pick someone first"))),
    h(Requests, env),
    h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
      h("div", { style: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 } },
        h(H2, { h }, `Has access · ${rows.length}`),
        h(Field, { h, value: query, onChange: setQuery, label: "Search names", placeholder: "Search names", style: { width: 220 } })),
      h(Card, { h, style: { overflow: "hidden" } },
        rows.length ? rows.map((r, i) => h("div", { key: r.pubkey, style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 16px", padding: "10px 14px", borderTop: i ? `1px solid ${T.border}` : 0 } },
          h("span", { style: { display: "flex", alignItems: "center", gap: 10, flex: "1 1 180px", minWidth: 0 } }, h(Avatar, { h, name: r.name }), h("strong", null, r.name)),
          h("span", { style: { flex: "1 1 160px" } }, h(Chip, { h }, r.how)),
          h("span", { style: { flex: "0 0 auto", fontSize: 16 } }, r.agents.map(iconFor).join(" ")),
          h("span", { style: { flex: "0 0 130px", fontSize: 14, color: r.ends === "Today" || r.ends === "Tomorrow" ? T.danger : T.text, fontWeight: r.ends === "Today" || r.ends === "Tomorrow" ? 600 : 400 } }, r.ends),
          r.manual ? h(Btn, { h, onClick: () => { rt.removePerson(r.pubkey); flash(`${r.name} no longer has access`); }, style: { minHeight: 30 } }, "Remove") : h("span", { style: { fontSize: 12, color: T.meta } }, "Ends when they leave")))
          : h("div", { style: { padding: 18, textAlign: "center" } }, h(Sub, { h }, query ? `Nobody matches “${query}”.` : "Nobody can ask yet. Share an agent with a channel, or add someone.")))));
}

// ----- activity -----
function Activity({ h, React, rt, state }) {
  const [filter, setFilter] = React.useState("all");
  const keys = [["all", "All"], ["ok", "Answered"], ["held", "Held"], ["req", "Asked you"], ["drop", "Not delivered"], ["away", "While away"]];
  const rows = state.activity.filter((a) => filter === "all" || a.result === filter).slice(0, 200);
  return h("section", { style: { display: "flex", flexDirection: "column", gap: 18 } },
    h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, h(Kicker, { h }, "Activity"), h("p", { style: { margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em" } }, "What your agents did")),
    h(Callout, { h, icon: "🔒" }, "Only who, which agent, where and when are kept here, on this computer, for 30 days. ", h("strong", null, "What people asked stays in Buzz"), ", in the thread."),
    h(Pills, { h, label: "Filter", value: filter, onChange: setFilter, options: keys.map(([k, l]) => [k, `${l} · ${k === "all" ? state.activity.length : state.activity.filter((a) => a.result === k).length}`]) }),
    h(Card, { h, style: { overflow: "hidden" } },
      rows.length ? rows.map((a, i) => {
        const [label, bg, color] = RESULTS[a.result] || RESULTS.drop;
        return h("div", { key: a.at + ":" + i, style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 16px", padding: "10px 14px", borderTop: i ? `1px solid ${T.border}` : 0, fontSize: 14 } },
          h("span", { style: { flex: "0 0 80px", color: T.subtle, fontVariantNumeric: "tabular-nums" } }, timeLabel(a.at)),
          h("strong", { style: { flex: "1 1 140px" } }, a.whoName || rt.nameOf(a.who)),
          h("span", { style: { flex: "0 0 auto" } }, iconFor(a.agent)),
          h("span", { style: { flex: "1 1 140px" } }, h(Chip, { h }, rt.channelName(a.channel))),
          h("span", { style: { flex: "1 1 170px" } }, h(Chip, { h, bg, color }, label), a.detail ? h("span", { style: { display: "block", marginTop: 2, fontSize: 12, color: T.meta } }, a.detail) : null));
      }) : h("div", { style: { padding: 30, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" } },
        h(Paper, { h, art: "LayingDoodle", style: { width: 200, height: 130, border: 0 } }), h(Sub, { h }, "Nothing yet. When someone asks one of your agents, it shows up here."))));
}

// ----- limits & alerts -----
function Limits(env) {
  const { h, rt, config, ui } = env;
  const setGroup = (group, k, v) => rt.config.set((c) => ({ ...c, [group]: { ...c[group], [k]: v } }), { now: true });
  const rows = (group, defs) => defs.map(([k, label, help]) => h("div", { key: k, style: { display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderTop: `1px solid ${T.border}` } },
    h("div", { style: { flex: 1 } }, h("p", { style: { margin: 0, fontSize: 15, fontWeight: 600 } }, label), h(Sub, { h, style: { marginTop: 2 } }, help)),
    h(Toggle, { h, ui, on: config[group][k], onChange: (v) => setGroup(group, k, v), label })));
  return h("section", { style: { display: "flex", flexDirection: "column", gap: 26 } },
    h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, h(Kicker, { h }, "Limits & alerts"), h("p", { style: { margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em" } }, "Keep it safe, keep it quiet")),
    h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } }, h(H2, { h }, "Limits"), h(LimitFields, env),
      h(Callout, { h, icon: "⏳", tone: "warn" }, "When a limit is reached, mentions are ", h("strong", null, "held, not answered"), ". You can see them in Activity.")),
    h("div", null, h(H2, { h }, "Ask me first"), h("div", { style: { height: 8 } }), rows("ask", [
      ["public", "Public channels", "Anyone can join them, so you check each question first."],
      ["big", `Channels with more than ${core.BIG_CHANNEL} people`, "Bigger rooms, more chances of surprise."],
      ["unknown", "Channels Agent Access can't check", "If it can't see who's in a channel, it asks you."]])),
    h("div", null, h(H2, { h }, "Alerts"), h("div", { style: { height: 8 } }), rows("alerts", [
      ["toast", "Someone asks for access", "A notice in Buzz with Give access, Answer once and Dismiss."],
      ["near", "An agent is close to a limit", "At most once a day per agent."],
      ["summary", "Daily summary after 6 pm", "Who asked which agent, in one notification."],
      ["every", "Every answer", "Off by default. It gets noisy."]])));
}

// ----- settings -----
function Settings({ h, React, rt, flash, config }) {
  const exportCsv = async () => {
    const rows = [["time", "who", "agent", "channel", "result", "detail"], ...rt.state.get().activity.map((a) => [new Date(a.at).toISOString(), a.whoName || a.who, a.agent, rt.channelName(a.channel), a.result, a.detail || ""])];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    flash((await rt.copy(csv)) ? "Activity copied as CSV. Paste it into a sheet." : "Couldn't copy");
  };
  const [confirmStop, setConfirmStop] = React.useState(false);
  return h("section", { style: { display: "flex", flexDirection: "column", gap: 18 } },
    h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, h(Kicker, { h }, "Settings"), h("p", { style: { margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em" } }, "Settings")),
    h(Card, { h, style: { padding: 18, display: "flex", flexDirection: "column", gap: 8 } },
      h(H2, { h }, "Version"),
      h("p", { style: { margin: 0, fontSize: 15 } }, "Agent Access ", h("strong", null, VERSION), rt.guarded ? " · uses Buzz's checked delivery" : " · basic delivery on this Buzz"),
      h(Sub, { h }, "Updates install with Buzz's plugin updates. Settings and activity stay on this computer.")),
    h(Card, { h, style: { padding: 18, display: "flex", flexDirection: "column", gap: 10 } },
      h(H2, { h }, "Which agents can be shared"),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 } },
        h("div", { style: { padding: 12, borderRadius: 8, background: T.okBg, color: T.ok } }, h("strong", null, "✓ Supported"), h("p", { style: { margin: "4px 0 0", fontSize: 14 } }, "Claude, Codex, Goose and Pi agents running on this computer")),
        h("div", { style: { padding: 12, borderRadius: 8, background: T.inset } }, h("strong", null, "✕ Not supported"), h("p", { style: { margin: "4px 0 0", fontSize: 14, color: T.subtle } }, "Shared compute and Builderlab agents. They run somewhere else, so this plugin can't reach them.")))),
    h(Card, { h, style: { padding: 18, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" } },
      h("div", { style: { flex: "999 1 240px" } }, h(H2, { h }, "Your data"), h(Sub, { h }, "Activity is metadata only, kept 30 days.")),
      h(Btn, { h, onClick: exportCsv }, "Copy activity as CSV"),
      h(Btn, { h, onClick: () => { rt.state.set((s) => ({ ...s, activity: [] }), { now: true }); flash("Activity cleared"); } }, "Clear activity")),
    h(Card, { h, style: { padding: 18, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", borderColor: T.danger } },
      h("div", { style: { flex: "999 1 260px" } }, h(H2, { h }, "Stop sharing everything"), h(Sub, { h }, "Removes all channels and people. Your agents go back to answering only you.")),
      confirmStop
        ? h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
            h(Btn, { h, kind: "danger", onClick: () => { rt.config.set((c) => ({ ...c, agents: {}, people: [] }), { now: true }); setConfirmStop(false); flash("Stopped sharing everything"); } }, "Yes, stop everything"),
            h(Btn, { h, onClick: () => setConfirmStop(false) }, "Keep sharing"))
        : h(Btn, { h, kind: "danger", onClick: () => setConfirmStop(true) }, "Stop sharing everything")));
}
