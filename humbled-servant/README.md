# Humbled Servant

**Live:** https://humbled-servant.pages.dev  
**Source:** [KxngAshby/Humbled-Servant](https://github.com/KxngAshby/Humbled-Servant)

Visual proof of concept for a Dallas–Fort Worth **reserved** black-car chauffeur brand — marketing site plus a stubbed booking path. Not rideshare.

## What shipped (PoC)

- Quiet sanctuary look: charcoal + warm ivory, abstract dusk atmosphere
- Marketing inventory: Home, About, Services, Our vehicle, How it works, For business, Contact
- Multi-step reserve: Airport / Local / Hourly → details → who → packages → pay now/later stubs
- Confirmation + trips stub (guest lookup by confirmation number; localStorage)
- Design direction locked via wayfinder map before build (`spec.md` in source repo)

## Stack

Vite · React · TypeScript · React Router · Cloudflare Pages · Satoshi (Fontshare)

## Honest limits

- No real payments, auth, or backend
- Sample prices are illustrative placeholders
- English-only; Spanish marked “coming soon”
