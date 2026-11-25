import test from "node:test";
import assert from "node:assert/strict";
import { loadPlugin, memoryStorage, fakeHost, tick, OWNER, COFFEE, ANUSHKA, OMAR, TEAM, PUBLIC, hex } from "./helpers.mjs";

const { __test: { core, createRuntime } } = await loadPlugin();

function setup(config, hostOptions) {
  globalThis.localStorage = memoryStorage();
  localStorage.setItem(core.STORAGE_KEY, JSON.stringify(config));
  const host = fakeHost(hostOptions);
  const rt = createRuntime(host.ctx);
  const stop = rt.start();
  return { host, rt, stop };
}
const mention = (from, channel, id = Math.random().toString(16).slice(2).padEnd(64, "0").slice(0, 64), content = "What did we decide?") =>
  ({ id, pubkey: from, content, tags: [["h", channel], ["p", COFFEE]] });

test("a channel member's mention wakes the agent in the thread", async () => {
  const { host, rt, stop } = setup({ agents: { [COFFEE]: { channels: [TEAM] } } });
  host.post(mention(ANUSHKA, TEAM, hex(77)));
  await tick(10);
  assert.equal(host.wakes.length, 1);
  assert.equal(host.wakes[0].key, "k-coffee");
  assert.equal(host.wakes[0].channel, TEAM);
  assert.equal(host.wakes[0].root, hex(77));
  assert.equal(host.wakes[0].guarded, true);
  assert.match(host.wakes[0].text, /From Anushka/);
  assert.equal(rt.state.get().activity[0].result, "ok");
  assert.equal(rt.state.get().activity[0].text, undefined);
  stop();
});

test("someone without access becomes a request with a toast, and nothing runs", async () => {
  const { host, rt, stop } = setup({ agents: { [COFFEE]: { channels: [TEAM] } } });
  host.post(mention(OMAR, "other-channel"));
  await tick(10);
  assert.equal(host.wakes.length, 0);
  assert.equal(rt.state.get().requests.length, 1);
  assert.equal(rt.state.get().requests[0].kind, "access");
  assert.match(host.shown[0].title, /Omar asked Coffeehead/);
  assert.deepEqual(host.shown[0].actions.map((a) => a.id), ["approve", "once", "dismiss"]);
  stop();
});

test("approving a request gives a week of access and answers it", async () => {
  const { host, rt, stop } = setup({ agents: { [COFFEE]: { channels: [TEAM] } } }, { notices: false });
  host.post(mention(OMAR, "other-channel", hex(5)));
  await tick(10);
  await rt.approve(hex(5), "week");
  assert.equal(host.wakes.length, 1);
  const omar = rt.config.get().people.find((p) => p.pubkey === OMAR);
  assert.deepEqual(omar.agents, [COFFEE]);
  assert.ok(omar.until > Date.now() + 6.9 * core.DAY_MS);
  assert.equal(rt.state.get().requests.length, 0);
  host.post(mention(OMAR, "other-channel"));
  await tick(10);
  assert.equal(host.wakes.length, 2, "Omar is answered directly now");
  stop();
});

test("the toast's buttons act on the request", async () => {
  const { host, rt, stop } = setup({ agents: { [COFFEE]: { channels: [TEAM] } } }, { noticeAnswer: "once" });
  host.post(mention(OMAR, "other-channel"));
  await tick(20);
  assert.equal(host.wakes.length, 1, "Answer once wakes it");
  assert.equal(rt.config.get().people.length, 0, "without adding Omar");
  stop();
});

test("a public channel asks first, even for a shared channel", async () => {
  const { host, rt, stop } = setup({ agents: { [COFFEE]: { channels: [PUBLIC] } } }, { notices: false });
  const someone = hex(1003);
  host.post(mention(someone, PUBLIC, hex(6)));
  await tick(10);
  assert.equal(host.wakes.length, 0);
  assert.equal(rt.state.get().requests[0].kind, "public");
  await rt.answerOnce(hex(6));
  assert.equal(host.wakes.length, 1);
  stop();
});

test("hourly limits hold mentions instead of answering", async () => {
  const { host, rt, stop } = setup({ agents: { [COFFEE]: { channels: [TEAM] } }, limits: { hour: 2, day: 50, total: 100 } });
  for (let i = 0; i < 3; i++) host.post(mention(ANUSHKA, TEAM));
  await tick(20);
  assert.equal(host.wakes.length, 2);
  const held = rt.state.get().activity.find((a) => a.result === "held");
  assert.equal(held.detail, "Hit the hourly limit");
  stop();
});

