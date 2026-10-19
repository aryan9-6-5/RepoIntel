# Cross-file context A/B (live, 2026-10-19, 4 runs per fixture)

Fixtures (two guessable from names alone, two that genuinely need the imported file): xfile-discount, xfile-find, xfile-index, xfile-units. Re-run: `node scripts/eval-context.mjs`.

| Fixture | Run | Without context | With imported file as context |
|---------|-----|-----------------|-------------------------------|
| xfile-discount | 1 | hit (1f) | hit (1f) |
| xfile-discount | 2 | hit (1f) | hit (1f) |
| xfile-discount | 3 | hit (1f) | hit (1f) |
| xfile-discount | 4 | hit (1f) | hit (1f) |
| xfile-find | 1 | hit (1f) | hit (1f) |
| xfile-find | 2 | hit (1f) | hit (2f) |
| xfile-find | 3 | hit (1f) | hit (1f) |
| xfile-find | 4 | hit (1f) | hit (1f) |
| xfile-index | 1 | hit (3f) | hit (2f) |
| xfile-index | 2 | hit (1f) | hit (4f) |
| xfile-index | 3 | hit (1f) | hit (2f) |
| xfile-index | 4 | hit (1f) | hit (2f) |
| xfile-units | 1 | hit (1f) | hit (1f) |
| xfile-units | 2 | hit (2f) | hit (2f) |
| xfile-units | 3 | hit (1f) | hit (1f) |
| xfile-units | 4 | MISS (0f) | hit (1f) |

## Measured
- Localization without context: 15/16 (94%); precision 17/18 (94%)
- Localization with context: 16/16 (100%); precision 23/24 (96%)

## Limits
Four tiny synthetic cross-file bugs (n=16 per arm; one extra hit is within noise) written by the project author; one-hop imports only; results from a non-deterministic model. Shows whether context can help, not by how much on real code. Context adds prompt tokens (up to 3 files x 120 lines) per analysis, which counts against the free Groq quota.
