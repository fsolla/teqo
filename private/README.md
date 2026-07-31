# private/ (local only)

This directory is gitignored except for this README.

Put field recordings, transcripts, session notes, operational spreadsheets,
and other campaign-sensitive material here so **local** agents can collaborate
without publishing them to the public GitHub repository.

## Rules

- **Local agents:** write sensitive discovery/field docs under `/private/`. Never
  commit audio, raw transcripts, operational spreadsheets, or notes with real
  names / vote deltas / interview verbatim into the public tree. Publish only a
  cleaned public version under `docs/` when cloud agents need the context.
- **Cloud agents:** clones do **not** include `/private/`. Base work on the
  public-clean docs (e.g. `docs/CUSTOMER.md`). If a task would produce a
  sensitive deliverable, **report it in chat** and do **not** commit it — ask
  the human to save it under `/private/` on a local checkout.
- Do not `git add` anything under this folder other than this README.

## Layout (examples)

- `private/customer/` — full customer/discovery notes
- `private/plans/` — observed-session notes
- `private/general-coordinator-interview/` — interview audio
- `private/transcribe/` — transcripts / diarization
- `private/sheets/` — operational vote-projection spreadsheets
