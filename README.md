# Agent Access

A [Buzz](https://github.com/block/buzz-app) plugin that lets your teammates
@mention the agents running on your computer, in channels you choose or one by
one, with limits you set.

> **Works with Claude, Codex, Goose and Pi agents running on this computer, only
> while Buzz is open. Shared compute and Builderlab agents aren't supported.**
> They run somewhere else, so a plugin on your computer can't reach them.
> Direct messages to your agent aren't passed on yet.

(Formerly *Teammate access*. Since 4.1 the plugin ID is `letitia.agent-access`.
Settings saved by older versions are carried over the first time 4.1 opens.)

## Why it exists

In Buzz, an agent on your computer answers only its owner. That's deliberate: it
runs commands on your computer, as you, with your account or API key. Teams still
want one well-set-up agent that everyone can ask. Agent Access opens a narrow,
controlled path for that without changing Buzz:

- You choose **which agents** are shared.
- You choose **who** can ask: everyone in channels you pick, and people you add
  for a set time.
- You set **how much**: hourly, daily and total limits.
- You stay **in charge**: anyone else who asks becomes a request you approve,
  answer once or dismiss.

## What's on the page

Open **Agent Access** from the sidebar. It has six tabs:

| Tab | What you do there |
| --- | --- |
| **Overview** | See requests waiting for you, today's or this week's usage, and your shared agents. Each agent has a ⋯ menu: edit who can ask, change limits, pause it, copy a how-to, or stop sharing. |
| **Share an agent** | Four steps: pick an agent (unsupported ones are greyed out with the reason), pick channels and people, set limits, review and share. Public channels and channels over 20 people are flagged and need an "I understand". |
| **People** | Requests, everyone who can ask and when their access ends, and **Add a person** for 1 day, 1 week, 30 days or until you stop. |
| **Activity** | Who asked which agent, where and when, and what happened: answered, held by a limit, asked you, not delivered, or came in while you were away. **What people asked is never stored here.** |
| **Limits & alerts** | The three limits, "ask me first" rules, and alerts. |
| **Settings** | Version, which agents can be shared, copy or clear activity, and **Stop sharing everything**. |

**Pause all sharing** is always in the header. While paused, nobody else can use
your agents, and their mentions are held, not answered.

## In Buzz

- **Requests as notices.** When someone without access asks, Buzz shows a notice
  with *Give access for 1 week*, *Answer once* and *Dismiss*. You can also handle it
  on the page.
- **Channel menu.** Right-click a channel and choose **Share an agent here…** to
  open the share steps with that channel ticked.
- **Notifications.** An alert when an agent nears its daily limit (once a day), and
  a summary after 6 pm. "Every answer" is off by default.
- **Checked delivery.** On newer Buzz, each message is handed over only if sharing
  is still on at that moment, and the result is recorded in Activity.
- **While you were away.** If Buzz was closed, a banner says when. Mentions from
  that time (up to 24 hours) wait as requests. They're never answered
  automatically.

Every one of these is feature-detected. On an older Buzz the plugin still works,
and the requests simply wait on the page.

## Limits

| Limit | Default | What happens when it's hit |
| --- | --- | --- |
| Per person, each hour | 5 | That person's mentions are held. |
| Per agent, each day | 50 | That agent's mentions are held. |
| All agents, each day | 100 | Everything is held until tomorrow. |

Counters are saved, so restarting Buzz doesn't reset them.

**Ask me first** (all on by default): public channels, channels with more than 20
people, and channels whose members the plugin can't check. Mentions there become
requests even when the channel is shared.

## Things to know before sharing

- **Agents run as you.** Anyone with access can make a shared agent run commands on
  your computer and use your account. The safety rules given to the agent (no
  secrets, no deleting files, no pushing code, no spending money, no changing
  accounts) are instructions, **not a hard block**. Share with people you trust,
  and prefer agents whose workspace is a dedicated folder.
- **Public channels** can be joined by anyone in the community.
- **Settings and activity stay on this computer.** Requests keep the question until
  you handle them, so you can decide. Activity keeps only metadata, for 30 days.
- **Plugin API.** Buzz says to treat every plugin API as unstable, so a future Buzz
  release could break something. Updates to this plugin will follow.

## Install

In Buzz (desktop), go to **Settings → Plugins → Manage plugins**:

- **From a Git repository:** this repository's SSH URL
  (`git@github.com:Letitia-Chang/agent-access.git`). Buzz uses your GitHub
  SSH key, so you need read access.
- **From a folder:** unzip a release and choose the folder.

New installs start disabled. Enable the plugin, then open **Agent Access**.

**Coming from Teammate access (v1 to v4.0)?** The plugin ID changed in 4.1, so Buzz
sees it as a new plugin. In **Manage plugins**, remove the old *Teammate access*
entry, then add `git@github.com:Letitia-Chang/agent-access.git`. Your channels,
people, limits and activity carry over.

## Updates

`"updates": { "defaultEnabled": true }` makes Buzz check for new commits at
startup and hourly, then offer **Update and reload**.

## Developing

Buzz loads one file, `plugin.js`, so the source lives in `src/` and is joined by a
small build script:

```sh
npm install        # test tools only; the plugin has no dependencies
npm run build      # src/*.js + art/*.svg → plugin.js
npm test           # 21 tests: rules, limits, requests, delivery, channel menu
```

- `src/core.js`: settings, sharing rules, limits and activity. No Buzz services,
  so it's tested directly.
- `src/runtime.js`: watching mentions, requests, notices, notifications, channel
  menu, and the "while you were away" check.
- `src/ui.js`: the page, in design A: a beige page with rounded cards, two-tone
  titles and mono `{001}` tags. It follows Buzz's theme with a beige light palette and
  an espresso dark one.
- `art/`: illustrations from [Open Peeps](https://openpeeps.com) and
  [Open Doodles](https://opendoodles.com) by Pablo Stanley (CC0), shown on white
  "paper" so they read in dark mode.

## Changelog

- **v4.1:** renamed everywhere to Agent Access (plugin ID `letitia.agent-access`,
  repository `agent-access`), with older settings carried over. The page is redesigned
  in design A: beige cards, a big usage number, and folder tabs for each shared agent.

- **v4 (Agent Access):** a new name and page. Requests from people without access,
  with Give access, Answer once and Dismiss, also as Buzz notices. People can be
  added for a set time. Pause everything or one agent. A third limit (daily total)
  and saved counters. "Ask me first" rules. Activity with results, metadata only. A
  channel menu item, near-limit and daily-summary alerts, checked delivery, a "while
  you were away" banner, and unsupported agents shown with the reason. Settings
  from v1 to v3 carry over.
- **v3:** reach count per agent, a confirmation for large, public or unknown-size
  channels, a daily budget per agent, and Git update checks.
- **v2:** access by channel, plus an hourly limit per person.
- **v1:** access by approved people (allowlist).

## License

[MIT](LICENSE). Illustrations in `art/` are CC0.
