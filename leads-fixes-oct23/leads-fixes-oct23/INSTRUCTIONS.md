# Leads Distribution — Fix Pack (Oct 18 ke plan ki implementation)
Tayyar: Oct 23, 2026 · Repo: HarisMemoon/leads-platform

Ye wohi fixes hain jo hum ne Oct 18 ko deep-dive mein nikale thay. Har file
poori ki poori replace karni hai — koi manual line-editing nahi. Verification
meri taraf se ho chuki hai: API typecheck mein meri files clean (5 errors jo
aati hain wo purani unrelated spec files mein pehle se hain), aur
`ping.service.spec.ts` ke 3/3 tests pass hain — duplicate-rejection wala test
ab shared service se guzar kar pass hota hai.

---

## Kya fix hua

**1. Duplicate check ab har darwaze par ek jaisa hai (sab se bara bug)**
Nayi shared file `lead-dedup.service.ts` — ping wali purani `findDuplicateLead`
logic (phone OR email OR address+zip, metadata match, case-insensitive) ab
yahi ek jagah rehti hai, aur:
- `ping.service.ts` — ping/post/direct teeno ab isi ko call karte hain (andar
  wrapper rakha hai, call sites same).
- `inbound.service.ts` — `/inbound/lead` par PEHLE koi check nahi tha; ab
  duplicate par **409 Conflict** milta hai: `{ error: "duplicate_lead",
  duplicate_lead_id, message }`. Lead banti hi nahi — na distribution chalti
  hai, na outbound ping.
- `admin-ingestion.service.ts` (CSV) — duplicate row **fail** hoti hai,
  batch ke failed_rows mein ginti aur failure sample mein reason:
  `duplicate_lead: matches existing lead <id>`. Ek hi CSV ke andar wali
  duplicate rows bhi pakri jati hain (rows ek ek karke save hoti hain).
- Admin MANUAL entry (`POST /admin/leads`) ko **nahi chhera** — wahan
  soft-flag (`duplicate_of_lead_id` + Duplicates tab) pehle se tha, waisa hi hai.

**2. Vendor auth header ek naam**
Standard ab `x-vendor-api-key` hai — inbound endpoints bhi yehi lete hain.
Purana `x-vendor-key` inbound par ab bhi accept hota hai (fallback) taake koi
live vendor integration na toote. API docs page bhi update kar di hai.

**3. Batch = thin wrapper (documented)**
`/inbound/leads` aur CSV dono sequential loop hi thay — code mein wazeh
comment laga diya hai: batch = N sequential single ingestions, koi atomicity
nahi, per-item results. Duplicate ab per-item reject hota hai, is liye batch
response mein accepted/rejected ka hisaab saaf nazar ayega.

**4. CSV ka naam "Bulk Import"**
Admin console ke ingestion tab ke labels badal diye (title, upload heading,
button, history) — functionality same, sirf naam.

**5. My Leads metrics wala lifecycle bug**
`leads.service.ts` mein dono jagah jahan purchase par assignment banti hai
(buyLead + manual buy), `lifecycle_phase: 'new'` likha tha jabke frontend
`'open'` gin raha tha — is liye metrics zero aati theen. Dono `'open'` kar
diye hain. Ye fix sirf NAYI purchases par lagega — purani rows ke liye neeche
wali SQL ek dafa chalani hai.

## Decisions jo maine Oct 18 wale plan ke mutabiq rakhe hain
- **Duplicate policy = hybrid** (vendor paths hard reject, admin manual soft-flag).
- **Batch endpoints rakhe hain, drop nahi kiye** — plan yahi tha (wrappers),
  kyunke drop karne se vendor integrations toot'ti hain.
Agar in dono mein se koi faisla badalna hai to bata dena — chhota sa alag
patch bana dunga, poora pack dobara nahi banana parega.

---

## Files — har file ko repo mein bilkul isi path par replace karo

| # | File | Note |
|---|------|------|
| 1 | `apps/api/src/leads/lead-dedup.service.ts` | **NAYI file** — bas is path par rakh do |
| 2 | `apps/api/src/ping/ping.service.ts` | replace |
| 3 | `apps/api/src/ping/ping.module.ts` | replace |
| 4 | `apps/api/src/ping/ping.service.spec.ts` | replace (test file — constructor update) |
| 5 | `apps/api/src/inbound/inbound.service.ts` | replace |
| 6 | `apps/api/src/inbound/inbound.controller.ts` | replace |
| 7 | `apps/api/src/inbound/inbound.module.ts` | replace |
| 8 | `apps/api/src/admin/admin-ingestion.service.ts` | replace |
| 9 | `apps/api/src/admin/admin.module.ts` | replace |
| 10 | `apps/api/src/leads/leads.service.ts` | replace (sirf 2 lines badli hain: 'new' → 'open') |
| 11 | `apps/web/src/app/api-docs/page.tsx` | replace (header naam) |
| 12 | `apps/web/src/app/(dashboard)/admin/console/tabs/ingestion/IngestionTab.tsx` | replace (labels) |

Koi nayi dependency nahi, koi env var nahi, koi migration nahi.

## Ek SQL — Supabase SQL editor mein, sirf ek dafa (purani rows ke liye)

```sql
UPDATE lead_assignments
SET lifecycle_phase = 'open'
WHERE lifecycle_phase = 'new';
```

(seed file `seed-leads.ts` mein bhi 'new' hai — wo sirf demo data hai, use
chhor do.)

## Test checklist (tum apne paas yehi try karna)

1. **My Leads metrics:** ek lead buy karo → My Leads ke counters ab zero
   nahi, count aana chahiye.
2. **Inbound duplicate:** same phone/email metadata ke saath `POST
   /inbound/lead` do dafa bhejo (header `x-vendor-api-key`) → pehli dafa
   201, doosri dafa **409** `duplicate_lead` + `duplicate_lead_id`. Purana
   `x-vendor-key` header bhi bhej kar dekho — wo bhi chalega.
3. **Batch:** `POST /inbound/leads` mein 1 fresh + 1 duplicate lead → total
   2, accepted 1, rejected 1, results mein per-item wajah.
4. **Bulk import:** admin console → Add Leads tab → headings "Bulk Import"
   nazar ayengi. CSV mein ek duplicate row daal kar upload karo → row failed
   mein `duplicate_lead: matches existing lead ...` reason ke saath.
5. **Ping/post regression:** `/vendor/ping` duplicate par pehle ki tarah
   rejected `duplicate_lead` — behavior same hai. Aur `npm test` chala kar
   `ping.service.spec.ts` confirm kar lena (mere paas 3/3 pass hai).

Koi cheez atak jaye to error ka screenshot bhej dena — usi file ko dekh kar
bata dunga.
