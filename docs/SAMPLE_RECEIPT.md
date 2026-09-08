# Sample receipt analysis

Institution: **Shri Lalitamba Pattina Souharda Sahakari Ltd, Gadag**  
Document: Fixed Deposit Receipt (same form, two interest modes)

The app is **one institution only**. Receipts use this printed certificate. What changes is the **interest line** and whether maturity value equals principal.

| File | FD-A/c | Mode | Principal | Maturity | Period |
| --- | --- | --- | --- | --- | --- |
| `samples/receipts/lalitamba-fd-01FD40599.jpg` | 01FD40599 | Monthly → MS A/c | ₹1,50,000 | ₹1,50,000 | 3 years |
| `samples/receipts/lalitamba-fd-01FD32450.jpg` | 01FD32450 | **On maturity** | ₹4,50,000 | ₹6,97,500 | 5 years |

Both belong to CID **1700** / VIKRAM A MULGUND.

---

## Shared form

```
SHRI LALITAMBA PATTINA SOUHARDA SAHAKARI LTD, GADAG
NEAR GANESH TEMPLE VIVEKANAND ROAD-GADAG
                 FIXED DEPOSIT RECEIPT

Received with thanks from Sri/Smt  <NAME>                    CID: <n>
<address>                                                    FD-A/c No: 01FD*****

The Sum of Rs. <amount>/-  ( <words> )
as Fixed Deposit on FD Date: DD-MM-YYYY for a Period of N Years
@ the Rate of Interest 11.00 %

This Deposit receipt is issued subject to the rules ...

<INTEREST LINE — see variants below>
Maturity Value <amount>/-      Date of Maturity DD-MM-YYYY
Nominee Name : <name>   Relationship : <rel>

Print Date: DD-Mon-YYYY HH:MM:SS     Transaction Date: DD-MM-YYYY
```

Watermark (Kannada/English + orange star). Footer: “Non Transferable”, CEO/Manager signature, purple stamp.

The printed label is sometimes misspelled **`Maturtiy Value`**. The extractor must accept that typo.

---

## Variant A — Monthly (01FD40599)

```
Interest Rs. 1375/- Monthly CR To MS A/c :01003MS001396
Maturity Value 150000/-
```

- `interest_mode = monthly`
- Store `monthly_interest_amount = 1375` and `interest_credit_account = 01003MS001396`
- Maturity value **equals** principal (interest already paid out each month)
- Check: `150000 × 11% / 12 = 1375`

Nominee: AMRUTMATI VIKRAM MULGUND / wife  
Dates: FD + Txn 26-05-2025, print 26-May-2025 16:12:32, maturity 25-05-2028

---

## Variant B — On maturity (01FD32450)

```
Interest Mode : On Maturity
Maturtiy Value 697500/-
Date of Maturity 23-10-2028
```

- `interest_mode = on_maturity`
- **No** monthly amount, **no** MS A/c — those columns stay null
- Maturity value **exceeds** principal
- This society is using **simple interest** to maturity:  
  `450000 + 450000 × 11% × 5 years = 697500`
- Not compound: `(1.11)^5 × 450000 ≈ 7,58,276` — do not use that as the check

Nominee: SHAKUNTALA A MULGUND / Mother  
Dates: FD + Txn 25-10-2023, print 25-Oct-2023 16:10:05, maturity 23-10-2028 (5 years minus 2 days)

This file was a phone photo in a plastic sleeve (HEIF/JPEG). Expect glare, sleeve reflections, and slight skew on real uploads. Convert HEIF → JPEG on the client before Storage/OCR.

---

## Fields (both variants)

| Printed label | Stored as | Type | Monthly sample | On-maturity sample |
| --- | --- | --- | --- | --- |
| Sri/Smt … | `holder_name` | text | VIKRAM A MULGUND | same |
| address | `holder_address` | text | Mulgund Complex… | same |
| CID | `bank_customer_id` | text | 1700 | 1700 |
| FD-A/c No | `fd_account_no` | text | 01FD40599 | 01FD32450 |
| The Sum of Rs. | `principal_amount` | numeric | 150000 | 450000 |
| words | `principal_amount_words` | text | One Lakh Fifty… | Four Lakh Fifty… |
| FD Date | `fd_date` | date | 2025-05-26 | 2023-10-25 |
| Period | `tenure_*` + `tenure_label` | int + text | 3 years | 5 years |
| Rate of Interest | `interest_rate_pct` | numeric | 11 | 11 |
| Interest line | `interest_mode` | enum | monthly | on_maturity |
| Interest Rs. / Monthly | `monthly_interest_amount` | numeric | 1375 | **null** |
| MS A/c | `interest_credit_account` | text | 01003MS001396 | **null** |
| Maturity / Maturtiy Value | `maturity_value` | numeric | 150000 | 697500 |
| Date of Maturity | `maturity_date` | date | 2028-05-25 | 2028-10-23 |
| Nominee / Relationship | `nominee_*` | text | Amrutmati / wife | Shakuntala / Mother |
| Print Date | `print_at` | timestamptz | 2025-05-26 16:12:32 | 2023-10-25 16:10:05 |
| Transaction Date | `transaction_date` | date | 2025-05-26 | 2023-10-25 |

