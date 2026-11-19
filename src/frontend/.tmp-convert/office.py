import pathlib

p = pathlib.Path("src/officeScene.ts")
t = p.read_text(encoding="utf-8")

pairs = [
    # ----- Layout diagram -----
    (
        " *           │ Team Leader   │ Assessor │ Loss Adj. │ Fraud Inv │ Coffee Area │  back row\n"
        " *           │ (exec office) │  Dept    │   Dept    │   Dept    │ (Café)      │\n",
        " *           │ Team Leader   │ Benefits │ Invest-   │ Financial │ Coffee Area │  back row\n"
        " *           │ (exec office) │ & Elig.  │  ments    │  Crime    │ (Café)      │\n",
    ),
    (
        " *           │ Intake Dept   │ Supplier │ Settlement│ Cust Comm │ Play Area   │  front row\n"
        " *           │               │  Coord   │  Officer  │  Dept     │ (ping-pong) │\n",
        " *           │ Onboarding    │ Transfers│ Payments  │ Client    │ Play Area   │  front row\n"
        " *           │ & Requests    │ & Rolls  │           │ Comms     │ (ping-pong) │\n",
    ),
    (
        " *           │  Welcome counters  +  Reception  +  Customer Waiting Area      │\n",
        " *           │  Welcome counters  +  Reception  +  Client Waiting Area        │\n",
    ),
    # ----- OfficeLayout fields -----
    (
        "  /** World position where customers spawn outside the door. */",
        "  /** World position where clients spawn outside the door. */",
    ),
    (
        "  /** Where customers queue/drop their claim at reception. */",
        "  /** Where clients queue/drop their request at reception. */",
    ),
    (
        "  /** Where customers go after handing in their claim, then despawn. */",
        "  /** Where clients go after handing in their request, then despawn. */",
    ),
    (
        "  /** Reception desk where the Claims Intake Officer stands. */\n"
        "  intakeDeskPoint: Vector3;\n"
        "  /** Cubicle desk for the Claims Assessor. */\n"
        "  assessorDeskPoint: Vector3;\n"
        "  /** Cubicle desk for the Loss Adjuster. */\n"
        "  lossAdjusterDeskPoint: Vector3;\n"
        "  /** Cubicle desk for the Fraud Investigator. */\n"
        "  fraudDeskPoint: Vector3;\n"
        "  /** Cubicle desk for the Supplier Coordinator. */\n"
        "  supplierDeskPoint: Vector3;\n"
        "  /** Cubicle desk for the Settlement Officer. */\n"
        "  settlementDeskPoint: Vector3;\n"
        "  /** Cubicle desk for the Customer Communications Specialist. */\n"
        "  communicationsDeskPoint: Vector3;\n"
        "  /** Office desk for the Claims Team Leader. */\n"
        "  teamLeaderDeskPoint: Vector3;\n"
        "  /** Shared inbox tray on the intake desk where customers drop folders. */\n"
        "  inboxPoint: Vector3;\n"
        "  /** Shelf where filed/closed claims rest (in the comms department). */\n",
        "  /** Cubicle desk for the Onboarding & Requests Officer. */\n"
        "  onboardingDeskPoint: Vector3;\n"
        "  /** Cubicle desk for the Benefits & Eligibility Assessor. */\n"
        "  benefitsDeskPoint: Vector3;\n"
        "  /** Cubicle desk for the Investment Analyst. */\n"
        "  investmentsDeskPoint: Vector3;\n"
        "  /** Cubicle desk for the Financial Crime Investigator. */\n"
        "  finCrimeDeskPoint: Vector3;\n"
        "  /** Cubicle desk for the Transfers & Rollovers Coordinator. */\n"
        "  transfersDeskPoint: Vector3;\n"
        "  /** Cubicle desk for the Payments Officer. */\n"
        "  paymentsDeskPoint: Vector3;\n"
        "  /** Cubicle desk for the Client Communications Specialist. */\n"
        "  communicationsDeskPoint: Vector3;\n"
        "  /** Office desk for the Client Operations Team Leader. */\n"
        "  teamLeaderDeskPoint: Vector3;\n"
        "  /** Shared inbox tray on the reception desk where clients drop folders. */\n"
        "  inboxPoint: Vector3;\n"
        "  /** Shelf where closed case files rest (in the comms department). */\n",
    ),
    # ----- Lobby comment -----
    (
        "  // Lobby wood floor — wider \"claims lobby\" with welcome counters and\n"
        "  // customer waiting area",
        "  // Lobby wood floor — wider \"client lobby\" with welcome counters and\n"
        "  // client waiting area",
    ),
    # ----- Identity wall -----
    (
        "  // ----- \"CLAIMS DEPARTMENT\" identity wall (back-mid, between team leader",
        "  // ----- \"CLIENT OPERATIONS\" identity wall (back-mid, between team leader",
    ),
    (
        '    ctx.fillText("CLAIMS", 50, 140);\n    ctx.fillText("DEPARTMENT", 50, 250);',
        '    ctx.fillText("CLIENT", 50, 140);\n    ctx.fillText("OPERATIONS", 50, 250);',
    ),
    # ----- Process board -----
    (
        '    const steps = ["1  Report", "2  Assess", "3  Investigate", "4  Resolve", "5  Close"];',
        '    const steps = ["1  Request", "2  Verify", "3  Assess", "4  Action", "5  Confirm"];',
    ),
    # ----- Waiting area -----
    (
        "  // Coffee table + sofas in lobby (Customer Waiting Area)",
        "  // Coffee table + sofas in lobby (Client Waiting Area)",
    ),
    (
        "  // \"CUSTOMER WAITING AREA\" sign on the front-low wall (right side)",
        "  // \"CLIENT WAITING AREA\" sign on the front-low wall (right side)",
    ),
    (
        '    ctx.fillText("CUSTOMER WAITING", 320, 56);',
        '    ctx.fillText("CLIENT WAITING", 320, 56);',
    ),
    # ----- Department grid comments + cubicles -----
    (
        "  // Front row (z = 0): Intake | Supplier Coord | Settlement | Cust Comms\n"
        "  // Back  row (z = 10): Team Leader | Assessor | Loss Adjuster | Fraud Inv\n"
        "  // Right side: Play Area | Coffee Area | Kitchen | IT/Cloud Room\n"
        "  // Front (z < -7): Reception desk + Customer Waiting Area + Welcome counters",
        "  // Front row (z = 0): Onboarding | Transfers | Payments | Comms\n"
        "  // Back  row (z = 10): Team Leader | Benefits | Investments | Financial Crime\n"
        "  // Right side: Play Area | Coffee Area | Kitchen | IT/Cloud Room\n"
        "  // Front (z < -7): Reception desk + Client Waiting Area + Welcome counters",
    ),
    (
        "    // Sign text is the key role only (no \"Officer\" / \"Coordinator\" /\n"
        "    // \"Investigator\" suffixes) so the label stays large and legible on\n"
        "    // the desk sign even from the orbit camera.\n"
        "    // Front row (z = 0)\n"
        "    { label: \"intake\",         accent: \"#3a5fb0\", cx: -21, cz: 0, sign: \"INTAKE\" },\n"
        "    { label: \"supplier\",       accent: \"#2e8a6e\", cx: -11, cz: 0, sign: \"SUPPLIER\" },\n"
        "    { label: \"settlement\",     accent: \"#a06a4c\", cx:  -1, cz: 0, sign: \"SETTLEMENT\" },\n"
        "    { label: \"communications\", accent: \"#b56fbf\", cx:   9, cz: 0, sign: \"COMMS\" },\n"
        "    // Back row (z = 10) — Team Leader gets the executive corner office\n"
        "    { label: \"assessor\",     accent: \"#6ec1ff\", cx: -11, cz: 10, sign: \"ASSESSOR\" },\n"
        "    { label: \"lossAdjuster\", accent: \"#ffb347\", cx:  -1, cz: 10, sign: \"LOSS ADJUSTER\" },\n"
        "    { label: \"fraud\",        accent: \"#e8504c\", cx:   9, cz: 10, sign: \"FRAUD\" },\n",
        "    // Sign text is the department keyword only (no \"Officer\" /\n"
        "    // \"Coordinator\" / \"Investigator\" suffixes) so the label stays large\n"
        "    // and legible from the orbit camera. Accents are the canonical\n"
        "    // department colours (matching each staff member's shirt).\n"
        "    // Front row (z = 0)\n"
        "    { label: \"onboarding\",     accent: \"#0ea5e9\", cx: -21, cz: 0, sign: \"ONBOARDING\" },\n"
        "    { label: \"transfers\",      accent: \"#10b981\", cx: -11, cz: 0, sign: \"TRANSFERS\" },\n"
        "    { label: \"payments\",       accent: \"#a855f7\", cx:  -1, cz: 0, sign: \"PAYMENTS\" },\n"
        "    { label: \"communications\", accent: \"#ec4899\", cx:   9, cz: 0, sign: \"COMMS\" },\n"
        "    // Back row (z = 10) — Team Leader gets the executive corner office\n"
        "    { label: \"benefits\",    accent: \"#6366f1\", cx: -11, cz: 10, sign: \"BENEFITS\" },\n"
        "    { label: \"investments\", accent: \"#f59e0b\", cx:  -1, cz: 10, sign: \"INVESTMENTS\" },\n"
        "    { label: \"finCrime\",    accent: \"#ef4444\", cx:   9, cz: 10, sign: \"FINANCIAL CRIME\" },\n",
    ),
    # ----- Printer comment -----
    (
        "  // Printer station tucked alongside the right-hand walkway, between the\n"
        "  // Fraud Investigation booth and the cafe zone",
        "  // Printer station tucked alongside the right-hand walkway, between the\n"
        "  // Financial Crime booth and the cafe zone",
    ),
    # ----- Lobby counters -----
    (
        "  // ----- Customer-facing welcome counters in the lobby -----\n"
        "  buildLobbyCounter(scene, mat, \"QUICK INTAKE\", -7.5, -9.0, \"#3a5fb0\");\n"
        "  buildLobbyCounter(scene, mat, \"CLAIMS HELP\",  -3.5, -9.0, \"#2e8a6e\");\n"
        "  buildLobbyCounter(scene, mat, \"POLICY DESK\",   0.5, -9.0, \"#a06a4c\");",
        "  // ----- Client-facing welcome counters in the lobby -----\n"
        "  buildLobbyCounter(scene, mat, \"NEW ACCOUNTS\", -7.5, -9.0, \"#0ea5e9\");\n"
        "  buildLobbyCounter(scene, mat, \"MEMBER HELP\",  -3.5, -9.0, \"#14b8a6\");\n"
        "  buildLobbyCounter(scene, mat, \"ADVISER DESK\",  0.5, -9.0, \"#6366f1\");",
    ),
    # ----- Layout return -----
    (
        "    intakeDeskPoint: new Vector3(-21, 0, -0.6),\n"
        "    assessorDeskPoint: new Vector3(-11, 0, 9.4),\n"
        "    lossAdjusterDeskPoint: new Vector3(-1, 0, 9.4),\n"
        "    fraudDeskPoint: new Vector3(9, 0, 9.4),\n"
        "    supplierDeskPoint: new Vector3(-11, 0, -0.6),\n"
        "    settlementDeskPoint: new Vector3(-1, 0, -0.6),\n",
        "    onboardingDeskPoint: new Vector3(-21, 0, -0.6),\n"
        "    benefitsDeskPoint: new Vector3(-11, 0, 9.4),\n"
        "    investmentsDeskPoint: new Vector3(-1, 0, 9.4),\n"
        "    finCrimeDeskPoint: new Vector3(9, 0, 9.4),\n"
        "    transfersDeskPoint: new Vector3(-11, 0, -0.6),\n"
        "    paymentsDeskPoint: new Vector3(-1, 0, -0.6),\n",
    ),
    # ----- Cubicle sign auto-fit comment -----
    (
        "    // Auto-fit text so labels of varying length (e.g. \"FRAUD\" vs\n"
        "    // \"LOSS ADJUSTER\") never clip on either side of the sign. Start at a",
        "    // Auto-fit text so labels of varying length (e.g. \"COMMS\" vs\n"
        "    // \"FINANCIAL CRIME\") never clip on either side of the sign. Start at a",
    ),
    # ----- Lobby counter sign: auto-fit longer labels -----
    (
        "    ctx.fillStyle = \"#ffffff\";\n"
        "    ctx.font = \"bold 56px sans-serif\";\n"
        "    ctx.textAlign = \"center\";\n"
        "    ctx.textBaseline = \"middle\";\n"
        "    ctx.fillText(signText, 256, 95);",
        "    ctx.fillStyle = \"#ffffff\";\n"
        "    ctx.textAlign = \"center\";\n"
        "    ctx.textBaseline = \"middle\";\n"
        "    // Shrink-to-fit so longer labels (e.g. \"NEW ACCOUNTS\") keep a margin.\n"
        "    let fontPx = 56;\n"
        "    ctx.font = `bold ${fontPx}px sans-serif`;\n"
        "    while (ctx.measureText(signText).width > 460 && fontPx > 32) {\n"
        "      fontPx -= 2;\n"
        "      ctx.font = `bold ${fontPx}px sans-serif`;\n"
        "    }\n"
        "    ctx.fillText(signText, 256, 95);",
    ),
    # ----- Ambient comment -----
    (
        "  // ambient scenery, not part of the claim simulation.",
        "  // ambient scenery, not part of the case simulation.",
    ),
]

