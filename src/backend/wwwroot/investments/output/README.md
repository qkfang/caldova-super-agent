# Investment Solutions — generated client workbooks

This directory holds the Excel workbooks produced at runtime by the
`generateClientWorkbook` MCP tool (see `Mcp/InvestmentsMcpTools.cs`) and by
the deterministic `/investments/process` flow on the Investment Analyst page.
Each workbook contains the case summary, the model comparison (fees in
dollars), fact-sheet details and asset allocation, any income or redemption
plan, and the analyst's recommendations for adviser review.

Files are served from `/investments/download/{fileName}` by the download
endpoint registered in `Program.cs`. Generated files are intentionally not
tracked (see `.gitignore`); only the newest workbooks are kept.
