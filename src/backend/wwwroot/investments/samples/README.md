# Investment Solutions — Caldova Managed Portfolio fact sheets

Sample fact sheets for the six **Caldova Managed Portfolios** used by the
Investment Analyst Agent (Ivy) demo on `/agents/investment-analyst`. They are
fictional products for the *Wealth Team in a Day* demo — general information
only, not personal financial advice.

The agent reads them with the MCP tools in `Mcp/InvestmentsMcpTools.cs`:

1. `analyzeFactSheet(documentUrl)` — fetch and parse a fact sheet (name, code,
   growth/defensive split, asset allocation, investment fee (ICR), buy/sell
   spread, standard risk measure, minimum suggested timeframe, illustrative
   returns, top holdings and sector notes).
2. `compareModels(modelsJson, balance)` — total annual Caldova fees **in
   dollars** for the client's balance (tiered admin fee + $180 account-keeping
   fee + the model's ICR), returned as a markdown table, a Mermaid bar chart
   and plain-English observations.
3. `generateClientWorkbook(caseNumber, caseSummaryJson, modelsJson, recommendationsJson)`
   — write the case `.xlsx` workbook to `../output/` and return its
   `/investments/download/{fileName}` link.

| File | Model | Growth / defensive | Investment fee (ICR) | Standard risk measure | Min. timeframe |
| --- | --- | :-: | --: | --- | :-: |
| `model-conservative.json` | Conservative (`CMP-CON`) | 30/70 | 0.32% p.a. | 3 — Low to medium | 3 years |
| `model-balanced.json` | Balanced (`CMP-BAL`) | 60/40 | 0.38% p.a. | 5 — Medium to high | 5 years |
| `model-growth.json` | Growth (`CMP-GRO`) | 80/20 | 0.42% p.a. | 6 — High | 7 years |
| `model-high-growth.json` | High Growth (`CMP-HGR`) | 95/5 | 0.45% p.a. | 7 — Very high | 9 years |
| `model-index-balanced.json` | Index Balanced (`CMP-IXB`, passive) | 60/40 | 0.18% p.a. | 5 — Medium to high | 5 years |
| `model-sustainable-growth.json` | Sustainable Growth (`CMP-SUS`, ESG screens) | 80/20 | 0.49% p.a. | 6 — High | 7 years |

Every model has a 0.10% buy/sell spread. The Caldova Super & Pension admin fee
is charged on the whole account balance: 0.30% on the first $250,000, 0.15% on
$250,000–$1,000,000, 0.05% on $1,000,000–$2,000,000 and nil above $2,000,000,
plus a $180 p.a. account-keeping fee. Returns are illustrative —
*past performance is not a reliable indicator of future performance.*

## How the demo cases use them

| Case | Analysis | Fact sheets |
| --- | --- | --- |
| `REQ-20261103-OPS001` — Priya Natarajan | Model fit vs SoA (Growth) and fees on $138,200: Growth ≈ $1,175, Balanced ≈ $1,120, Index Balanced ≈ $843 p.a. | Growth, Balanced, Index Balanced |
| `REQ-20261106-OPS002` — Grace Williams | No investment action — account on hold pending the Financial Crime review | Balanced (holdings snapshot) |
| `REQ-20261109-OPS003` — George Papadopoulos | Pension income strategy on $1,250,000: two-year cash bucket ($156,000) + $1,094,000 Balanced, compared with two other structures | Balanced, Conservative |
| `REQ-20261111-OPS004` — Tom Bradley | Redemption plan for the $10,000 hardship release: cash first, then Balanced units ($84,300 → about $74,300) | Balanced |
| `REQ-20261113-OPS005` — Robert Chen (for Mei Chen) | Redeem the pension portfolio (about $486,200) to cash; final amount depends on sale proceeds | Conservative |

URLs (relative to the app root): `/investments/samples/model-conservative.json`,
`/investments/samples/model-balanced.json`, `/investments/samples/model-growth.json`,
`/investments/samples/model-high-growth.json`, `/investments/samples/model-index-balanced.json`,
`/investments/samples/model-sustainable-growth.json`.
