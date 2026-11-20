# Scenario 2: Identity Takeover & Fake SMSF Rollover Blocked

> Part of **Wealth Team in a Day** — the AI operations office demo for **Caldova Wealth**.

## Scenario Summary

A request that looks routine, a full-balance rollover to a self-managed super fund (SMSF), turns out to be an identity takeover. The scenario shows:

- an explainable risk score from the Financial Crime Agent
- document authenticity checks with Azure Content Understanding
- the ATO SMSF verification service (SVS)
- an account-activity timeline
- a careful, member-first response

No one is accused. Humans make the block and suspicious matter report (SMR) decisions.

## At a Glance

| Item | Detail |
|---|---|
| Case number | `REQ-20261106-OPS002` |
| Request type | Rollover out to SMSF |
| Received | Fri 6 Nov 2026, 07:52 |
| Priority | Urgent |
| Member | Grace Williams (DOB 22/07/1963, age 63), `CS-1058220` |
| Product | Caldova Super (Select) |
| Balance | $612,400 |
| Requested | Full balance to "GW Family Superannuation Fund" (an SMSF) |
| Outcome | 🛡️ **Blocked**: no money left the account (simulation outcome `rejected`) |
| Neighbourhood zone | Airport — Overseas Trip (Grace) 🛡️ |

---

## Member

**Grace Williams** is a retired school principal from Williamstown.

- She is 63 and on a long-planned trip through Italy. She left Melbourne Airport on 18 Oct 2026, and a travel notice is on file.
- Contact: grace.williams@example.com · verified mobile 0491 570 157 (the number on file **before** the change).
- She is independent and careful, and is rattled when she hears what happened.

> "I'm in Florence — I haven't asked anyone to move my super!"

## Life Event: What Really Happened

| When | What happened |
|---|---|
| Sun 18 Oct 2026 | Grace leaves Melbourne Airport for Italy. Her travel notice is on file. |
| Mon 2 Nov 2026, 10:42 | A caller impersonating Grace phones the contact centre. The caller passes knowledge-based checks using personal data that was likely exposed in a 2025 data breach, and says she "lost her phone overseas". The mobile is changed to 0491 570 158 and the email to grace.w.super@mailbox.example. A change-of-details alert goes to Grace's **old** email, which she doesn't read while travelling. |
| Tue 3 Nov 2026, 21:14 | Online access is registered from a **new device**. The IP address is geolocated to **Sydney**. The MFA code goes to the **new** mobile. |
| Fri 6 Nov 2026, 07:52 | An email request arrives to roll over the **full balance ($612,400)** to the "GW Family Superannuation Fund", about 93 hours after the contact details were changed. The SMSF's ABN was registered on 28 Oct 2026, 9 days earlier. The bank account is in the name "G Williams Holdings Pty Ltd". A driver licence image is attached. |

---

## Request Journey

### 1. Request Received — Onboarding Agent (Olivia)

- The **Onboarding Agent** receives the rollover-out request. It extracts the SMSF name, ABN, electronic service address (ESA), bank BSB and account name, and the amount (the full balance).
- On paper, every field is present.
- Because this is a rollover to an SMSF, the case is tagged for **SMSF verification**.
- It sets the priority to **Urgent**: a full-balance rollover to an SMSF.
- It opens case `REQ-20261106-OPS002` and routes it to Benefits & Eligibility.

---

### 2. Rollover Rules — Benefits & Eligibility Agent (Ben)

- The **Benefits & Eligibility Agent** applies the rollover rules. Before any rollover to an SMSF, the trustee must use the ATO **SMSF verification service (SVS)** (SIS reg 6.33E).
- It checks the SVS result on the case:

| SVS check | Result |
|---|---|
| ABN is a registered SMSF | ✓ Registered (but only since 28 Oct 2026) |
| Member's TFN is linked to the SMSF | ✗ **Not linked** |
| Bank details match | ✗ **Mismatch** |
| ESA matches | ✗ **Mismatch** |

- **Finding:** SMSF validation fails, so the rollover can't proceed. The agent escalates to Financial Crime and cites *SuperStream rollovers, insurance-loss warnings & SMSF verification*.

---

### 3. Financial Crime Review — Financial Crime Agent (Felix)

