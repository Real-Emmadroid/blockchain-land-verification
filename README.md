# Land Verification System

Blockchain-based land and property document verification. The registrar registers properties and documents; only each
document's SHA-256 fingerprint, the property code and an anonymous owner reference (`USR-<id>`) go on an Ethereum
(Sepolia) contract. Files and personal data stay in PostgreSQL (Neon). Anyone can verify a document in the browser.

## Run locally
1. Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `JWT_SECRET`, `CHAIN_RPC_URL`, `OPERATOR_PRIVATE_KEY`.
2. `npm install`, then `npm run dev` (http://localhost:3000).
3. Sign in as `registrar@example.com` / `Registrar123!`, click **Set up blockchain contract** on the dashboard
   (needs Sepolia test ETH in the operator wallet), then register a property.

## Deploy on Netlify
Set the same four variables under Site configuration > Environment variables (mark the key, secret and database URL as secret).
`netlify.toml` already builds the site and routes `/api/*` to the function.
Netlify functions time out after 10 s by default (up to 26 s in site settings), so set `CHAIN_WAIT_SECONDS` to 8 on
the default limit. Slower confirmations stay "pending" and finish with the Refresh / Check status buttons.

## Other
- `npm run db:clean-demo` removes the seeded demo owners that own nothing.
- Never commit `.env` or the operator private key. The wallet is for test coins only.
