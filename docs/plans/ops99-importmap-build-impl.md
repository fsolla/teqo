# OPS99: Generate importMap during build with dummy S3\_\* envs

## 1. Reading of intention

**Problem:** The committed `importMap.js` loses the `S3ClientUploadHandler` entry when regenerated without S3*\* envs, causing the admin to go blank in production (class OPS69/OPS72/OPS73). The current guard mechanism (CI check + unit pin) catches drift but requires manual regeneration with dummy S3*\* envs.

**Goal:** Eliminate the committed importMap as the source of truth for the S3 upload handler. Instead, generate it during the Docker build with dummy S3\_\* envs, so the production image always has the correct entry.

**Key insight:** The importMap is a build artifact, not source code. It should be generated at build time with the same environment the production image will run in.

## 2. Recommended approach

### Primary approach: Generate importMap in Dockerfile builder stage

**Steps:**

1. **Dockerfile builder stage:** Add `pnpm generate:importmap` with dummy S3\_\* envs BEFORE `next build`
2. **Retire unit pin:** Remove `tests/unit/importMapS3UploadHandler.unit.spec.ts`
3. **Simplify CI guard:** Update `scripts/check-importmap-s3.mjs` to verify the builder generates correctly (not that committed file matches)
4. **Dev/worktree predev:** Add a predev hook that generates importMap if missing or stale
5. **Update docs:** Remove "rode generate:importmap" from AGENTS.md, add new contract

### Options considered and rejected

| Option                                       | Why rejected                                                        |
| -------------------------------------------- | ------------------------------------------------------------------- |
| **Keep committed importMap + improve guard** | perpetuates the drift problem; guard catches but doesn't prevent    |
| **Generate in CI only**                      | dev/worktrees still need the file; adds CI dependency for local dev |
| **Generate in next.config.js**               | Payload's generate:importmap is a CLI command, not a Next.js plugin |
| **Store importMap in S3**                    | overengineering; the file is small and deterministic                |

## 3. Verifiable phases

### Phase 1: Dockerfile builder stage (production fix)

**Files to modify:**

- `Dockerfile`: Add S3\_\* dummy envs and generate:importmap step

**Changes:**

```dockerfile
# In builder stage, before next build:
RUN --mount=type=secret,id=database_url,env=DATABASE_URL \
  --mount=type=secret,id=payload_secret,env=PAYLOAD_SECRET \
  S3_BUCKET=build-dummy \
  S3_ENDPOINT=http://127.0.0.1:3900 \
  S3_ACCESS_KEY_ID=build-dummy \
  S3_SECRET_ACCESS_KEY=build-dummy \
  NEXT_OUTPUT_STANDALONE=1 \
  NODE_OPTIONS="--no-deprecation --max-old-space-size=8000" \
  pnpm exec payload generate:importmap && \
  pnpm exec next build
```

**Verification:**

- Build Docker image locally: `docker build --target builder .`
- Check `src/app/(payload)/admin/importMap.js` contains S3ClientUploadHandler
- Deploy to homeserver and verify admin loads

### Phase 2: Retire unit pin and update CI guard

**Files to modify:**

- Delete: `tests/unit/importMapS3UploadHandler.unit.spec.ts`
- Modify: `scripts/check-importmap-s3.mjs`

**Changes to guard script:**

- Remove the "regenerate and diff against committed" logic
- Instead, verify that the committed importMap is NOT required for production
- Or: remove the guard entirely since the builder now generates correctly

**Verification:**

- Run `pnpm test:unit` (should pass without the deleted test)
- Run CI checks (guard should pass or be removed)

### Phase 3: Dev/worktree predev hook

**Files to modify:**

- `package.json`: Add `predev` script
- Create: `scripts/predev-importmap.mjs` (or add to existing `scripts/dev.mjs`)

**Changes:**

```json
{
  "scripts": {
    "predev": "node scripts/predev-importmap.mjs"
  }
}
```

The predev script should:

1. Check if `src/app/(payload)/admin/importMap.js` exists
2. If missing or stale (compare mtime with payload.config.ts), regenerate with dummy S3\_\* envs
3. Use the same dummy values as the CI guard

**Verification:**

- Delete importMap.js, run `pnpm dev` → file should be regenerated
- Modify payload.config.ts, run `pnpm dev` → file should be regenerated

### Phase 4: Documentation updates

**Files to modify:**

- `AGENTS.md`: Update "rode generate:importmap" rule
- `docs/AGENT-OPS.md`: Update if present

**New contract:**

- ImportMap is generated at build time (Docker) and dev time (predev hook)
- Never commit importMap.js to repo (add to .gitignore)
- CI guard can be removed or simplified to verify builder works

## 4. Rabbit holes / out of scope

### Rabbit holes (avoid)

1. **Trying to make Payload auto-generate importMap** - This would require modifying Payload core, out of scope
2. **Moving S3 config to runtime** - The gating is intentional; keep it
3. **Changing the S3 storage plugin** - Only the importMap generation changes
4. **Modifying the deploy script** - The builder stage handles it now

### Out of scope

- Changing how Payload generates the importMap (internal to Payload)
- Modifying the S3 storage plugin behavior
- Changing the media collection configuration
- Updating the CI pipeline beyond the guard removal

## 5. Risks and mitigation

| Risk                                     | Impact                           | Mitigation                                                          |
| ---------------------------------------- | -------------------------------- | ------------------------------------------------------------------- |
| **Builder fails to generate importMap**  | Admin breaks in production       | Keep committed importMap as fallback in .gitignore (not tracked)    |
| **Dev predev hook slows startup**        | Developer experience             | Only regenerate if file missing or stale (check mtime)              |
| **Dummy S3\_\* envs cause side effects** | Unexpected behavior during build | Use clearly dummy values; Payload's generator doesn't connect to S3 |
| **ImportMap generation order matters**   | Build fails                      | Generate BEFORE next build (as planned)                             |

## 6. Engineering acceptance

### Acceptance criteria

1. **Production image** has correct importMap with S3ClientUploadHandler
2. **Admin loads** in production without manual importMap regeneration
3. **Dev workflow** auto-generates importMap when needed
4. **CI checks** pass (guard either updated or removed)
5. **No committed importMap** in git history (add to .gitignore)

### Verification steps

1. `docker build --target builder .` succeeds and generates importMap
2. `pnpm dev` generates importMap if missing
3. `pnpm test:unit` passes (without deleted test)
4. Deploy to homeserver: admin loads correctly
5. `git status` shows importMap.js as untracked (in .gitignore)

### Decision quality self-score: 4/5

- **Caro vs barato:** Deliberate about what's expensive to reverse (committed importMap vs generated)
- **Form:** Options considered, recommendation clear
- **Appetite:** Respects the intention's scope (build-time generation)
- **Depth check:** Reuses existing `generate:importmap` script, no shallow pass-throughs
- **Rabbit holes:** Named explicitly (Payload core, S3 plugin changes)