test("pausing everything holds mentions; the owner and unshared agents are ignored", async () => {
  const { host, rt, stop } = setup({ paused: true, agents: { [COFFEE]: { channels: [TEAM] } } });
  host.post(mention(ANUSHKA, TEAM));
  host.post({ id: hex(8), pubkey: OWNER, tags: [["h", TEAM], ["p", COFFEE]] });
  await tick(10);
  assert.equal(host.wakes.length, 0);
  assert.equal(rt.state.get().activity.length, 1);
  assert.equal(rt.state.get().activity[0].detail, "Sharing was paused");
  stop();
});

test("a wake that Buzz drops is recorded as not delivered", async () => {
  const { host, rt, stop } = setup({ agents: { [COFFEE]: { channels: [TEAM] } } });
  rt.config.set((c) => ({ ...c, paused: false }));
  const original = host.ctx.agents.wake;
  host.ctx.agents.wake = async () => ({ status: "dropped", reason: "unavailable" });
  host.post(mention(ANUSHKA, TEAM));
  await tick(10);
  assert.equal(rt.state.get().activity[0].result, "drop");
  assert.equal(rt.state.get().activity[0].detail, "Agent wasn't running");
  host.ctx.agents.wake = original;
  stop();
});

test("older Buzz without guarded wake still works", async () => {
  const { host, stop } = setup({ agents: { [COFFEE]: { channels: [TEAM] } } }, { guarded: false });
  host.post(mention(ANUSHKA, TEAM));
  await tick(10);
  assert.equal(host.wakes.length, 1);
  assert.equal(host.wakes[0].guarded, undefined);
  stop();
});

test("mentions from while Buzz was closed wait for the owner", async () => {
  globalThis.localStorage = memoryStorage();
  localStorage.setItem(core.STORAGE_KEY, JSON.stringify({ agents: { [COFFEE]: { channels: [TEAM] } } }));
  localStorage.setItem(core.STATE_KEY, JSON.stringify({ lastBeat: Date.now() - 60 * 60_000 }));
  const host = fakeHost();
  const rt = createRuntime(host.ctx);
  const stopBeat = rt.heartbeat();
  assert.ok(rt.state.get().away, "the gap is noticed");
  const stop = rt.start();
  host.post({ ...mention(ANUSHKA, TEAM), created_at: Math.floor(Date.now() / 1000) - 30 * 60 });
  await tick(10);
  assert.equal(host.wakes.length, 0, "not answered automatically");
  assert.equal(rt.state.get().requests[0].kind, "away");
  stop();
  stopBeat();
});

test("the channel menu offers Share an agent here", () => {
  globalThis.localStorage = memoryStorage();
  const host = fakeHost();
  let contribution;
  let opened;
  host.ctx.reflect.get = (name) =>
    name === "sidebarRows" ? { register: (c) => { contribution = c; } } : name === "navigation" ? { open: async (t) => { opened = t; } } : undefined;
  const rt = createRuntime(host.ctx);
  rt.channelMenu({ createElement: () => ({}) });
  assert.equal(contribution.version, 1);
  assert.deepEqual(contribution.menuItems({ kind: "dm" }), []);
  const [item] = contribution.menuItems({ kind: "team", channel: { id: TEAM } });
  assert.equal(item.label, "Share an agent here…");
  item.onSelect();
  assert.equal(rt.state.get().tab, "share");
  assert.equal(rt.state.get().prefill, TEAM);
  assert.equal(opened.pageId, "main");
});

test("settings saved under the old Teammate access name carry over", () => {
  globalThis.localStorage = memoryStorage();
  localStorage.setItem("letitia.teammate-access:v1", JSON.stringify({ agents: { [COFFEE]: { channels: [TEAM] } }, limitPerHour: 9 }));
  localStorage.setItem("letitia.teammate-access:state", JSON.stringify({ activity: [{ at: Date.now(), result: "ok" }] }));
  const rt = createRuntime(fakeHost().ctx);
  assert.equal(core.PLUGIN_ID, "letitia.agent-access");
  assert.deepEqual(rt.config.get().agents[COFFEE].channels, [TEAM]);
  assert.equal(rt.config.get().limits.hour, 9);
  assert.equal(rt.state.get().activity.length, 1);
  rt.config.set((c) => c, { now: true });
  assert.ok(localStorage.getItem(core.STORAGE_KEY), "saved under the new name from then on");
});
