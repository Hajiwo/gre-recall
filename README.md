# Recall

A React/Vite vocabulary review application with local browser persistence.
Due words are grouped into fixed batches of up to 30. Search, dictionary lookup,
word notes and activity statistics sit alongside the review workflow.

## Design

Scheduling is a deterministic seven-stage transition table (10m → 30m → 2h →
6h → 1d → 2d → 5d), not a trained memory model or SM-2 implementation.
Pure scheduling functions accept timestamps for deterministic tests.
State versions migrate existing records while adding activity and note fields.
Progress is stored in localStorage; there is no account or cloud synchronization.
Dictionary lookup uses the external Free Dictionary API.

## Run

```sh
npm ci
npm start
npm test
npm run build
```

The public repository includes a small illustrative word list. Replace
`public/words.json` with your own JSON array of strings for actual study.
The original personal word list and raw source CSV are not included.
The existing scheduler initializes up to the first 1050 words at the 10-minute
stage; remaining words start unlearned. This is an explicit product assumption.
For a subdirectory deployment, configure Vite's base path; word loading uses it.
