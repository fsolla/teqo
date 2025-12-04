# Teqo

[![Version](https://img.shields.io/badge/version-0.5.0-purple)](https://github.com/fsolla/teqo)
[![License](https://img.shields.io/github/license/fsolla/teqo?color=blue)](LICENSE)
[![Live App](https://img.shields.io/badge/demo-live-success)](https://my.teqo.app)
[![Landing Page](https://img.shields.io/badge/landing-teqo.app-blue)](https://teqo.app)
[![Design System](https://img.shields.io/badge/design-Figma-blueviolet)](https://www.figma.com/files/team/1523753106972410398/project/412193540/Teqo)

> A fully self-custodial, multi-chain crypto wallet built with clarity, flow, and dignity.

**🔐 Your keys, your crypto.** Teqo never has access to your private keys or seed phrase. Everything is generated and encrypted locally on your device.

---

## Vision

Teqo is a Web3 wallet for **intentional digital ownership**. We build for:

- **Clarity** — Simplicity over cleverness, transparency over obfuscation
- **Flow** — Seamless cross-chain, cross-account, cross-context experiences
- **Dignity** — Empathy for users, no fear-based UX, no predatory patterns

---

## Features

- **Fully self-custodial**: Your seed phrase never leaves your device
- **Multi-chain support**: Ethereum, Solana, Bitcoin
- **Multi-account management**: Create, import, and watch wallets
- **Account types**:
  - **Owned**: Generated from mnemonic phrase, fully controlled by you
  - **Watched**: Import addresses for observation only
  - **Connected**: Link via WalletConnect or browser extensions (MetaMask, Phantom)
- **Client-side encryption**: AES-GCM encryption with Argon2id key derivation
- **Mobile-first, responsive design**

---

## Security Model

Teqo is **100% self-custodial**:

| What                   | Where                            |
| ---------------------- | -------------------------------- |
| Seed phrase generation | Client only (browser)            |
| Private key derivation | Client only (browser)            |
| Seed phrase encryption | Client only (AES-GCM + Argon2id) |
| Encrypted seed storage | Client only (localStorage)       |

**The server never receives:**

- Your seed phrase (encrypted or plaintext)
- Your private keys
- Your PIN

The API server only handles public data: token metadata, price feeds, and optional email for notifications.

---

## Tech Stack

### Wallet App (`apps/wallet`) — Active

- **Framework**: Vite, Preact
- **Styling**: Tailwind CSS v4
- **State**: Zustand, TanStack Query
- **Chains**: viem, @solana/web3.js, @scure/btc-signer
- **PWA**: vite-plugin-pwa

### Legacy Web App (`apps/web`) — Reference Only

- **Framework**: Next.js 15, React 19
- **Styling**: Tailwind CSS v4
- **State**: Zustand, TanStack Query, wagmi

### API Server (`apps/api`)

- **Framework**: Express.js
- **Database**: PostgreSQL via Prisma ORM
- **Caching**: Redis
- **Auth**: JWT + email verification

### Landing Page (`apps/landing`)

- **Framework**: Next.js 15
- **Styling**: Tailwind CSS v4

---

## Project Structure

```
teqo/
├── apps/
│   ├── wallet/     # Main wallet PWA (Vite, Preact) ← Active development
│   ├── web/        # Legacy reference code (Next.js)
│   ├── api/        # Backend server (Express)
│   └── landing/    # Marketing site (Next.js)
├── packages/       # Shared utilities
├── docs/           # Project documentation
└── turbo.json      # Monorepo config (Turborepo)
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL (for API)
- Redis (for API)

### 1. Clone & Install

```bash
git clone https://github.com/fsolla/teqo.git
cd teqo
npm install
```

### 2. Environment Setup

Copy the example files and fill in your values:

```bash
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
```

**Required for `apps/web`:**

- `NEXT_PUBLIC_ALCHEMY_API_KEY` — [Get one at Alchemy](https://www.alchemy.com/)
- `NEXT_PUBLIC_REOWN_PROJECT_ID` — [Get one at Reown](https://cloud.reown.com/)

**Required for `apps/api`:**

- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `ALCHEMY_API_KEY` — Same as above
- `RESEND_API_KEY` — [Get one at Resend](https://resend.com/)
- `JWT_SECRET` — Generate with `openssl rand -base64 32`

### 3. Database Setup (API only)

```bash
cd apps/api
npx prisma generate
npx prisma migrate dev
```

### 4. Run Development

```bash
# Run all apps
npx turbo run dev

# Or run individually
npm run dev --workspace=apps/web      # http://localhost:3000
npm run dev --workspace=apps/api      # http://localhost:4000
npm run dev --workspace=apps/landing  # http://localhost:3001
```

---

## Design Philosophy

- **Mobile-first**: Optimized for thumb-reach on mobile devices
- **Right-hand ergonomics**: Controls positioned for comfortable one-handed use
- **Progressive disclosure**: Complexity revealed as needed, not all at once
- **Security with empathy**: Clear explanations, no fear-based UX

> Design System: [Figma Project](https://www.figma.com/files/team/1523753106972410398/project/412193540/Teqo)
>
> - [Web App Design](https://www.figma.com/design/cdSqctVxKmW6ujcba09bzt/App)
> - [Landing Page Design](https://www.figma.com/design/iACOa0lkV3nTXsadNWNS4t/Landing)

---

## About

Created by [Francisco Solla](https://solla.dev).

Teqo is a long-term exploration of intentional digital ownership and wallet UX design.

---

## License

AGPL-3.0
