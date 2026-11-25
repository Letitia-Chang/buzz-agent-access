// ---------- Agent Access page: design A ----------
// A beige page with rounded cream cards, two-tone titles and mono {001} tags.
// Colours live in CSS variables on the page root, with a light (beige) and a dark
// (espresso) set that follow Buzz's theme. Accents use the "Ink & clay" palette:
// navy ink, sage teal, ochre and clay, all low-saturation so the plugins match.

const SKY = "var(--aa-accent)"; // navy: important buttons and selected states
const INK = "#1E2533";
const RED = "var(--aa-clay)";
const YELLOW = "var(--aa-highlight)";
const AMBER = "var(--aa-ochre)";
const ON_ACCENT = "var(--aa-on-accent)";
const PALETTES = {
  light: {
    "--aa-page": "#D8D4C3", "--aa-card": "#E6E3D8", "--aa-tile": "#F4F2EA", "--aa-chip": "#D8D4C3",
    "--aa-ink": "#1E2533", "--aa-grey": "#7A7869", "--aa-muted": "#55534C", "--aa-meta": "#5E5B52",
    "--aa-line": "rgba(30,37,51,.12)", "--aa-line-strong": "rgba(30,37,51,.32)", "--aa-primary": "#1E2533", "--aa-on-primary": "#F4F2EA",
    "--aa-accent": "#24324A", "--aa-on-accent": "#F4F2EA", "--aa-ochre": "#B89B5E", "--aa-clay": "#9A5641", "--aa-on-clay": "#FFFFFF", "--aa-highlight": "#E3D3AE",
    "--aa-ok": "#355E5F", "--aa-ok-bg": "#D5E0DC", "--aa-warn": "#6E5424", "--aa-warn-bg": "#EBE0C6",
    "--aa-danger": "#8E4733", "--aa-danger-bg": "#F0DAD0", "--aa-online": "#5F8A8B", "--aa-focus": "#24324A",
  },
  dark: {
    "--aa-page": "#171613", "--aa-card": "#22211D", "--aa-tile": "#2C2A25", "--aa-chip": "#3A3833",
    "--aa-ink": "#F2EFE6", "--aa-grey": "#9B9787", "--aa-muted": "#C2BEAF", "--aa-meta": "#A9A595",
    "--aa-line": "rgba(242,239,230,.12)", "--aa-line-strong": "rgba(242,239,230,.3)", "--aa-primary": "#F2EFE6", "--aa-on-primary": "#1B1B1A",
    "--aa-accent": "#A9B9D3", "--aa-on-accent": "#1A2233", "--aa-ochre": "#C7AD74", "--aa-clay": "#C77A62", "--aa-on-clay": "#1F1512", "--aa-highlight": "#5A4A2C",
    "--aa-ok": "#8DB8B9", "--aa-ok-bg": "#22382F", "--aa-warn": "#D9C08A", "--aa-warn-bg": "#3A3020",
    "--aa-danger": "#E09A84", "--aa-danger-bg": "#3D2420", "--aa-online": "#7FA9AA", "--aa-focus": "#A9B9D3",
  },
};
const T = {
  page: "var(--aa-page)", card: "var(--aa-card)", tile: "var(--aa-tile)", chip: "var(--aa-chip)",
  text: "var(--aa-ink)", grey: "var(--aa-grey)", subtle: "var(--aa-muted)", meta: "var(--aa-meta)",
  border: "var(--aa-line)", prominent: "var(--aa-line-strong)", focus: "var(--aa-focus)",
  primary: "var(--aa-primary)", onPrimary: "var(--aa-on-primary)",
  ok: "var(--aa-ok)", okBg: "var(--aa-ok-bg)", warn: "var(--aa-warn)", warnBg: "var(--aa-warn-bg)",
  danger: "var(--aa-danger)", dangerBg: "var(--aa-danger-bg)", online: "var(--aa-online)",
};
const FONT = "'Inter Tight', Inter, -apple-system, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const TABS = [
  ["overview", "Overview"], ["share", "Share"], ["people", "People"],
  ["activity", "Activity"], ["limits", "Limits"], ["settings", "Settings"],
];
const RESULTS = {
  ok: ["Answered", "ok"], req: ["Asked you", "danger"], held: ["Held", "warn"],
  drop: ["Not delivered", "meta"], refused: ["Dismissed", "meta"], away: ["While away", "warn"],
};
// Each agent gets a letter mark in one of the palette's colours, chosen from its key.
const MARK_COLOURS = [["#24324A", "#F4F2EA"], ["#5F8A8B", "#F4F2EA"], ["#B89B5E", "#1E2533"], ["#9A5641", "#F4F2EA"], ["#7C6F86", "#F4F2EA"]];
const hashOf = (s) => [...String(s)].reduce((n, ch) => Math.imul(n ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);
const tag = (n) => `{${String(n).padStart(3, "0")}}`;
const timeLabel = (at) => {
  const d = new Date(at);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase() : d.toLocaleDateString([], { month: "short", day: "numeric" });
};
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const toneColor = (tone) => ({ ok: [T.okBg, T.ok], warn: [T.warnBg, T.warn], danger: [T.dangerBg, T.danger], meta: [T.chip, T.subtle] })[tone] || [T.chip, T.text];

function useStore(React, store) {
  return React.useSyncExternalStore(store.subscribe, store.get);
}
/** Follows Buzz's light/dark theme (the `dark` class on <html>), else the OS. */
function useDark(React) {
  const read = () => {
    const el = typeof document !== "undefined" ? document.documentElement : undefined;
    if (el?.classList.contains("dark")) return true;
    if (el?.classList.contains("light")) return false;
    return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  };
  const [dark, setDark] = React.useState(read);
  React.useEffect(() => {
    if (typeof MutationObserver !== "function") return;
    const obs = new MutationObserver(() => setDark(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function App({ React, ctx, rt }) {
  const h = React.createElement;
  const dark = useDark(React);
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

  const runningKeys = new Set((agentsSnap?.running || []).map((r) => r.key));
  const agentList = (agentsSnap?.agents || []).map((a) => {
    const support = core.supportOf(a);
    const running = runningKeys.size ? runningKeys.has(a.key) : true;
    return { ...a, support: support.ok && !running ? { ok: false, reason: "Start this agent on this computer first." } : support };
  });
  const shared = agentList.filter((a) => config.agents[a.pubkey]);
  const people = config.people.filter((p) => p.until == null || p.until > Date.now());
  const agentName = (k) => agentList.find((a) => a.pubkey === k)?.name || rt.nameOf(k);
  const env = { React, h, ctx, rt, ui, config, state, channels, agentList, shared, people, flash, go, connection, agentName };
  const palette = PALETTES[dark ? "dark" : "light"];

  if (!rt.canWake)
    return h(Page, { h, palette }, h(Callout, { h, icon: "circle-arrow-up", tone: "warn" }, "This version of Buzz can't pass messages to agents from plugins. Update Buzz in Settings → Software updates, then reopen this page."));

  const firstRun = !Object.keys(config.agents).length;
  return h(Page, { h, palette },
    h(Header, env),
    state.away && h(AwayBanner, env),
    config.paused && h(PausedBanner, env),
    h(Tabs, { ...env, tab }),
    tab === "overview" && (firstRun ? h(FirstRun, env) : h(Overview, env)),
    tab === "share" && h(Share, env),
    tab === "people" && h(People, env),
    tab === "activity" && h(Activity, env),
    tab === "limits" && h(Limits, env),
    tab === "settings" && h(Settings, env),
    toast && h("div", { role: "status", style: { position: "sticky", bottom: 16, alignSelf: "center", padding: "10px 18px", borderRadius: 999, background: T.primary, color: T.onPrimary, fontWeight: 600, fontSize: 14, boxShadow: "0 10px 30px rgba(0,0,0,.25)" } }, toast));
}

// ----- building blocks -----
function Page({ h, palette, children }) {
  return h("div", { style: { ...palette, background: T.page, color: T.text, fontFamily: FONT, padding: "36px clamp(16px, 4vw, 44px) 64px", minHeight: "100%", overflowY: "auto", height: "100%", boxSizing: "border-box" } },
    h("div", { style: { maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 } }, children));
}
const btnBase = { minHeight: 38, padding: "0 16px", borderRadius: 999, font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap" };
const BTN = {
  primary: { ...btnBase, border: `1px solid ${T.primary}`, background: T.primary, color: T.onPrimary },
  quiet: { ...btnBase, border: `1px solid ${T.prominent}`, background: "transparent", color: T.text },
  sky: { ...btnBase, border: `1px solid ${SKY}`, background: SKY, color: ON_ACCENT },
  danger: { ...btnBase, border: `1px solid ${T.danger}`, background: "transparent", color: T.danger },
};
function Btn({ h, kind = "quiet", onClick, disabled, children, label, style }) {
  return h("button", { type: "button", onClick, disabled, "aria-label": label, style: { ...BTN[kind], ...(disabled ? { opacity: 0.45, cursor: "not-allowed" } : null), ...style } }, children);
}
/** The big rounded section card from design A. */
function Card({ h, children, style }) {
  return h("section", { style: { background: T.card, borderRadius: 26, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16, ...style } }, children);
}
/** The lighter tile inside a card. */
function Tile({ h, children, style }) {
  return h("div", { style: { background: T.tile, borderRadius: 16, padding: "14px 16px", ...style } }, children);
}
/** Two-tone card title, e.g. "Usage / all agents", with an optional {001} tag. */
function Title({ h, children, sub, n, right }) {
  return h("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 } },
    h("h2", { style: { margin: 0, fontSize: 22, lineHeight: 1.1, fontWeight: 700, letterSpacing: "-0.02em" } }, children, sub ? h("span", { style: { display: "block", color: T.grey } }, sub) : null),
    h("span", { style: { display: "inline-flex", alignItems: "center", gap: 10 } }, right || null, n ? h("span", { style: { fontFamily: MONO, fontSize: 12, color: T.meta } }, tag(n)) : null));
}
function Callout({ h, icon, tone, children }) {
  const bg = tone === "warn" ? T.warnBg : tone === "danger" ? T.dangerBg : T.tile;
  return h("div", { style: { display: "flex", gap: 12, padding: "14px 16px", borderRadius: 16, background: bg, fontSize: 14, lineHeight: 1.55 } },
    h(Icon, { h, name: icon, size: 18, style: { marginTop: 2, color: tone === "warn" ? T.warn : tone === "danger" ? T.danger : T.subtle } }), h("div", { style: { flex: 1 } }, children));
}
function Badge({ h, children }) {
  return h("span", { style: { minWidth: 22, height: 22, padding: "0 7px", borderRadius: 999, background: RED, color: "var(--aa-on-clay)", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" } }, children);
}
function Chip({ h, children, tone }) {
  const [bg, color] = toneColor(tone);
  return h("span", { style: { display: "inline-flex", alignItems: "center", gap: 6, height: 26, padding: "0 10px", borderRadius: 999, background: bg, color, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" } }, children);
}
const Dot = ({ h, color }) => h("span", { "aria-hidden": true, style: { width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flex: "0 0 8px" } });
const Sub = ({ h, children, style }) => h("p", { style: { margin: 0, fontSize: 14, lineHeight: 1.55, color: T.subtle, ...style } }, children);
const Mono = ({ h, children, style }) => h("span", { style: { fontFamily: MONO, fontSize: 12, color: T.meta, ...style } }, children);
function Paper({ h, art, alt, style }) {
  // Black-ink drawings on paper, so they read in dark mode too.
  return h("div", { style: { background: "#F4F2EA", borderRadius: 16, overflow: "hidden", ...style } },
    h("img", { src: ART[art], alt: alt || "", style: { display: "block", width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 100%" } }));
}
function Toggle({ h, ui, on, onChange, label }) {
  if (ui?.Switch) return h(ui.Switch, { checked: on, onCheckedChange: onChange, "aria-label": label });
  return h("button", { type: "button", role: "switch", "aria-checked": on, "aria-label": label, onClick: () => onChange(!on),
    style: { position: "relative", width: 42, height: 24, flex: "0 0 42px", borderRadius: 999, border: 0, cursor: "pointer", background: on ? SKY : "#8F8A7C" } },
    h("span", { style: { position: "absolute", top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#F4F2EA", transition: "left .15s" } }));
}
function Pills({ h, options, value, onChange, label }) {
  return h("div", { role: "group", "aria-label": label, style: { display: "flex", flexWrap: "wrap", gap: 8 } },
    options.map(([id, text]) => h("button", { key: id, type: "button", "aria-pressed": value === id, onClick: () => onChange(id),
      style: { height: 36, padding: "0 16px", borderRadius: 999, font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", border: `1px solid ${value === id ? T.primary : T.prominent}`, background: value === id ? T.primary : "transparent", color: value === id ? T.onPrimary : T.text } }, text)));
}
function Segmented({ h, options, value, onChange, label }) {
  return h("div", { role: "group", "aria-label": label, style: { display: "inline-flex", padding: 4, borderRadius: 999, background: T.tile } },
    options.map(([id, text]) => h("button", { key: id, type: "button", "aria-pressed": value === id, onClick: () => onChange(id),
      style: { height: 34, padding: "0 18px", borderRadius: 999, border: 0, font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", background: value === id ? T.primary : "transparent", color: value === id ? T.onPrimary : T.text } }, text)));
}
function Avatar({ h, name }) {
  const initials = String(name || "?").split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  return h("span", { "aria-hidden": true, style: { width: 34, height: 34, flex: "0 0 34px", borderRadius: "50%", background: T.chip, color: T.text, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 } }, initials);
}
function Icon({ h, name, size, style }) {
  return svgIcon(h, name, { size, style });
}
function AgentMark({ h, pubkey, name, size = 22 }) {
  const [bg, fg] = MARK_COLOURS[hashOf(pubkey) % MARK_COLOURS.length];
  return h("span", { "aria-hidden": true, style: { width: size, height: size, flex: `0 0 ${size}px`, borderRadius: Math.round(size * 0.32), background: bg, color: fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.48), fontWeight: 700, letterSpacing: 0, lineHeight: 1 } }, String(name || "?").trim().charAt(0).toUpperCase());
}
function Field({ h, value, onChange, placeholder, label, style }) {
  return h("input", { value, placeholder, "aria-label": label, onChange: (e) => onChange(e.target.value),
    style: { height: 40, padding: "0 16px", borderRadius: 999, border: `1px solid ${T.prominent}`, background: T.tile, color: T.text, font: "inherit", fontSize: 14, ...style } });
}
function Meter({ h, value, of, label }) {
  const pct = of ? Math.min(100, Math.round((value / of) * 100)) : 0;
  return h("div", { role: "img", "aria-label": label || `${value} of ${of} used`, style: { height: 8, borderRadius: 999, background: T.tile, overflow: "hidden" } },
    h("div", { style: { height: "100%", width: `${pct}%`, background: pct >= 80 ? AMBER : T.primary, borderRadius: 999 } }));
}
function MoreMenu({ h, React, ui, items, label }) {
  if (ui?.Menu) return h(ui.Menu, { "aria-label": label, align: "end", items: items.map((i) => ({ label: i.label, onSelect: i.onSelect, tone: i.danger ? "destructive" : undefined })) });
  const [open, setOpen] = React.useState(false);
  return h("span", { style: { position: "relative" } },
    h("button", { type: "button", "aria-label": label, "aria-expanded": open, onClick: () => setOpen(!open), style: { width: 38, height: 38, borderRadius: 999, border: `1px solid ${T.prominent}`, background: "transparent", color: T.text, fontSize: 18, cursor: "pointer" } }, "⋯"),
    open && h("div", { role: "menu", style: { position: "absolute", right: 0, bottom: 44, zIndex: 5, minWidth: 210, padding: 6, borderRadius: 16, background: T.tile, border: `1px solid ${T.border}`, boxShadow: "0 12px 32px rgba(0,0,0,.18)" } },
      items.map((i) => h("button", { key: i.label, type: "button", role: "menuitem", onClick: () => { setOpen(false); i.onSelect(); },
        style: { display: "block", width: "100%", textAlign: "left", padding: "9px 12px", border: 0, borderRadius: 10, background: "transparent", font: "inherit", fontSize: 14, cursor: "pointer", color: i.danger ? T.danger : T.text } }, i.label))));
}
const Fragment = ({ children }) => children;

// ----- header, banners, tabs -----
function Header({ h, rt, config, flash }) {
  const togglePause = () => { rt.config.set((c) => ({ ...c, paused: !c.paused }), { now: true }); flash(config.paused ? "Sharing is back on" : "Sharing paused. Nobody else can use your agents."); };
  return h("header", { style: { display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16, paddingBottom: 6 } },
    h("div", null,
      h("span", { style: { fontSize: 13, color: T.subtle } }, "Buzz plugin"),
      h("h1", { style: { margin: "4px 0 10px", fontSize: "clamp(40px, 7vw, 60px)", lineHeight: 0.92, fontWeight: 800, letterSpacing: "-0.045em" } }, "Agent", h("span", { style: { display: "block", color: T.grey } }, "Access")),
      h("span", { style: { fontSize: 13, color: T.subtle } }, "Your agents run on this computer, while Buzz is open")),
    h("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
      h("span", { role: "status", style: { display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 14px", borderRadius: 999, background: config.paused ? T.dangerBg : T.card, fontSize: 13, fontWeight: 600, color: config.paused ? T.danger : T.text } },
        h(Dot, { h, color: config.paused ? RED : T.online }), config.paused ? "Paused" : "Sharing"),
      h(Btn, { h, onClick: togglePause }, config.paused ? "Resume sharing" : "Pause all sharing")));
}
function AwayBanner({ h, rt, state, go }) {
  const away = state.away;
  const waiting = state.requests.filter((r) => r.kind === "away").length;
  const fmt = (t) => new Date(t).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
  return h(Callout, { h, icon: "moon", tone: "warn" },
    h("strong", null, `Buzz was closed on this computer from ${fmt(away.from)} to ${fmt(away.to)}. `),
    "Nobody could use your agents then. ",
    waiting ? `${plural(waiting, "mention")} came in while you were away. None were answered.` : "No mentions came in.",
    h("div", { style: { display: "flex", gap: 8, marginTop: 10 } },
      waiting ? h(Btn, { h, kind: "primary", onClick: () => go("people") }, "Review them") : null,
      h(Btn, { h, onClick: () => rt.state.set((s) => ({ ...s, away: undefined })) }, "Got it")));
}
function PausedBanner({ h, rt }) {
  return h(Card, { h, style: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 18, background: T.dangerBg } },
    h(Paper, { h, art: "MeditatingDoodle", style: { width: 120, height: 86 } }),
    h("div", { style: { flex: "999 1 260px" } }, h("strong", { style: { fontSize: 17 } }, "Sharing is paused"), h(Sub, { h }, "Nobody else can use your agents. Mentions are held, not answered, and no credits are used.")),
    h(Btn, { h, kind: "primary", onClick: () => rt.config.set((c) => ({ ...c, paused: false }), { now: true }) }, "Resume sharing"));
}
function Tabs({ h, tab, go, state }) {
  const waiting = state.requests.length;
  return h("nav", { "aria-label": "Agent Access sections", style: { display: "flex", gap: 4, padding: 5, borderRadius: 999, background: T.card, alignSelf: "flex-start", maxWidth: "100%", overflowX: "auto" } },
    TABS.map(([id, label]) => {
      const on = tab === id;
      return h("button", { key: id, type: "button", "aria-current": on ? "page" : undefined, onClick: () => go(id),
        style: { display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 16px", border: 0, borderRadius: 999, font: "inherit", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer", background: on ? T.primary : "transparent", color: on ? T.onPrimary : T.text } },
        label,
        id === "people" && waiting ? h(Badge, { h }, waiting) : null,
        id === "activity" && state.activity.length ? h(Mono, { h, style: { color: "inherit", opacity: 0.75 } }, tag(Math.min(state.activity.length, 999))) : null);
    }));
}

// ----- overview -----
function Limitations({ h }) {
  return h(Callout, { h, icon: "lightbulb" },
    "Works with ", h("strong", null, "Claude, Codex, Goose and Pi"), " agents running on this computer, only while Buzz is open. ",
    h("strong", null, "Shared compute and Builderlab agents aren't supported."), " Direct messages to your agent aren't passed on yet. Your agent answers with your account and credits.");
}
function FirstRun({ h, go }) {
  return h(Fragment, null,
    h(Card, { h, style: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: "20px 36px", padding: "30px 28px" } },
      h("div", { style: { flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 14 } },
        h(Mono, { h }, `${tag(1)} welcome`),
        h("p", { style: { margin: 0, fontSize: 36, lineHeight: 1.05, fontWeight: 800, letterSpacing: "-0.035em" } }, "Let ", h("span", { style: { background: `linear-gradient(transparent 68%, ${YELLOW} 68%, ${YELLOW} 94%, transparent 94%)` } }, "your team"), h("span", { style: { display: "block", color: T.grey } }, "ask your agents.")),
        h(Sub, { h, style: { fontSize: 15 } }, "Pick an agent, pick who can ask, set a few limits. Teammates @mention it in Buzz and it answers in a thread, here on your computer, as you."),
        h("div", null, h(Btn, { h, kind: "sky", onClick: () => go("share"), style: { minHeight: 44, fontSize: 15 } }, "Share your first agent →"))),
      h(Paper, { h, art: "UnboxingDoodle", alt: "Someone opening a box", style: { flex: "1 1 240px", maxWidth: 320, aspectRatio: "4 / 3" } })),
    h(Limitations, { h }));
}

function Requests({ h, rt, state, flash, config, n }) {
  const reqs = state.requests;
  if (!reqs.length) return null;
  const where = { away: " while you were away", public: " in a public channel", big: " in a big channel", unknown: " in a channel it can't check" };
  return h(Card, { h },
    h(Title, { h, sub: "for you", n, right: h(Badge, { h }, reqs.length) }, "Waiting"),
    h(Sub, { h, style: { marginTop: -6 } }, config.paused ? "Sharing is paused. Resume it to answer these." : "Nothing has run for these, and no credits were used."),
    reqs.map((r) => h(Tile, { h, key: r.eventId, style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 14px" } },
      h(Avatar, { h, name: r.fromName }),
      h("div", { style: { flex: "999 1 260px", minWidth: 0 } },
        h("p", { style: { margin: 0, fontSize: 14 } }, h("strong", null, r.fromName), " asked ", h("strong", null, r.agentName), where[r.kind] || "", h("span", { style: { color: T.subtle } }, ` · ${rt.channelName(r.channel)} · `), h(Mono, { h }, timeLabel(r.at))),
        h("p", { style: { margin: "3px 0 0", fontSize: 14, color: T.subtle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, `“${r.text}”`)),
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
        r.kind === "access" || r.kind === "away"
          ? h(Btn, { h, kind: "sky", disabled: config.paused, onClick: async () => { await rt.approve(r.eventId, "week"); flash(`${r.fromName} can ask ${r.agentName} for 1 week. Answering now.`); } }, "Approve and answer")
          : null,
        h(Btn, { h, kind: r.kind === "access" || r.kind === "away" ? "quiet" : "sky", disabled: config.paused, onClick: async () => { await rt.answerOnce(r.eventId); flash(`Answering ${r.fromName} once`); } }, r.kind === "access" || r.kind === "away" ? "Answer once" : "Answer"),
        h(Btn, { h, onClick: () => { rt.dismiss(r.eventId); flash("Dismissed"); } }, "Dismiss")))));
}

function Overview(env) {
  const { h, React, config, state, shared } = env;
  const [period, setPeriod] = React.useState("today");
  const [picked, setPicked] = React.useState(shared[0]?.pubkey);
  const now = Date.now();
  const windowMs = period === "today" ? core.DAY_MS : 7 * core.DAY_MS;
  const answered = state.activity.filter((a) => now - a.at < windowMs && a.result === "ok").length;
  const cap = period === "today" ? config.limits.total : config.limits.total * 7;
  const agent = shared.find((a) => a.pubkey === picked) || shared[0];
  const resetLabel = period === "today" ? `${new Date().toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}, resets at midnight` : "The last 7 days";
  return h(Fragment, null,
    h(Card, { h },
      h(Title, { h, sub: "all agents", n: 1 }, "Usage"),
      h("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 28px" } },
        h("span", { style: { fontSize: "clamp(56px, 10vw, 92px)", fontWeight: 400, letterSpacing: "-0.05em", lineHeight: 1, fontVariantNumeric: "tabular-nums" } }, answered, h("span", { style: { color: T.grey } }, `/${cap}`)),
        h("div", { style: { flex: "1 1 200px", fontSize: 13, lineHeight: 1.5 } }, h("span", { style: { color: T.subtle, display: "block" } }, `Requests answered ${period === "today" ? "today" : "this week"} · all agents`), h("strong", null, resetLabel)),
        h(Segmented, { h, label: "Period", value: period, onChange: setPeriod, options: [["today", "Today"], ["week", "Week"]] })),
      h(Meter, { h, value: answered, of: cap }),
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px 18px", alignItems: "center", fontSize: 13, paddingTop: 10, borderTop: `1px solid ${T.border}` } },
        h("span", { style: { color: T.subtle } }, "Status"),
        [[T.online, "Open, within limits"], [AMBER, "Near a limit"], [RED, "Paused or needs your OK"]].map(([c, t]) => h("span", { key: t, style: { display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 } }, h(Dot, { h, color: c }), t)))),
    h(Requests, { ...env, n: 2 }),
    agent && h(AgentFolder, { ...env, agent, setPicked }),
    h(Limitations, { h }));
}

/** Design A's folder tabs: one per shared agent, plus "Share another agent". */
function AgentFolder(env) {
  const { h, React, rt, config, shared, people, channels, flash, go, ui, agent, setPicked } = env;
  const cfg = config.agents[agent.pubkey];
  const used = rt.counters.count(`d:${agent.pubkey}`, core.DAY_MS);
  const left = Math.max(0, config.limits.day - used);
  const paused = config.paused || cfg.paused;
  const near = used / config.limits.day >= 0.8;
  const stateColor = (a) => (config.paused || config.agents[a.pubkey].paused ? RED : rt.counters.count(`d:${a.pubkey}`, core.DAY_MS) / config.limits.day >= 0.8 ? AMBER : T.online);
  const chans = cfg.channels.map((id) => channels.find((c) => c.id === id) || { id, name: "a channel" });
  const names = people.filter((p) => p.agents.includes(agent.pubkey)).map((p) => (p.name || rt.nameOf(p.pubkey)).split(" ")[0]);
  const reach = new Set(people.filter((p) => p.agents.includes(agent.pubkey)).map((p) => p.pubkey));
  for (const c of chans) for (const m of c.members || []) if (m !== agent.owner) reach.add(m);
  const kind = /codex/.test(agent.type || "") ? "Codex" : /goose/.test(agent.type || "") ? "Goose" : /\bpi\b|\/pi/.test(agent.type || "") ? "Pi" : "Claude";
  const tabStyle = (on) => ({ display: "inline-flex", alignItems: "center", gap: 10, height: 50, padding: "0 20px 0 10px", border: 0, borderRadius: "16px 16px 0 0", font: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer", background: on ? AMBER : T.card, color: on ? INK : T.text });
  const tileIcon = (icon) => h("span", { "aria-hidden": true, style: { width: 34, height: 34, borderRadius: "50%", border: `1px solid ${T.prominent}`, display: "inline-flex", alignItems: "center", justifyContent: "center", color: T.subtle } }, h(Icon, { h, name: icon }));
  return h("div", null,
    h("div", { role: "tablist", "aria-label": "Shared agents", style: { display: "flex", gap: 6, flexWrap: "wrap", paddingLeft: 12 } },
      shared.map((a, i) => {
        const on = a.pubkey === agent.pubkey;
        return h("button", { key: a.pubkey, type: "button", role: "tab", "aria-selected": on, onClick: () => setPicked(a.pubkey), style: tabStyle(on) },
          h("span", { style: { width: 30, height: 30, borderRadius: "50%", background: on ? INK : T.tile, color: on ? "#F4F2EA" : T.text, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 11 } }, String(i + 1).padStart(2, "0")),
          h(AgentMark, { h, pubkey: a.pubkey, name: a.name, size: 22 }), a.name, h(Dot, { h, color: stateColor(a) }));
      }),
      h("button", { type: "button", onClick: () => go("share"), style: { ...tabStyle(false), background: T.primary, color: T.onPrimary } },
        h("span", { style: { width: 30, height: 30, borderRadius: "50%", background: "rgba(127,127,127,.35)", display: "inline-flex", alignItems: "center", justifyContent: "center" } }, h(Icon, { h, name: "plus", size: 15 })), "Share another agent")),
    h(Card, { h, style: { borderTop: `6px solid ${AMBER}`, borderRadius: "0 26px 26px 26px" } },
      h(Title, { h, sub: "shared with", n: 3, right: h("span", { style: { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 } }, h(Toggle, { h, ui, on: !cfg.paused, label: `Share ${agent.name}`, onChange: (on) => rt.config.set((c) => ({ ...c, agents: { ...c.agents, [agent.pubkey]: { ...c.agents[agent.pubkey], paused: !on } } }), { now: true }) }), cfg.paused ? "Paused" : "Shared") }, agent.name),
      h("span", { style: { fontSize: 13, color: T.subtle, marginTop: -8 } }, `${kind} · ${plural(reach.size, "person", "people")} can use it`),
      h("div", { style: { display: "flex", alignItems: "baseline", gap: 12 } },
        h("span", { style: { fontSize: 48, fontWeight: 400, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" } }, used, h("span", { style: { fontSize: 22, fontWeight: 600 } }, ` of ${config.limits.day}`)),
        h("strong", { style: { fontSize: 14 } }, "requests today")),
      h(Meter, { h, value: used, of: config.limits.day }),
      h("div", { style: { display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, fontSize: 13, marginTop: -6 } },
        h("strong", { style: { color: near ? T.warn : T.text } }, paused ? "Paused: mentions are held" : `${left} left today`), h("span", { style: { color: T.subtle } }, `${config.limits.hour} per person each hour`)),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 } },
        chans.map((c) => h(Tile, { h, key: c.id, style: { minHeight: 110, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 } },
          tileIcon(c.visibility === "public" ? "globe" : "lock"),
          h("div", null, h("span", { style: { fontSize: 12, color: T.subtle } }, `${c.visibility === "public" ? "Public" : "Private"}${c.members ? " · " + plural(c.members.length, "member") : ""}`), h("strong", { style: { display: "block", fontSize: 17, letterSpacing: "-0.01em" } }, "#" + c.name)))),
        names.length ? h(Tile, { h, style: { minHeight: 110, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 } },
          tileIcon("users"),
          h("div", null, h("span", { style: { fontSize: 12, color: T.subtle } }, "Approved people"), h("strong", { style: { display: "block", fontSize: 17, letterSpacing: "-0.01em" } }, names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : "")))) : null,
        h("button", { type: "button", onClick: () => rt.state.set((s) => ({ ...s, tab: "share", prefillAgent: agent.pubkey })),
          style: { minHeight: 110, borderRadius: 16, border: `1.5px dashed ${T.prominent}`, background: "transparent", font: "inherit", color: T.text, cursor: "pointer", textAlign: "left", padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "space-between" } },
          tileIcon("plus"),
          h("span", null, h("span", { style: { fontSize: 12, color: T.subtle, display: "block" } }, "Channel or person"), h("strong", { style: { fontSize: 17 } }, "Add")))),
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" } },
        h(Btn, { h, onClick: async () => flash((await rt.copy(core.howTo(agent.name, config.limits))) ? "How-to copied. Paste it in your channel." : "Couldn't copy") }, h(Icon, { h, name: "copy" }), "Copy how-to"),
        h(MoreMenu, { h, React, ui, label: `More actions for ${agent.name}`, items: [
          { label: "Change limits", onSelect: () => go("limits") },
          { label: "See activity", onSelect: () => go("activity") },
          { label: "Stop sharing", danger: true, onSelect: () => { rt.config.set((c) => { const agents = { ...c.agents }; delete agents[agent.pubkey]; return { ...c, agents, people: c.people.map((p) => ({ ...p, agents: p.agents.filter((k) => k !== agent.pubkey) })) }; }, { now: true }); flash(`${agent.name} is no longer shared`); } },
        ] }))));
}

// ----- share -----
function Share(env) {
  const { h, React, rt, config, state, channels, agentList, flash, go } = env;
  const [step, setStep] = React.useState(state.prefillAgent ? 2 : 1);
  const [picked, setPicked] = React.useState(state.prefillAgent || agentList.find((a) => a.support.ok)?.pubkey);
  const pickedAgent = agentList.find((a) => a.pubkey === picked);
  const [chosen, setChosen] = React.useState(() => new Set([...(config.agents[picked]?.channels || []), ...(state.prefill ? [state.prefill] : [])]));
  const [added, setAdded] = React.useState([]);
  const [query, setQuery] = React.useState("");
  const [dur, setDur] = React.useState("week");
  const [confirmed, setConfirmed] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const first = React.useRef(true);
  React.useEffect(() => { if (state.prefill || state.prefillAgent) rt.state.set((s) => ({ ...s, prefill: undefined, prefillAgent: undefined })); }, []);
  React.useEffect(() => { if (first.current) { first.current = false; return; } setChosen(new Set(config.agents[picked]?.channels || [])); }, [picked]);

  const all = { ask: { public: true, big: true, unknown: true } };
  const risky = channels.filter((c) => chosen.has(c.id) && core.askReason(all, c));
  const needsConfirm = risky.length > 0 && !confirmed;
  const reach = new Set(added.map((p) => p.pubkey));
  for (const id of chosen) for (const m of channels.find((c) => c.id === id)?.members || []) reach.add(m);
  const candidates = React.useMemo(() => {
    const seen = new Map();
    for (const c of channels) for (const m of c.members || []) if (!seen.has(m)) seen.set(m, rt.nameOf(m));
    return [...seen].map(([pubkey, name]) => ({ pubkey, name })).filter((c) => !c.name.endsWith("…"));
  }, [channels]);
  const q = query.trim().toLowerCase();
  const asKey = core.toPubkey(query);
  const matches = q ? candidates.filter((c) => c.name.toLowerCase().includes(q) && !added.some((a) => a.pubkey === c.pubkey)).slice(0, 5) : [];
  if (asKey && !matches.some((m) => m.pubkey === asKey)) matches.unshift({ pubkey: asKey, name: rt.nameOf(asKey) });
  const durLabel = (id) => core.DURATIONS.find((d) => d.id === id).label;

  const titles = [["Which agent", "do you want to share?"], ["Who can ask", "your agent?"], ["Set some", "limits"], ["Check", "and share"]];
  const helps = ["Only agents running on this computer can be shared.", "Pick channels, add people one by one, or both.", "Mentions over a limit are held, not answered. You can change these any time.", "Nothing is shared until you press the button."];
  const canNext = step === 1 ? Boolean(pickedAgent?.support.ok) : step === 2 ? (chosen.size > 0 || added.length > 0) && !needsConfirm : true;
  const finish = () => {
    rt.config.set((c) => ({ ...c, agents: { ...c.agents, [picked]: { channels: [...chosen], paused: false } } }), { now: true });
    for (const p of added) rt.addPerson({ pubkey: p.pubkey, name: p.name, agents: [picked], durationId: p.dur });
    setDone(true);
  };

  if (done)
    return h(Card, { h, style: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: "16px 28px" } },
      h(Paper, { h, art: "SelfieDoodle", style: { width: 150, height: 120 } }),
      h("div", { style: { flex: "999 1 260px", display: "flex", flexDirection: "column", gap: 6 } }, h("p", { style: { margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em" } }, `${pickedAgent.name} is shared.`, h("span", { style: { display: "block", color: T.grey } }, "Tell your team.")), h(Sub, { h }, "Post a short how-to so people know they can ask it.")),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
        h(Btn, { h, kind: "sky", onClick: async () => flash((await rt.copy(core.howTo(pickedAgent.name, config.limits))) ? "How-to copied" : "Couldn't copy") }, h(Icon, { h, name: "copy" }), "Copy how-to"),
        h(Btn, { h, onClick: () => go("overview") }, "Back to overview")));

  return h(Card, { h, style: { gap: 20 } },
    h(Title, { h, sub: titles[step - 1][1], n: step }, titles[step - 1][0]),
    h(Sub, { h, style: { marginTop: -8 } }, helps[step - 1]),
    h("ol", { "aria-label": "Steps", style: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 8 } },
      ["Agent", "Who can ask", "Limits", "Review"].map((l, i) => {
        const n = i + 1, on = step === n, past = step > n;
        return h("li", { key: l, "aria-current": on ? "step" : undefined, style: { display: "inline-flex", alignItems: "center", gap: 8, height: 36, padding: "0 14px 0 5px", borderRadius: 999, fontSize: 14, fontWeight: 700, background: on ? T.primary : T.tile, color: on ? T.onPrimary : T.text } },
          h("span", { style: { width: 26, height: 26, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: on ? SKY : past ? T.okBg : T.card, color: on ? ON_ACCENT : T.text, fontFamily: MONO, fontSize: 11 } }, past ? h(Icon, { h, name: "check", size: 13 }) : String(n).padStart(2, "0")), l);
      })),
    step === 1 && h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 } },
      agentList.length ? agentList.map((a) => {
        const on = picked === a.pubkey;
        return h("button", { key: a.pubkey, type: "button", disabled: !a.support.ok, "aria-pressed": on, onClick: () => setPicked(a.pubkey),
          style: { display: "flex", flexDirection: "column", gap: 10, padding: 16, textAlign: "left", borderRadius: 16, font: "inherit", color: T.text, cursor: a.support.ok ? "pointer" : "not-allowed", background: a.support.ok ? T.tile : "transparent", border: on ? `2px solid ${T.focus}` : `1px ${a.support.ok ? "solid" : "dashed"} ${T.prominent}` } },
          h("span", { style: { display: "flex", alignItems: "center", gap: 10 } },
            h(AgentMark, { h, pubkey: a.pubkey, name: a.name, size: 36 }),
            h("strong", { style: { fontSize: 16 } }, a.name), on ? h("span", { style: { marginLeft: "auto", width: 24, height: 24, borderRadius: "50%", background: SKY, color: ON_ACCENT, border: `1.5px solid ${SKY}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 } }, h(Icon, { h, name: "check", size: 14 })) : null),
          h("span", { style: { fontSize: 13, lineHeight: 1.45, color: a.support.ok ? T.subtle : T.danger } }, a.support.ok ? (config.agents[a.pubkey] ? "Already shared. Change who can ask." : "Ready to share") : a.support.reason));
      }) : h(Sub, { h }, "You have no agents in this community yet. Create one in Agents first.")),
    step === 2 && h(Fragment, null,
      h(Tile, { h, style: { padding: 0, overflow: "hidden" } },
        h("div", { style: { padding: "14px 16px 10px" } }, h("strong", null, "Channels"), h(Sub, { h }, "Anyone in a channel you pick can ask. Buzz checks who's in it, so people who leave lose access.")),
        channels.length ? channels.map((c) => {
          const reason = core.askReason(all, c);
          return h("label", { key: c.id, style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 12px", padding: "11px 16px", borderTop: `1px solid ${T.border}`, cursor: "pointer" } },
            h("input", { type: "checkbox", checked: chosen.has(c.id), onChange: () => { const next = new Set(chosen); next.has(c.id) ? next.delete(c.id) : next.add(c.id); setChosen(next); setConfirmed(false); }, style: { width: 18, height: 18, accentColor: INK } }),
            h("strong", { style: { fontSize: 14 } }, "#" + c.name),
            h("span", { style: { fontSize: 13, color: T.subtle } }, `${c.members ? plural(c.members.length, "member") : "Members unknown"} · ${c.visibility === "public" ? "Public" : c.visibility === "private" ? "Private" : "Visibility unknown"}`),
            reason === "public" ? h(Chip, { h, tone: "danger" }, "Public · anyone can join") : reason === "big" ? h(Chip, { h, tone: "warn" }, `Over ${core.BIG_CHANNEL} people`) : reason === "unknown" ? h(Chip, { h, tone: "warn" }, "Can't check members") : null);
        }) : h("div", { style: { padding: "12px 16px" } }, h(Sub, { h }, "Loading your channels…"))),
      risky.length > 0 && h("div", { role: "alert", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 14px", padding: "14px 16px", borderRadius: 16, background: T.dangerBg } },
        h(Icon, { h, name: "triangle-alert", size: 18, style: { color: T.danger } }),
        h("p", { style: { margin: 0, flex: "999 1 280px", fontSize: 14, lineHeight: 1.5 } }, h("strong", null, risky.map((c) => "#" + c.name).join(", ")), " could let many people, or people you don't know, use your account and credits. ", pickedAgent?.name, " will ask you before answering there."),
        h("label", { style: { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700 } }, h("input", { type: "checkbox", checked: confirmed, onChange: () => setConfirmed(!confirmed), style: { width: 18, height: 18 } }), "I understand")),
      h(Tile, { h, style: { display: "flex", flexDirection: "column", gap: 10 } },
        h("strong", null, "People, one by one"), h(Sub, { h }, "For someone who isn't in those channels. Their access ends on its own."),
        added.length ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } }, added.map((p) => h(Chip, { h, key: p.pubkey }, `${p.name} · ${durLabel(p.dur)}`, h("button", { type: "button", "aria-label": `Remove ${p.name}`, onClick: () => setAdded(added.filter((x) => x.pubkey !== p.pubkey)), style: { border: 0, background: "none", cursor: "pointer", color: T.subtle, display: "inline-flex", padding: 2 } }, h(Icon, { h, name: "x", size: 14 }))))) : null,
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" } },
          h(Field, { h, value: query, onChange: setQuery, label: "Search people", placeholder: "Search by name, or paste an npub", style: { flex: "1 1 240px", background: T.card } }),
          h(Pills, { h, label: "How long", value: dur, onChange: setDur, options: core.DURATIONS.map((d) => [d.id, d.label]) })),
        matches.length ? h("div", { style: { display: "flex", flexDirection: "column", gap: 2 } }, matches.map((m) => h("button", { key: m.pubkey, type: "button", onClick: () => { setAdded([...added, { ...m, dur }]); setQuery(""); },
          style: { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "6px 10px", border: 0, borderRadius: 12, background: T.card, font: "inherit", fontSize: 14, color: T.text, cursor: "pointer", textAlign: "left" } },
          h(Avatar, { h, name: m.name }), m.name, h("span", { style: { marginLeft: "auto", color: T.subtle, fontSize: 13 } }, `Add for ${durLabel(dur).toLowerCase()}`)))) : null)),
    step === 3 && h(LimitFields, env),
    step === 4 && h(Tile, { h, style: { display: "flex", flexDirection: "column", gap: 12, padding: 20 } },
      h("p", { style: { margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 10 } }, h(AgentMark, { h, pubkey: picked, name: pickedAgent?.name, size: 28 }), pickedAgent?.name),
      h("p", { style: { margin: 0, fontSize: 15 } }, h("strong", null, "Who: "), [...[...chosen].map((id) => "#" + (channels.find((c) => c.id === id)?.name || "channel")), ...added.map((p) => `${p.name} (${durLabel(p.dur)})`)].join(", ") || "Nobody yet"),
      h("p", { style: { margin: 0, fontSize: 15 } }, h("strong", null, "Limits: "), `${config.limits.hour} an hour per person · ${config.limits.day} a day for this agent · ${config.limits.total} a day in total`),
      h("p", { style: { margin: 0, fontSize: 15 } }, h("strong", null, "Asks you first: "), [config.ask.public && "public channels", config.ask.big && `channels over ${core.BIG_CHANNEL} people`, config.ask.unknown && "channels it can't check"].filter(Boolean).join(", ") || "never"),
      h("div", { style: { display: "flex", alignItems: "baseline", gap: 10, paddingTop: 12, borderTop: `1px solid ${T.border}` } },
        h("span", { style: { fontSize: 40, fontWeight: 400, letterSpacing: "-0.04em", lineHeight: 1 } }, reach.size), h("strong", null, `${reach.size === 1 ? "person" : "people"} will be able to ask ${pickedAgent?.name}`))),
    h("div", { style: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, paddingTop: 14, borderTop: `1px solid ${T.border}` } },
      h(Btn, { h, onClick: () => (step > 1 ? setStep(step - 1) : go("overview")) }, step > 1 ? "← Back" : "Cancel"),
      h(Btn, { h, kind: step < 4 ? "primary" : "sky", disabled: !canNext, onClick: () => (step < 4 ? setStep(step + 1) : finish()) }, step < 4 ? "Next →" : "Start sharing")));
}

function LimitFields({ h, rt, config }) {
  const defs = [["hour", "Per person, each hour", [5, 10, 20]], ["day", "Per agent, each day", [25, 50, 100]], ["total", "All agents together, each day", [50, 100, 200]]];
  const set = (k, v) => rt.config.set((c) => ({ ...c, limits: { ...c.limits, [k]: Math.max(1, v) } }), { now: true });
  const pill = (on) => ({ minWidth: 52, height: 40, padding: "0 14px", borderRadius: 999, font: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", border: `1px solid ${on ? T.primary : T.prominent}`, background: on ? T.primary : "transparent", color: on ? T.onPrimary : T.text });
  return h("div", { style: { display: "flex", flexDirection: "column", gap: 16 } },
    defs.map(([k, label, presets]) => h("div", { key: k, style: { display: "flex", flexDirection: "column", gap: 8 } },
      h("span", { style: { fontSize: 13, color: T.subtle } }, label),
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" } },
        presets.map((v) => h("button", { key: v, type: "button", "aria-pressed": config.limits[k] === v, onClick: () => set(k, v), style: pill(config.limits[k] === v) }, v)),
        h("span", { style: { display: "inline-flex", alignItems: "center", gap: 4, height: 40, padding: "0 6px", borderRadius: 999, border: `1px solid ${presets.includes(config.limits[k]) ? T.prominent : T.primary}` } },
          h("button", { type: "button", "aria-label": `Lower ${label}`, onClick: () => set(k, config.limits[k] - 1), style: { width: 28, height: 28, borderRadius: "50%", border: 0, background: "transparent", color: T.text, cursor: "pointer", fontSize: 16 } }, "−"),
          h("span", { "aria-live": "polite", style: { minWidth: 34, textAlign: "center", fontWeight: 700, fontVariantNumeric: "tabular-nums" } }, config.limits[k]),
          h("button", { type: "button", "aria-label": `Raise ${label}`, onClick: () => set(k, config.limits[k] + 1), style: { width: 28, height: 28, borderRadius: "50%", border: 0, background: "transparent", color: T.text, cursor: "pointer", fontSize: 16 } }, "+"))))),
    h(Sub, { h, style: { fontSize: 13 } }, "Your own messages never count. Shared agents are told not to share secrets, delete files or push code for other people."));
}

// ----- people -----
function People(env) {
  const { h, React, rt, config, people, channels, shared, flash, agentName } = env;
  const [query, setQuery] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [pick, setPick] = React.useState(null);
  const [agents, setAgents] = React.useState(() => new Set(shared.slice(0, 1).map((a) => a.pubkey)));
  const [dur, setDur] = React.useState("week");
  const [addQuery, setAddQuery] = React.useState("");
  const byMember = new Map();
  for (const a of shared) for (const id of config.agents[a.pubkey].channels) {
    const c = channels.find((x) => x.id === id);
    for (const m of c?.members || []) {
      if (m === a.owner || people.some((p) => p.pubkey === m)) continue;
      const e = byMember.get(m) || { pubkey: m, channels: new Set(), agents: new Set() };
      e.channels.add(c.name); e.agents.add(a.pubkey); byMember.set(m, e);
    }
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
  return h(Fragment, null,
    adding && h(Card, { h, style: { outline: `2px solid ${T.focus}` } },
      h(Title, { h, sub: "for a while, or until you stop", n: 1, right: h(Btn, { h, label: "Close", onClick: () => setAdding(false), style: { width: 38, padding: 0 } }, h(Icon, { h, name: "x" })) }, "Add a person"),
      h(Field, { h, value: addQuery, onChange: setAddQuery, label: "Search by name", placeholder: "Search by name, or paste an npub" }),
      h(Pills, { h, label: "Person", value: pick?.pubkey, onChange: (pk) => setPick(options.find((o) => o.pubkey === pk)), options: options.map((o) => [o.pubkey, o.name]) }),
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" } }, h("strong", { style: { fontSize: 14 } }, "Agents"),
        shared.map((a) => h("label", { key: a.pubkey, style: { display: "inline-flex", gap: 6, fontSize: 14, alignItems: "center" } }, h("input", { type: "checkbox", checked: agents.has(a.pubkey), onChange: () => { const n = new Set(agents); n.has(a.pubkey) ? n.delete(a.pubkey) : n.add(a.pubkey); setAgents(n); }, style: { accentColor: INK } }), h(AgentMark, { h, pubkey: a.pubkey, name: a.name, size: 20 }), a.name))),
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" } }, h("strong", { style: { fontSize: 14 } }, "For"), h(Pills, { h, label: "How long", value: dur, onChange: setDur, options: core.DURATIONS.map((d) => [d.id, d.label]) })),
      h("div", null, h(Btn, { h, kind: "sky", disabled: !pick || !agents.size, onClick: give }, pick ? `Give ${pick.name} access` : "Pick someone first"))),
    h(Requests, { ...env, n: 2 }),
    h(Card, { h },
      h(Title, { h, sub: `${plural(rows.length, "person", "people")} can ask`, n: 3, right: h(Btn, { h, kind: "primary", disabled: !shared.length, onClick: () => setAdding(!adding) }, h(Icon, { h, name: "user-plus" }), "Add a person") }, "People"),
      h(Field, { h, value: query, onChange: setQuery, label: "Search names", placeholder: "Search names", style: { maxWidth: 280 } }),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
        rows.length ? rows.map((r) => h(Tile, { h, key: r.pubkey, style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 16px", padding: "10px 14px" } },
          h("span", { style: { display: "flex", alignItems: "center", gap: 10, flex: "1 1 180px", minWidth: 0 } }, h(Avatar, { h, name: r.name }), h("strong", null, r.name)),
          h("span", { style: { flex: "1 1 160px" } }, h(Chip, { h }, r.how)),
          h("span", { style: { flex: "0 0 auto", display: "inline-flex", gap: 4 } }, r.agents.map((k) => h("span", { key: k, title: agentName(k) }, h(AgentMark, { h, pubkey: k, name: agentName(k), size: 22 })))),
          h("span", { style: { flex: "0 0 140px", fontSize: 14, color: r.ends === "Today" || r.ends === "Tomorrow" ? T.danger : T.text, fontWeight: r.ends === "Today" || r.ends === "Tomorrow" ? 700 : 400 } }, r.ends),
          r.manual ? h(Btn, { h, onClick: () => { rt.removePerson(r.pubkey); flash(`${r.name} no longer has access`); }, style: { minHeight: 32 } }, "Remove") : h(Mono, { h }, "ends when they leave")))
          : h("div", { style: { padding: 18, textAlign: "center" } }, h(Sub, { h }, query ? `Nobody matches “${query}”.` : "Nobody can ask yet. Share an agent with a channel, or add someone.")))));
}

// ----- activity -----
function Activity({ h, React, rt, state, agentName }) {
  const [filter, setFilter] = React.useState("all");
  const keys = [["all", "All"], ["ok", "Answered"], ["held", "Held"], ["req", "Asked you"], ["drop", "Not delivered"], ["away", "While away"]];
  const rows = state.activity.filter((a) => filter === "all" || a.result === filter).slice(0, 200);
  const dotFor = { ok: T.online, held: AMBER, away: AMBER, req: RED, drop: "#8F8A7C", refused: "#8F8A7C" };
  return h(Card, { h },
    h(Title, { h, sub: "latest first", n: 1 }, "Activity"),
    h(Callout, { h, icon: "lock" }, "Only who, which agent, where and when are kept here, on this computer, for 30 days. ", h("strong", null, "What people asked stays in Buzz"), ", in the thread."),
    h(Pills, { h, label: "Filter", value: filter, onChange: setFilter, options: keys.map(([k, l]) => [k, `${l} ${k === "all" ? state.activity.length : state.activity.filter((a) => a.result === k).length}`]) }),
    h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
      rows.length ? rows.map((a, i) => {
        const [label] = RESULTS[a.result] || RESULTS.drop;
        const who = a.whoName || rt.nameOf(a.who);
        return h(Tile, { h, key: a.at + ":" + i, style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 14px", padding: "10px 14px", fontSize: 14 } },
          h(Mono, { h, style: { flex: "0 0 72px" } }, timeLabel(a.at)),
          h(Dot, { h, color: dotFor[a.result] || "#8F8A7C" }),
          h("span", { style: { flex: "1 1 300px" } }, `${label}: `, h("strong", null, who), ` → ${agentName(a.agent)} in ${rt.channelName(a.channel)}`),
          a.detail ? h(Mono, { h }, a.detail.toLowerCase()) : null);
      }) : h("div", { style: { padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" } },
        h(Paper, { h, art: "LayingDoodle", style: { width: 220, height: 140 } }), h(Sub, { h }, "Nothing yet. When someone asks one of your agents, it shows up here."))));
}

// ----- limits & alerts -----
function Limits(env) {
  const { h, rt, config, ui } = env;
  const setGroup = (group, k, v) => rt.config.set((c) => ({ ...c, [group]: { ...c[group], [k]: v } }), { now: true });
  const rows = (group, defs) => defs.map(([k, label, help]) => h(Tile, { h, key: k, style: { display: "flex", alignItems: "center", gap: 14 } },
    h("div", { style: { flex: 1 } }, h("p", { style: { margin: 0, fontSize: 15, fontWeight: 700 } }, label), h(Sub, { h, style: { marginTop: 2, fontSize: 13 } }, help)),
    h(Toggle, { h, ui, on: config[group][k], onChange: (v) => setGroup(group, k, v), label })));
  return h(Fragment, null,
    h(Card, { h }, h(Title, { h, sub: "per person and per agent", n: 1 }, "Limits"), h(LimitFields, env),
      h(Callout, { h, icon: "hourglass", tone: "warn" }, "When a limit is reached, mentions are ", h("strong", null, "held, not answered"), ". You can see them in Activity.")),
    h(Card, { h }, h(Title, { h, sub: "before answering", n: 2 }, "Ask me first"), rows("ask", [
      ["public", "Public channels", "Anyone can join them, so you check each question first."],
      ["big", `Channels with more than ${core.BIG_CHANNEL} people`, "Bigger rooms, more chances of surprise."],
      ["unknown", "Channels Agent Access can't check", "If it can't see who's in a channel, it asks you."]])),
    h(Card, { h }, h(Title, { h, sub: "quiet by default", n: 3 }, "Alerts"), rows("alerts", [
      ["toast", "Someone asks for access", "A notice in Buzz with Give access, Answer once and Dismiss."],
      ["near", "An agent is close to a limit", "At most once a day per agent."],
      ["summary", "Daily summary after 6 pm", "Who asked which agent, in one notification."],
      ["every", "Every answer", "Off by default. It gets noisy."]])));
}

// ----- settings -----
function Settings({ h, React, rt, flash }) {
  const [confirmStop, setConfirmStop] = React.useState(false);
  const exportCsv = async () => {
    const rows = [["time", "who", "agent", "channel", "result", "detail"], ...rt.state.get().activity.map((a) => [new Date(a.at).toISOString(), a.whoName || a.who, a.agent, rt.channelName(a.channel), a.result, a.detail || ""])];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    flash((await rt.copy(csv)) ? "Activity copied as CSV. Paste it into a sheet." : "Couldn't copy");
  };
  return h(Fragment, null,
    h(Card, { h },
      h(Title, { h, sub: `version ${VERSION}`, n: 1 }, "Agent Access"),
      h(Sub, { h }, rt.guarded ? "Uses Buzz's checked delivery: a message is handed over only if sharing is still on." : "Basic delivery on this version of Buzz."),
      h(Sub, { h }, "Updates install with Buzz's plugin updates. Settings and activity stay on this computer.")),
    h(Card, { h },
      h(Title, { h, sub: "can be shared", n: 2 }, "Which agents"),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 } },
        h(Tile, { h, style: { background: T.okBg, color: T.ok } }, h("strong", { style: { display: "inline-flex", alignItems: "center", gap: 6 } }, h(Icon, { h, name: "check" }), "Supported"), h("p", { style: { margin: "4px 0 0", fontSize: 14 } }, "Claude, Codex, Goose and Pi agents running on this computer")),
        h(Tile, { h }, h("strong", { style: { display: "inline-flex", alignItems: "center", gap: 6 } }, h(Icon, { h, name: "x" }), "Not supported"), h("p", { style: { margin: "4px 0 0", fontSize: 14, color: T.subtle } }, "Shared compute and Builderlab agents. They run somewhere else, so this plugin can't reach them.")))),
    h(Card, { h, style: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" } },
      h("div", { style: { flex: "999 1 240px" } }, h(Title, { h, sub: "metadata only, 30 days", n: 3 }, "Your data")),
      h(Btn, { h, onClick: exportCsv }, "Copy activity as CSV"),
      h(Btn, { h, onClick: () => { rt.state.set((s) => ({ ...s, activity: [] }), { now: true }); flash("Activity cleared"); } }, "Clear activity")),
    h(Card, { h, style: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center", background: T.dangerBg } },
      h("div", { style: { flex: "999 1 260px" } }, h(Title, { h, sub: "and go back to only you", n: 4 }, "Stop sharing everything"), h(Sub, { h, style: { marginTop: 6 } }, "Removes all channels and people.")),
      confirmStop
        ? h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
            h(Btn, { h, kind: "danger", onClick: () => { rt.config.set((c) => ({ ...c, agents: {}, people: [] }), { now: true }); setConfirmStop(false); flash("Stopped sharing everything"); } }, "Yes, stop everything"),
            h(Btn, { h, onClick: () => setConfirmStop(false) }, "Keep sharing"))
        : h(Btn, { h, kind: "danger", onClick: () => setConfirmStop(true) }, "Stop sharing everything")));
}