for old, new in pairs:
    n = t.count(old)
    if n != 1:
        raise SystemExit(f"expected 1 match, found {n}: {old[:80]!r}")
    t = t.replace(old, new)

# ----- Archive labels on the filing cabinets -----
anchor = "  // Plants on top of cabinets\n"
if t.count(anchor) != 1:
    raise SystemExit("cabinet anchor missing")
archive = '''  // Archive label rail along the top front edge of the cabinet bank —
  // one section per file type, sitting under the plants on top.
  buildArchiveLabels(scene, -0.5, 1.8, 23.33, 8.2, [
    "Applications",
    "Member Files",
    "Nominations",
    "Closed Cases",
  ]);
'''
t = t.replace(anchor, archive + anchor)

helper_anchor = "/**\n * Build a single labelled department zone:"
if t.count(helper_anchor) != 1:
    raise SystemExit("helper anchor missing")
helper = '''/**
 * Label rail for the archive filing cabinets: a slim cream strip split into
 * equal sections, one per file type, each with auto-fitted text.
 */
function buildArchiveLabels(
  scene: Scene,
  cx: number,
  cy: number,
  cz: number,
  width: number,
  labels: string[],
): void {
  const rail = MeshBuilder.CreateBox(
    "archiveLabelRail",
    { width, height: 0.4, depth: 0.05 },
    scene,
  );
  rail.position = new Vector3(cx, cy, cz);
  const texW = 2048;
  const texH = 100;
  drawSignTexture(scene, rail, texW, texH, (ctx) => {
    ctx.fillStyle = "#f4ecdb";
    ctx.fillRect(0, 0, texW, texH);
    const sectionW = texW / labels.length;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < labels.length; i++) {
      // Thin navy dividers between sections, like drawer label holders.
      if (i > 0) {
        ctx.fillStyle = "#2a3a5c";
        ctx.fillRect(i * sectionW - 3, 0, 6, texH);
      }
      ctx.fillStyle = "#1c2230";
      let fontPx = 58;
      ctx.font = `bold ${fontPx}px sans-serif`;
      while (ctx.measureText(labels[i]).width > sectionW * 0.66 && fontPx > 24) {
        fontPx -= 2;
        ctx.font = `bold ${fontPx}px sans-serif`;
      }
      ctx.fillText(labels[i], i * sectionW + sectionW / 2, texH / 2 + 2);
    }
  });
}

'''
t = t.replace(helper_anchor, helper + helper_anchor)

p.write_text(t, encoding="utf-8", newline="\r\n")
print("officeScene.ts updated")
