# Teqo - Self-Custodial Web3 Wallet

**Status:** Startup in Prototype Phase

---

## 🔐 Self-Custodial by Design

**Teqo is fully self-custodial.** Your seed phrase and private keys never leave your device.

- Seed phrases are generated client-side using industry-standard BIP-39
- Private keys are derived locally and never transmitted
- Encryption happens entirely in the browser (AES-GCM + Argon2id)
- The server has zero access to your funds

**You are in complete control. Always.**

---

## 🚀 Mission & Vision

**Vision:**  
To empower individuals with **intentional ownership**, **multi-chain coordination**, and **user autonomy** in the digital world.  
Teqo exists to make digital ownership accessible, clear, and empowering, for both Web3 natives and newcomers, by offering an experience rooted in clarity, security, and human-centered design.

**Philosophy:**

- **Self-custodial first**: your keys, your crypto, no exceptions.
- Focused on **intentional ownership**: not speculative hype or financial gaming.
- **Chain-agnostic** and **identity-aware**: digital ownership is fluid and personal.
- Inspired by **Cypherpunk values**: privacy, autonomy, freedom.
- UX and technical transparency are core values: **clarity over cleverness**.
- Dedicated to making Web3 approachable for non-technical users through **education, simplicity, and trust-building**.

---

## 🔍 Summary

**Teqo** is a fully self-custodial Web3 wallet and digital asset manager.  
It enables users to manage **tokens, NFTs, domains, credentials** and more, across Ethereum, Solana, and Bitcoin, through a **clean, human-centered interface**.

Teqo serves:

- Web3 natives who want a more intentional, less extractive wallet.
- Web3 newcomers who want to explore **without fear or confusion**.

**Current focus:**  
PWA wallet app (`apps/wallet`) using Vite + Preact, optimized for mobile.  
The Next.js app (`apps/web`) is kept as legacy reference code only.

---

## 🧑‍🤝‍🧑 Team

**Francisco Solla**  
Founder, Fullstack Engineer  
Focus: Web3 integration, frontend architecture, UX, system design

**Glauber Farias**  
Co-Founder, Marketing & Strategy  
Focus: Market research, storytelling, positioning, campaign execution

---

## 🎯 Strategic Goals (2025)

- Deliver shareable Web MVP by July–August.
- Build and retain early adopter community, with special attention to **non-technical users**.
- Validate UX through real-world usage and feedback.
- Position Teqo as a **credible, user-first Web3 wallet** by Web Summit Lisbon.

---

## 🧑‍🎨 UX & Design Principles

- **Clarity & Simplicity** → clear language, intuitive flows, no jargon without explanation.
- **Guided Experience** → contextual help, progressive disclosure of complexity.
- **Transparency & Feedback** → always show users what is happening and why.
- **Security with Empathy** → reinforce trust through design, reduce fear in sensitive flows.
- **Onboarding as Education** → provide confidence-building, not just screens to click through.
- **Delight & Flow** → use micro-interactions and animations to make Teqo _feel_ intentional and alive.

---

## 🧱 Core Features, Web MVP

- **Wallet Creation, Import, Connect**: multi-chain  
   → Guided flows with clear education on key concepts (seed phrase, private key, best practices).
- **Asset Display**: tokens and NFTs on Ethereum, Solana, Bitcoin  
   → With educational snippets where helpful.
- **Account Keyring**: multi-profile wallet management.
- **Responsive Layout**: mobile-first and desktop ready.
- **Future-Ready**: architecture prepared for swaps and on/off-ramp integration.

---

## 🗓 Roadmap (2025)

| Date          | Milestone                                                                         |
| ------------- | --------------------------------------------------------------------------------- |
| **July**      | Mobile web MVP: wallet flows + asset display → private testing with close circle. |
| **August**    | Desktop web complete → expand testing to extended circles.                        |
| **September** | On/off-ramp and swap → public launch + marketing campaign.                        |
| **October**   | First 100 users.                                                                  |
| **November**  | First 200 users → showcase Teqo at Web Summit Lisbon.                             |

---

## 🧑‍💻 Tech Stack

### 🌐 Web App

- React, Next.js, Tailwind CSS, Storybook
- React Query, Zustand, Reown
- Ethereum: wagmi, viem
- Solana: @solana/web3.js
- Bitcoin: bitcoinjs-lib
- Data: Alchemy, DeFiLlama

### 🛠 Server

- Node.js, Express

---

## 🔗 Project Links

- **Live Prototype:** [teqo.app](http://teqo.app)
- **Code Repository:** [github.com/fsolla/teqo](http://github.com/fsolla/teqo)
- **Figma Design:** [Teqo Design on Figma](https://www.figma.com/files/team/1523753106972410398/project/412193540/Teqo)
  - [Web App](https://www.figma.com/design/cdSqctVxKmW6ujcba09bzt/App)
  - [Landing Page](https://www.figma.com/design/iACOa0lkV3nTXsadNWNS4t/Landing)

---

## 📌 Areas for further exploration

- **User Personas** → especially **Crypto-Curious Newcomer** and **Web2 Casual Investor**.
- **Onboarding UX** → detailed mapping of flows and educational touchpoints.
- **Content Strategy** → key Web3 concepts to explain, tone of voice, delivery mechanisms.
- **Measuring Onboarding Success** → define UX KPIs (completion rates, confidence metrics, time to first action).

---

## Closing Note

Teqo is not a wallet for everyone, it is a wallet for those who seek **intentional, sovereign ownership** of their digital assets.  
**Flow, clarity, and dignity** in the experience matter as much as the code.  
Every design and product decision must be aligned with this principle.