Also keep the **raw interest line** on `ocr_runs.extracted_fields` so we can debug new wordings (`Quarterly CR To…`, etc.).

---

## What this means for the product

**Two products on one form.** The dashboard must mix them:

| | Monthly FD | On-maturity FD |
| --- | --- | --- |
| Cash during the term | Printed ₹/month into MS A/c | None |
| What comes back on maturity | Principal only | Principal + simple interest |
| “Total maturity value” | ≈ sum of principals (for these FDs) | Includes locked-in interest |
| Monthly income card | Include | Exclude (show ₹0 / —) |

Useful dashboard totals:

- Principal outstanding (all active FDs)
- **Total maturity value** (now meaningful — on-maturity FDs pull this up)
- **Monthly interest income** (sum of printed monthly amounts only)
- Interest locked until maturity (on-maturity: `maturity_value − principal`)
- Maturing in 30 / 90 days

**CID still links people.** Both samples are CID 1700.

**FD-A/c No is unique** per family (`01FD40599`, `01FD32450`).

**Maturity date** is usually FD date + period minus 1–2 days. Warn only if the gap is more than two days.

---

## OCR: easy vs fragile

| Field | Reliability | Notes |
| --- | --- | --- |
| Name, CID, FD-A/c, principal, rate, period, FD date | High | Same on both slips |
| Nominee + relationship | High | Different people/relationships already seen |
| Print / transaction dates | High | Two date formats: `25-10-2023` and `25-Oct-2023 16:10:05` |
| Maturity value | High | Must match label `Maturity` **or** `Maturtiy` |
| **Interest line** | Medium | Two shapes; stamp/sleeve can hide it |
| Address / amount in words | Medium | Watermark, “Thousands” spelling |

Interest-line mapper:

```
Rs. 1375/- Monthly CR To MS A/c :01003MS001396
  → monthly / 1375 / 01003MS001396

Interest Mode : On Maturity
  → on_maturity / null / null
```

Also accept (not seen yet, still parse): `Quarterly CR To MS A/c :…`, `Half Yearly`, `Yearly`.

---

## Validation on the verify screen

1. Detect mode from the interest line first; do not assume monthly.
2. **Monthly:** `monthly_interest_amount ≈ principal × rate / 12 / 100` (warn if off by more than ₹1). Maturity ≈ principal is **normal**.
3. **On maturity:** monthly amount and MS A/c should be empty.  
   Expected maturity ≈ `principal + principal × rate% × tenure_years` (simple interest).  
   Sample: `450000 + 450000 × 0.11 × 5 = 697500`. Warn if off by more than ₹1.  
   Do **not** use compound interest as the check.
4. `maturity_date ≈ fd_date + tenure` (allow ±2 days).
5. `fd_account_no` like `01FD32450` — warn if it does not match `/\d{2}FD\d+/`, do not block.
6. Suggest the family member whose CID matches.

OCR is still never auto-saved.

---

## Renewals

These two samples are **separate** FDs (they overlap in calendar time). A real renewal will look like the same form with a **new** `FD-A/c No` after the old maturity date.

When that happens: photograph the new slip, run the same OCR, and link `previous_fd_id → new_fd_id`. The old row stays (status `renewed`) so you can still open the old receipt.

If you **break** the FD mid-term (or withdraw at maturity without rolling over), use **Close**: date + amount the bank paid. No new certificate. The old receipt stays; status becomes `closed`. `is_premature` is true when `closed_on` is before the printed maturity date.

---

## More samples that would help

Nice to have, not required for Phase 1:

- Quarterly / half-yearly payout (if the society prints those)
- A monthly slip where the stamp misses the interest line
- A more skewed or darker phone photo
