# Teqo

[![Version](https://img.shields.io/badge/version-0.5.0-purple)](https://github.com/franciscosolla/teqo)
[![License](https://img.shields.io/github/license/franciscosolla/teqo?color=blue)](LICENSE)
[![Live App](https://img.shields.io/badge/demo-live-success)](https://teqo.app)
[![Design System](https://img.shields.io/badge/design-Figma-blueviolet)](https://www.figma.com/design/cdSqctVxKmW6ujcba09bzt/Mycelia?node-id=0-1&p=f&t=AX5JHTBaMtKcPEt4-0)

> A self-custodial, multi-chain, multi-account crypto wallet built with clarity, flow, and dignity.

---

## Vision

Teqo is a Web3 wallet for **intentional digital ownership**. We build for:

- **Clarity** — Simplicity over cleverness, transparency over obfuscation
- **Flow** — Seamless cross-chain, cross-account, cross-context experiences
- **Dignity** — Empathy for users, no fear-based UX, no predatory patterns

---

## Features

- **Multi-chain support**: Ethereum, Solana, Bitcoin
- **Multi-account management**: Create, import, and watch wallets
- **Account types**:
  - **Owned**: Generated from mnemonic phrase, fully controlled
  - **Watched**: Import addresses for observation only
  - **Connected**: Link via WalletConnect or browser extensions (MetaMask, Phantom)
- **PIN-encrypted seed storage**: AES-GCM encryption with Argon2id key derivation
- **Mobile-first, responsive design**

---

## Tech Stack

### Web App (`apps/web`)

- **Framework**: Next.js 15, React 19
- **Styling**: Tailwind CSS v4
- **State**: Zustand, TanStack Query, wagmi
- **Chains**: viem, @solana/web3.js, bitcoinjs-lib
- **Wallet Connectivity**: WalletConnect v2, MetaMask, Phantom
- **Data**: Alchemy, DeFiLlama

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
│   ├── web/        # Main wallet app (Next.js)
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
git clone https://github.com/franciscosolla/teqo.git
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

> Design System: [Figma](https://www.figma.com/design/cdSqctVxKmW6ujcba09bzt/Mycelia?node-id=0-1&p=f&t=AX5JHTBaMtKcPEt4-0)

---

## About

Created by [Francisco Solla](https://solla.dev).

Teqo is a long-term exploration of intentional digital ownership and wallet UX design.

---

## License

MIT
