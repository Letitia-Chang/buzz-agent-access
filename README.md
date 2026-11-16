# Teammate access

Let other people talk to your Buzz agents by @mentioning them in a channel.

## Getting started

1. In Buzz, go to Settings → Plugins and install this plugin, either with
   **From Git repo** or **Load from folder**. Then enable it.
2. Open **Teammate access** from the page navigation in the Messages sidebar.
3. Under **Agents**, turn on an agent (for example Coffeehead) and tick the
   channels whose members may talk to it.
4. Optional: under **Approved people**, add individuals by public key (hex or
   npub). They can talk to your enabled agents in any channel you share.
5. Optional: set the hourly limit per person (default 10).

Anyone allowed can then @mention the agent. It replies in a thread under their message.

## How access works

- **Channels (recommended):** in a private channel, only its members can post,
  and the relay enforces that. Membership is the permission, so people who join
  are covered automatically and people who leave lose access. Public channels
  are flagged because anyone in the community can join them.
- **People:** for individuals outside those channels.
- Buzz lets only a local agent's owner start it. This plugin wakes the agent with
  `ctx.agents.wake` instead, which Buzz allows because a plugin you install counts
  as your own code. It also gives those agents standing limits for these requests.

## Limits

- Works with Claude, Codex, Goose and Pi agents running on this computer, and only
  while Buzz is open here. Messages sent while you're offline aren't answered later.
- Channels only. DMs to your agent never reach your app.
- You talk to your agent directly as usual.
- Settings are saved on this computer only.
- Anyone with access can make the agent run commands on this computer as you and
  use your account. The limits are instructions to the agent, not a hard block.
