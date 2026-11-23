# Teammate access

A [Buzz](https://github.com/block/buzz-app) plugin that lets the people you choose
talk to your agents by @mentioning them in a channel.

## Why it exists

In Buzz, an agent that runs on your computer (Claude, Codex, Goose or Pi) answers
only its owner. That's deliberate: the agent runs commands on your computer, as you,
with your account or API key.

Teams often want one well-set-up agent that everyone can ask. This plugin opens a
narrow, controlled path for that without changing Buzz itself:

- You choose **which agents** are shared.
- You choose **who** can reach them: everyone in channels you pick, plus people you
  name.
- You set **how much** they can use them: hourly and daily limits.

When an allowed person @mentions a shared agent, the plugin wakes the agent in the
thread of their message, and it answers them there. There's no workflow and no extra
message in the channel.

## How it works

Buzz plugins can start one of their owner's agents with `ctx.agents.wake`. Buzz
allows this because a plugin you installed counts as your own code. The plugin:

1. Watches the community for messages that @mention an agent you shared.
2. Checks that the sender is allowed. Either they posted in a channel you granted, or
   you approved them by name.
3. Checks the limits.
4. Wakes the agent in the thread of that message, and tells it who asked.
5. Gives shared agents standing limits for these requests: no revealing secrets or
   credentials, deleting files, pushing code, spending money or changing accounts.
   If a request needs any of that, the agent says its owner must ask directly.

### Who can reach an agent

- **Channels (recommended).** In a private channel only members can post, and the
  relay enforces that. Channel membership is the permission: people who join are
  covered automatically, and people who leave lose access.
- **Approved people.** For individuals outside those channels, added by public key
  (hex or `npub`). A public key is an ID, not a secret.

You're never limited by the plugin: you talk to your own agents directly, as usual.

## Install

In Buzz (desktop), go to **Settings → Plugins → Manage plugins**:

- **From a Git repository:** enter this repository's URL. For a private repository,
  use the SSH form (`git@github.com:<org>/<repo>.git`). Buzz uses your own GitHub
  SSH key, so you need read access to the repository. Private HTTPS URLs don't work,
  because Buzz ignores Git credential helpers.
- **From a folder:** unzip a release and choose the `teammate-access` folder.

New installs start disabled. Enable the plugin, then open **Teammate access** from
the Messages sidebar.

## Set up

1. Under **Agents**, turn on an agent and tick the channels whose members may talk
   to it.
2. Optional: under **Approved people**, add individuals.
3. Check **Limits** (below).

## Limits and warnings

Every request someone else sends runs on **your** computer and uses **your**
Claude credits. The plugin protects you in four ways:

| Protection | Default | What it does |
| --- | --- | --- |
| Per person, per agent | 10 an hour | One person can't drain an agent. |
| Per agent, everyone together | 50 a day | Caps your total spend per agent. |
| Reach count | shown | Each agent shows how many people can use it. |
| Confirmation | on | Granting a channel that's **public**, has **more than 20 members**, or has an **unknown member count** asks first, and says how many people that is. |

Requests that hit a limit are logged on the plugin's Status panel and not passed on.
Your own messages never count toward the limits.

### Things to know before sharing

- **Agents run as you.** Anyone with access can make a shared agent run commands on
  your computer and use your account. The safety limits are instructions to the
  agent, **not a hard block**. Share only with people you trust, and prefer agents
  whose workspace is a dedicated folder.
- **Public channels.** Anyone in the community can join a public channel, so
  granting one opens the agent to the whole community.
- **Only while you're online.** Agents answer only while your computer is on and
  Buzz is open. Messages sent while you're offline aren't answered later.
- **Channels only.** Direct messages to your agent never reach your app.
- **Settings are local.** Settings and limit counters are saved on your computer
  only. Counters reset when Buzz restarts.
- **Plugin API.** `ctx.agents.wake` is documented but not yet frozen, so a future
  Buzz release could change it.
- **Buzz version.** The plugin needs Buzz desktop v1.0.2 or later for standing
  instructions. On older versions it sends the limits with each request instead.

## Updates

The manifest declares `"updates": { "defaultEnabled": true }`. Installed from Git,
Buzz checks for new commits at startup and hourly while it's open, then offers
**Update and reload**. If an update asks for more access, Buzz asks you to review
it first. Turn checks off in the plugin's actions menu.

## Files

- `manifest.json`: the plugin's ID, name and update settings.
- `plugin.js`: the plugin. Plain JavaScript, no build step, no dependencies.

## Changelog

- **v3:** reach count per agent, a confirmation for large, public or unknown-size
  channels, a daily budget per agent, and Git update checks.
- **v2:** access by channel, plus an hourly limit per person.
- **v1:** access by approved people (allowlist).

## License

[MIT](LICENSE)