- The **Financial Crime Agent** scans the documents on the case with **Azure Content Understanding**. The driver licence image is flagged as **tampered**: the font is inconsistent, the date of birth doesn't match the one on file (22 Jul 1963), and the hologram is missing.
- It builds the account-activity timeline and matches what it finds against known indicators published by AUSTRAC and the ATO:

| Indicator | Detail |
|---|---|
| Contact details changed just before a full-balance rollover | The mobile and email were changed on 2 Nov at 10:42. The request to move all $612,400 arrived on 6 Nov at 07:52, about 93 hours later (under 96 hours) |
| New device, unexpected location | A new device logged in from a Sydney IP on 3 Nov at 21:14, while the travel notice says Grace is in Italy |
| MFA sent to the changed number | The one-time code went to the number changed the day before |
| Newly registered SMSF | ABN registered 28 Oct 2026, 9 days before the request. Creating an SMSF to receive stolen benefits is a known pattern |
| SVS mismatch | Grace's TFN is not linked to the SMSF, and the bank details and ESA don't match |
| Tampered ID | The licence shows font and date-of-birth inconsistencies and no hologram |
| Payee name mismatch | The bank account belongs to "G Williams Holdings Pty Ltd", not the member or the fund |

- **Risk score: HIGH.** Every point above is explained, so this is not a black-box score.
- **Recommended actions:**
  1. Hold the rollover.
  2. Lock online access.
  3. Call Grace back on the **pre-change verified number** (0491 570 157), never the new one.
  4. Refer Grace to **IDCARE** for identity support.
  5. Consider a **suspicious matter report (SMR)** to AUSTRAC. It is due within **3 business days**, and lodging it is a human decision.
- The language is neutral throughout. Grace is treated as the likely **victim**, not a suspect.

> Felix reviews the evidence and agrees: hold everything and call Grace on the number we already trust.

---

### 4. Hold — Transfers & Rollovers Agent (Rory)

- The **Transfers & Rollovers Agent** holds the SuperStream rollover. The 3-business-day clock (SIS reg 6.34A) only runs once all required information has been received, and a failed SMSF verification means it hasn't.
- It cancels the request with the receiving fund and records the reason on the case.

---

### 5. Approval — Team Leader Agent (Theo)

- The **Team Leader Agent** prepares a one-page brief with the indicators, the evidence, the recommended actions and the SMR deadline.
- **Theo approves the block** and refers the matter for an SMR to AUSTRAC within the 3-business-day deadline.

---

### 6. No Money Moves — Payments Agent (Penny)

- The **Payments Agent** confirms that the outbound payment is cancelled.
- **No funds leave the account.** Grace's balance of $612,400 is intact.

---

### 7. Reaching Grace — Client Communications Agent (Cara)

- The **Client Communications Agent** contacts Grace only through her **previous verified** email and phone (grace.williams@example.com, 0491 570 157), never the changed details.
- Grace confirms she never asked for a rollover. Her credentials are reset.
- Cara's agent drafts a calm **reassurance letter** that covers:
  - what happened and what Caldova did
  - that her money is safe
  - how IDCARE can help
  - how to reach a person at Caldova
- Every communication to a fraud victim is reviewed by a human before it is sent.

> Cara personally checks the letter and calls Grace when it suits her in Florence.

---

## Outcome

🛡️ **Request blocked** (simulation outcome `rejected`).

- Grace's **$612,400 is protected**.
- Online access is secured and her credentials are reset.
- The SMR referral is approved by the Team Leader.

## AI Agents Featured

1. Onboarding Agent: receiving the rollover request
2. Benefits & Eligibility Agent: SMSF verification rules
3. Financial Crime Agent: document authenticity, activity timeline, explainable risk score, recommended controls
4. Transfers & Rollovers Agent: holding and cancelling the rollover
5. Team Leader Agent: approval brief for the block and SMR referral
6. Payments Agent: confirming no funds leave
7. Client Communications Agent: trusted-channel contact and reassurance letter

## Demo Highlight

Shows how AI agents protect members from a scam pattern that AUSTRAC and the ATO warn super funds about. In minutes, the agents connect a phone call, a device login, a new SMSF and a tampered licence, and explain every red flag. Humans make the block and SMR decisions, and Grace is treated as the victim throughout.
