# Customer

> **Public-clean version.** Field recordings, raw transcripts, named actors, and operational vote deltas live only under `/private/` on local checkouts (gitignored). Cloud agents: use this document; if a task would produce sensitive deliverables, report them in chat and do not commit them.

## Kernel (day-to-day)

- **Who:** the General Coordinator of a federal-deputy campaign in Bahia (~45 days, scarce resources, information scattered across WhatsApp / spreadsheets / memory). Job: one shared, current operational picture so limited effort goes to the right territories and people.
- **Mental model (observed use):** **Action → Place → Who** — never entity-first. The coordinator does not scroll by instinct; an invisible confirmation (Save / Approve) means the action was not completed; a fragmented form means abandonment.
- **Relative reading of the board:** **% of the candidate’s own vote** (concentration of own capture) is the hard priority criterion — absolute statewide % is an anti-metric. Projected floor is on the order of prior-cycle performance with a stretch target above it.
- **Threat #1:** friendly fire inside the same party (a co-religionist ahead). Real team channel: WhatsApp 1:1 without dated audit trail.
- **Dominant constraint:** “legs” / field structure, not money.
- **Competence anxiety** (“I can’t handle the tool”) is the worst emotional problem — the product must give a sense of control, not only data.

---

## Job Statement

When I am coordinating a statewide federal-deputy campaign across dozens of Bahia municipalities in roughly 45 days, with scarce resources and information scattered across advisors and local leaderships, I want a shared, current operational picture so I can put limited effort into precise mobilization instead of reconciling WhatsApp, spreadsheets, and memory.

(PT, field language:)
Quando preciso coordenar uma campanha de deputado federal pelo estado da Bahia — votos e estrutura em dezenas de municípios, ~45 dias, pouco recurso, informação espalhada entre assessores e lideranças — quero enxergar o mesmo quadro operacional e agir no território/pessoas certas sem caçar atualizações, para transformar esforço limitado em mobilização precisa.

## Job Dimensions

| Dimension  | Description                                                                                                                                        | Where the app underdelivers today                                                                                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional | See municipalities (predefined territories), base, declared-vs-estimated votes, and agenda in one place; record updates and decide the next action | Entity-first screens invert the **Action → Place → Who** model; discovery requires scroll; confirmations invisible; fragmented forms. Hit: filtered “no advisor” lists × prior-cycle votes. Jargon still blocks. |
| Emotional  | Feel in control and trust that the picture is current                                                                                              | **Worst today.** Competence anxiety (“I can’t see / handle it”), not only stale data. Without action-first flows, Little Hire does not start.                                                                    |
| Social     | Be seen as serious, aligned coordination                                                                                                           | Real work still “wins” on WhatsApp; tool users can look bureaucratic while informal channels set the pace                                                                                                        |

## Competing Alternatives

| Alternative                              | Why hired today                           | Weakness                                          |
| ---------------------------------------- | ----------------------------------------- | ------------------------------------------------- |
| WhatsApp groups / 1:1                    | Fast, everyone is already there           | Fragments; no analysis; useful history disappears |
| Spreadsheets (projection maps)           | Flexible; one advisor’s “source of truth” | Divergent versions; weak on phone                 |
| Notebook / memory / phone calls          | Zero tool friction                        | Doesn’t scale; doesn’t share                      |
| Other campaign platforms (past attempts) | Promise of a single system                | Team stops updating → stale data → abandonment    |
| Non-consumption                          | Avoids another login                      | Burns the 45-day window                           |

## Big Hire vs Little Hire

| Moment      | What it is here                                        | Status / intervention                                                                   |
| ----------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Big Hire    | First login, trust the system enough to start          | Mitigated offline: in-person onboarding; seed initial data when needed                  |
| Little Hire | Come back and update so the shared picture stays alive | **Primary leak.** Past tools died here. Reduce emotional cost of “updating again today” |

## Forces of Progress

| Force   | Notes                                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------------------- |
| Push    | Fragmentation; statewide scope; 45-day crunch; cannot follow dynamics by hand                               |
| Pull    | One operational picture; smarter targeting; instrument the team can update; territory dossier before agenda |
| Habit   | WhatsApp + spreadsheet as default — “Zap is the field”; projection sheet is the morning ritual              |
| Anxiety | “If others don’t update, I’m wasting time”; competence anxiety; LGPD / real-data hold; “legs” constraint    |

## Opportunity Solution Tree (sanitized)

```
Outcome: weekly Little Hire
├── O1 I don’t trust others updated → anxiety / abandonment
├── O2 Day’s delta (call/Zap) does not enter the decision queue
├── O3 Jargon + opaque AI block action
├── O4 Updating on phone is slower than voice on Zap
├── O5 “Truth” still lives in the projection spreadsheet
├── O6 Arrive in territory without a dossier
├── O7 Vote gains/losses lack dated / auditable record
├── O8 Team in isolated islands — information does not circulate
├── O9 Action-first mental model vs entity-first UI
├── O10 Discovery must be above-the-fold — no instinctive scroll
└── O11 Invisible confirmation / commit (Save / Approve / Done)
```

**Product direction:** tables = bulk bank management; redesign daily UX as **continuous linear flows**. Observed-session originals: `private/plans/` (local only).

## Leap-of-Faith Assumptions

| Assumption                                          | Type                       | Cheap test                                                  | Success if                                            |
| --------------------------------------------------- | -------------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| Seeded picture + onboarding → returns within 7 days | Desirability / Little Hire | Count logins + ≥1 real update after action-first redesign   | ≥1 spontaneous update in 7 days                       |
| Action queues answer “where do I start?”            | Usability                  | Filtered “no advisor” × prior-cycle votes                   | Finds queue/action without help                       |
| Entity-first “edit where you see” is discoverable   | Usability                  | Observed: editable cells not discovered in free exploration | Opens vote adjust without demo — **FAILED**; pivot O9 |
| Inline glossary / plain language cuts confusion     | Usability                  | Field jargon needed live translation                        | Zero “what is…?” in 2nd session after copy            |

## Discovery method (no raw evidence here)

Field discovery used Mom Test story blocks + observed product use. Full verbatim transcripts, audio, and named operational deltas are **not** in this public tree. Local agents: see `private/customer/CUSTOMER.md`, `private/transcribe/`, `private/general-coordinator-interview/`. Cloud agents: stay on this clean doc; escalate sensitive outputs in chat.

### Validated patterns (safe to build on)

- Priority is **share of the candidate’s own capture**, not local electorate %.
- Leadership value is often political representativeness, not raw vote count.
- Friendly fire (same-party competitor) is the named #1 threat class.
- Channel of truth for day deltas is voice/Zap without dated tool trail — until the product wins Little Hire.
- Dominant constraint named in field: structure/“legs”, with money as instrument — not always the binding constraint.
- Map is briefing/panel, not the daily operating surface; filtered lists for “who is unmonitored” are the observed value hit.
- Tables remain for bulk; day-delta work needs action-first chassis.

## Segments & Best-Fit Customer

- Primary: `coordinator` ("Coordenador Geral"), `candidate` ("Candidato"), and `advisor` ("Assessor") operating `/campanha` under time pressure — advisor scoped to administered municipalities.
- Secondary: `leader` ("Liderança") in the field (PWA) — phone-first supporter contact tool only.
- Out of scope for this improve cycle: public site visitors / donors.

## Links

- Architecture / campaign model: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- Agent ops (incl. `/private/` rules): [`AGENT-OPS.md`](AGENT-OPS.md)
- Local sensitive originals: `private/` (gitignored; local checkouts only)
