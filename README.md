# Teammate access

Let teammates you choose talk to your agents by @mentioning them in a channel.

## Getting started

1. Settings → Plugins → **Load from folder**, choose this `teammate-access`
   folder, then **Install plugin** and enable it.
2. Open **Teammate access** from the page navigation in the Messages sidebar.
3. Under **Agents**, tick the agents teammates may talk to (for example Coffeehead).
4. Under **Approved teammates**, add each person's name and public key (hex or npub).
5. A teammate @mentions the agent in a channel you are both in. The agent replies in
   a thread under their message.

## How it works

Buzz lets a local agent start only for its owner. This plugin watches for
mentions of the agents you ticked by the teammates you approved, and wakes the
agent in that message's thread with `ctx.agents.wake`. Buzz lets plugins do
this because a plugin you install counts as your own code. It also gives those
agents standing instructions limiting what they do for teammates.

## Limits

- Works with Claude, Codex, Goose and Pi agents that run on this computer, and only
  while Buzz is open here.
- Channels only. A teammate's DM to your agent is never seen by your app.
- Your agent still answers you directly, so leave yourself off the list.
- Settings are saved on this computer only.
- Approved teammates can make the agent run commands on this computer as you and use
  your account. The safety limits are instructions to the agent, not a hard block.
