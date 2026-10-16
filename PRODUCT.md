# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Fixed by the supplied build prompts: React + TypeScript + Vite + Tailwind (frontend), Express + TypeScript + drizzle + Neon Postgres + ethers v6 (backend), deployed on Netlify as a static site plus one function. (Inferred from the brief; no interview held.)

## Users
- Registrar: a land registry officer who registers properties and documents and approves ownership transfers.
- Owner: a property owner who views their properties, proves document authenticity, requests transfers.
- Public: anyone (buyer, bank, lawyer) who checks a document by its fingerprint, without logging in.

## Product Purpose
Curb land and property document fraud. Only the SHA-256 fingerprint of each document, the property code and an owner reference go on an Ethereum (Sepolia) contract. Documents and personal data stay in PostgreSQL. Anyone can verify a document as authentic, revoked or not found. This is a final-year school project.

## Positioning
Verification happens in the browser: the file never leaves the device, only its fingerprint is checked against the chain.

## Capabilities and Constraints
Roles: registrar, owner, public. Files .pdf/.png/.jpg/.jpeg up to 4 MB. No mock data in the UI. Browser never talks to the chain. Testnet only.

## Brand Commitments
Professional, trustworthy, calm, like a government registry, not a crypto site. Deep green primary, soft neutral surfaces; green = authentic/confirmed, amber = pending/processing, red = revoked/failed/not found.

## Evidence on Hand
No real customers, testimonials or statistics exist. Nothing may be fabricated.

## Product Principles
1. The verdict (authentic, revoked, not found) is always stated in words as well as colour.
2. Privacy is visible: say what stays on the device and what goes on the chain.
3. Chain delays are normal: pending is a first-class state with a clear next action.
4. Every error names the problem and the recovery.
