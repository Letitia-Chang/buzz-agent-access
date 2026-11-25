import test from "node:test";
import assert from "node:assert/strict";
import { loadPlugin, hex, COFFEE, ANUSHKA, OMAR, TEAM } from "./helpers.mjs";

const { __test: { core } } = await loadPlugin();
const DAY = core.DAY_MS;

test("v1–v3 settings carry over into v4", () => {
  const v3 = { agents: { [COFFEE]: { channels: [TEAM] } }, teammates: [{ name: "Anushka", pubkey: ANUSHKA }], limitPerHour: 7, dailyPerAgent: 40 };
  const c = core.normalizeConfig(v3, 1000);
  assert.deepEqual(c.agents[COFFEE], { channels: [TEAM], paused: false });
  assert.equal(c.people[0].pubkey, ANUSHKA);
  assert.deepEqual(c.people[0].agents, [COFFEE]);
  assert.equal(c.people[0].until, null);
  assert.equal(c.limits.hour, 7);
  assert.equal(c.limits.day, 40);
  assert.equal(c.limits.total, 100);
  assert.equal(c.ask.public, true);
  assert.equal(core.normalizeConfig({ agents: { [COFFEE]: true } }).agents[COFFEE].channels.length, 0);
});

test("bad saved data falls back to safe defaults", () => {
  const c = core.normalizeConfig({ agents: { nothex: { channels: [] } }, people: [{ pubkey: "x" }], limits: { hour: -3 } });
  assert.deepEqual(c.agents, {});
  assert.deepEqual(c.people, []);
  assert.equal(c.limits.hour, 5);
});

test("only Claude, Codex, Goose and Pi agents on this computer can be shared", () => {
  assert.equal(core.supportOf({ type: "buzz.claude-code/claude", place: "here" }).ok, true);
  assert.equal(core.supportOf({ type: "buzz.codex/codex", place: "here" }).ok, true);
  assert.match(core.supportOf({ type: "buzz.builderlab/kiwi", place: "hosted" }).reason, /Builderlab agents aren't supported/);
  assert.match(core.supportOf({ type: "buzz.mesh/qwen", place: "here" }).reason, /Shared compute agents aren't supported/);
  assert.match(core.supportOf({ type: "buzz.claude-code/claude", place: "elsewhere" }).reason, /another of your devices/);
  assert.equal(core.supportOf({ type: "someone.custom/bot", place: "here" }).ok, false);
});

test("grants: channel members, added people, end dates and pauses", () => {
  const now = 10 * DAY;
  const c = core.normalizeConfig({ agents: { [COFFEE]: { channels: [TEAM] } }, people: [{ pubkey: OMAR, name: "Omar", agents: [COFFEE], until: now + DAY }] }, now);
  assert.equal(core.grantFor(c, COFFEE, ANUSHKA, TEAM, now).via, "channel");
  assert.equal(core.grantFor(c, COFFEE, ANUSHKA, "elsewhere", now), undefined);
  assert.equal(core.grantFor(c, COFFEE, OMAR, "elsewhere", now).via, "person");
  assert.equal(core.grantFor(c, COFFEE, OMAR, "elsewhere", now + 2 * DAY), undefined, "access ends on its own");
  assert.equal(core.grantFor({ ...c, paused: true }, COFFEE, ANUSHKA, TEAM, now), undefined);
  assert.equal(core.grantFor({ ...c, agents: { [COFFEE]: { channels: [TEAM], paused: true } } }, COFFEE, ANUSHKA, TEAM, now), undefined);
  assert.equal(core.grantFor(c, hex(9), ANUSHKA, TEAM, now), undefined, "unshared agents are never woken");
});

test("ask-first rules for public, big and unknown channels", () => {
  const c = core.emptyConfig();
  assert.equal(core.askReason(c, { visibility: "public", members: [] }), "public");
  assert.equal(core.askReason(c, { visibility: "private", members: Array(21).fill("x") }), "big");
  assert.equal(core.askReason(c, { visibility: "private" }), "unknown");
  assert.equal(core.askReason(c, undefined), "unknown");
  assert.equal(core.askReason(c, { visibility: "private", members: ["a", "b"] }), undefined);
  assert.equal(core.askReason({ ...c, ask: { public: false, big: false, unknown: false } }, { visibility: "public" }), undefined);
});

test("limits: hourly per person, daily per agent, daily total", () => {
  const c = core.normalizeConfig({ limits: { hour: 2, day: 3, total: 4 } });
  const counters = core.createCounters();
  const t = 5 * DAY;
  core.countUse(counters, COFFEE, ANUSHKA, t);
  core.countUse(counters, COFFEE, ANUSHKA, t + 1);
  assert.equal(core.limitHit(c, counters, COFFEE, ANUSHKA, t + 2), "hour");
  assert.equal(core.limitHit(c, counters, COFFEE, OMAR, t + 2), undefined);
  core.countUse(counters, COFFEE, OMAR, t + 3);
  assert.equal(core.limitHit(c, counters, COFFEE, OMAR, t + 4), "day");
  assert.equal(core.limitHit(c, counters, COFFEE, ANUSHKA, t + core.HOUR_MS + 5), "day");
  const reloaded = core.createCounters(JSON.parse(JSON.stringify(counters.toJSON(t + 5))));
  assert.equal(reloaded.count("t", DAY, t + 6), 3, "counts survive a restart");
  assert.equal(reloaded.count("t", DAY, t + DAY + 10), 0, "and expire after a day");
});

test("activity keeps metadata only and ages out", () => {
  let list = core.addActivity([], { who: ANUSHKA, agent: COFFEE, channel: TEAM, result: "ok", text: "secret question" }, 1000);
  assert.equal(list[0].text, undefined, "never stores what was asked");
  assert.equal(list[0].result, "ok");
  list = core.addActivity(list, { who: OMAR, result: "held" }, 1000 + 31 * DAY);
  assert.equal(list.length, 1, "older than 30 days is dropped");
});

test("requests are not duplicated", () => {
  const one = core.addRequest([], { eventId: "e1" });
  assert.equal(core.addRequest(one, { eventId: "e1" }).length, 1);
  assert.equal(core.addRequest(one, { eventId: "e2" }).length, 2);
});

test("offline gaps, end labels and npubs", () => {
  assert.equal(core.offlineGap(undefined, 1000), undefined);
  assert.equal(core.offlineGap(0, 60_000), undefined);
  assert.deepEqual(core.offlineGap(0, 10 * 60_000), { from: 0, to: 600_000 });
  assert.equal(core.endsLabel(null), "Until you stop");
  const noon = new Date(2026, 10, 25, 12).getTime();
  assert.equal(core.endsLabel(noon + 3 * core.HOUR_MS, noon), "Today");
  assert.equal(core.endsLabel(noon + DAY, noon), "Tomorrow");
  assert.equal(core.endsLabel(noon + 7 * DAY, noon), "In 7 days");
  const npub = "npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg";
  assert.equal(core.toPubkey(npub), "7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e");
  assert.equal(core.toPubkey("npub1bad"), undefined);
  assert.match(core.howTo("Coffeehead", { hour: 5 }), /@Coffeehead/);
});
