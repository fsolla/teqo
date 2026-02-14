# Teqo

Teqo starts as the official digital platform for **deputado Jorge Solla** and evolves into a **white-label civic engagement platform** for politicians in Brazil.

The goal is to help political teams build direct, durable relationships with their base without depending on Big Tech social platforms as the primary channel.

## Mission

- Strengthen direct communication between representatives and citizens.
- Reduce platform dependency risk by owning audience and data channels.
- Provide reusable building blocks so each political team can launch quickly.

## Product Direction

### Phase 1: Jorge Solla Website

Initial delivery focuses on Jorge Solla's public website and communication workflows:

- Public-facing content and updates
- Institutional pages and biography
- Media and campaign communication assets
- Editorial operations through Payload CMS

### Phase 2: White-Label Platform

Teqo then becomes a configurable base product for other politicians in Brazil:

- Multi-tenant and reusable architecture
- Brand and content customization per mandate/campaign
- Shared core modules for communication and engagement
- Operational autonomy with self-hosted owned channels

## Local Development

1. Copy environment variables: `cp .env.example .env`
2. Install dependencies: `pnpm install`
3. Start development server: `pnpm dev`
4. Open: `http://localhost:3000`

## Tech Stack

- Payload CMS
- Next.js
- PostgreSQL (via `@payloadcms/db-postgres`)
- TypeScript

## Roadmap Notes

- Prioritize audience ownership and portability of data.
- Keep modules generic enough for reuse across different political contexts.
- Default to secure, access-controlled features for campaign and institutional teams.
