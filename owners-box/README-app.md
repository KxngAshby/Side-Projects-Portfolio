# Owner's Box

Invite-only salary-cap franchise fantasy — contract offers, commissioner trade oversight, manual lineups, and ESPN Half-PPR scoring tied to the real NFL season.

## Rules

- **Uncapped franchises** + a **commissioner seat** (no roster). Invite creates a new team slot.
- **Access:** email sign-in, then create/join a **cloud league** with an invite code. Creator is commissioner. Joining auto-locks after regular-season Week 1 kickoff; commissioner can set a hard cutoff or reopen.
- **One-pager:** `/pitch` — shareable concept brief for group chats.
- **Salary cap** `$800` per team.
- **Player pool** = every **active-roster** fantasy player from ESPN (QB/RB/WR/TE/K across all 32 teams) + 32 team defenses. Auto-loads on open; refresh from Free Agency.
- **Free agency / contract offers** — public bidding. **Initial FA** opens the **last week of NFL preseason**, freezes **3 days before kickoff**, then **reopens in-season** for leftover-cap shopping. Placing an offer notifies the league. Unresolved boards settle when the **NFL week goes final** (Sync NFL), or the commissioner closes early. Commissioner can force open/closed.
- **Defense** is purchased as a **whole unit** (one per team).
- **Contracts (games)** by live OVR: **90+ → 1G**, **80–89 → 2G**, **70–79 → 3G**, **≤69 → 4G**. Active deals stay as signed; form only changes the **next** FA/re-sign.
- **Live OVR + pricing** — ESPN has no Madden rating; we track form after weeks. Hot stretch (e.g. 85→90) shortens and raises the next deal; cold stretch does the opposite.
- **Lineups** — set QB, 2RB, 2WR, TE, FLEX, K, D/ST each week (ESPN-style). **Each player locks at their NFL kickoff** (TNF included). **Weekly hard lock Saturday 11:59 PM America/Chicago** freezes everyone else until the week finals/unlock. Free agency stays open for next-week shopping. **Empty slots score 0** (no silent auto-fill, no fine) — CapBar and Lineup page call out incompletes.
- **No simulated weeks** — **Sync NFL** / **Auto sync** pulls ESPN’s public scoreboard + box scores; fantasy weeks roll when the NFL slate is final.
- **Auto sync (smart):** ~90s while games are LIVE, ~15–30m approaching kickoff / idle, pauses when the tab is hidden.
- **Injuries:** ESPN injury tags (Q / Doubtful / Out / etc.) show on FA, Lineup, and Roster; owned-player status changes land in the league feed.
- **Trades** — both teams agree, then commissioner approves or vetoes.
- **Scoring** — ESPN **Half-PPR**.
- **Playoffs** — After **Week 14**, top **4** by record (then points for) play semis in **Week 15** (`1v4`, `2v3`) and the championship in **Week 16**. Winner is the Owner's Box champion.
- **Cuts** — Only the **unplayed** contract value can be refunded. **35%** of that remaining value is a penalty; you get the other **65%** back as spend room. Dead money (`salary − refund`) stays on the books and **burns evenly over the leftover contract games** as each fantasy week finalizes.
- **Roster size** — **16** active players max (starters + bench). **2 IR slots** for Out / IR / PUP / Suspension — frees an active spot; **full salary still counts**. IR players cannot start until activated.

## Live

Official app: https://app.franchisefantasy.workers.dev

## Run

```bash
cd Documents/Coding/franchise-football
npm run dev
```

Deploy:

```bash
npm run deploy
```

League state lives in Cloudflare D1 (shared live room). Sign in with an email code; seats are tied to your account. Multi-league hub at `/leagues`.

## Stack

Next.js · TypeScript · Tailwind CSS · ESPN public NFL APIs · Cloudflare Workers (OpenNext) · D1

## Auth email (production)

Until `RESEND_API_KEY` + `AUTH_FROM_EMAIL` are set, login responses include a `devCode` (`AUTH_DEV_MODE=1`) so you can test without email delivery.
