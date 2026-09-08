# Receipt fixtures

Real family certificates used to design OCR:

- `lalitamba-fd-01FD40599.jpg` — monthly interest to an MS account
- `lalitamba-fd-01FD32450.jpg` — interest mode **On maturity**

They contain names, address, CID, FD accounts, and (on the monthly slip) an MS account. Keep this repository private. Remove these files from git history before making the repo public.

Expected extraction is in `docs/SAMPLE_RECEIPT.md` and the JSON fixtures:

- `lalitamba-fd-01FD40599.expected.json` / `.gemini.json`
- `lalitamba-fd-01FD32450.expected.json` / `.gemini.json`

`.gemini.json` is messy model output (Sri/Smt, `150000/-`, `Maturtiy Value`). The mapper, not Gemini, is the source of truth for the interest line.
