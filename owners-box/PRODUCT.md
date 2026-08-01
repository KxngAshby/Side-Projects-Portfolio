# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary audiences are co-equal:

- **Franchise owners / GMs** in invite-only friends leagues who want to run a salary-cap team through a real NFL season (offers, payroll, lineups, trades).
- **Commissioners** who open and run the league desk (invite codes, market windows, trade approvals) without holding a roster.

## Product Purpose

Owner's Box is invite-only salary-cap franchise fantasy. Owners shop free agency with public contract offers under an $800 cap, set ESPN-style lineups, and score against the real NFL (ESPN Half-PPR) — not a snake draft. Success means every waiver, cut, and offer feels like a payroll decision.

## Positioning

Fantasy football with GM payroll mechanics: short game-based contracts tied to live form/OVR, public bidding, uncapped franchise seats, and commissioner trade oversight. Neighboring snake-draft apps do not make cap and contract length the weekly decision surface.

## Operating Context

- Used on phone and desktop browsers during NFL preseason and regular season.
- League state is cloud-backed (Cloudflare D1); one invite = one live room across devices.
- NFL data via ESPN public scoreboard / box scores (Sync NFL / Auto sync).
- Shareable concept brief at `/pitch` for group chats.
- Official production app: https://app.franchisefantasy.workers.dev

## Capabilities and Constraints

- Uncapped claimed franchises + commissioner seat (no roster).
- Access: email sign-in; league invite for owners; creator account is commissioner; multi-league hub.
- Salary cap $800; defense purchased as one D/ST unit.
- FA windows: initial FA last week of NFL preseason, freezes 3 days before kickoff, reopens in-season for leftover cap.
- Contract term by live OVR: 90+ → 1G, 80–89 → 2G, 70–79 → 3G, ≤69 → 4G. Signed deals stay; form changes next FA/re-sign ask.
- Lineup: QB, 2RB, 2WR, TE, FLEX, K, D/ST.
- Trades: both owners agree, commissioner approves or vetoes.
- Scoring: ESPN Half-PPR; no simulated weeks.
- Stack: Next.js on Cloudflare Workers (OpenNext) + D1 shared league snapshots.

## Brand Commitments

- Product display name: **Owner's Box**
- Official production URL: **https://app.franchisefantasy.workers.dev** (Cloudflare Workers; worker name `app` under the `franchisefantasy` workers.dev subdomain)
- Repo / working folder may still say `franchise-football`; that is not the public brand
- Voice: GM / ownership desk — direct, payroll-real, not autodraft casual

## Evidence on Hand

- App UI and rules copy in `src/`, especially AccessGate, AppShell, `/pitch`
- One-pager: `ONEPAGER.md`, `Franchise-Football-One-Pager.html`, route `/pitch`
- README ruleset in `README.md`
- No customer testimonials, press, or licensed brand imagery on hand — do not invent them

## Product Principles

1. Cap and contracts are the game — every market action should feel like payroll.
2. Real NFL weeks only — scores and week roll follow ESPN’s slate, not a sim button.
3. Invite-only trust — owners and commissioner share codes; seats are claimed, not anonymous free-for-all.
4. Owner and commissioner are both first-class — desk tools must not bury the GM experience, and vice versa.
5. Demo honesty — browser-local leagues are fine to try; never claim shared multiplayer until it ships.
