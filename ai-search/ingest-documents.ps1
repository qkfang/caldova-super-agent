# Re-uploads documents from wealth_knowledge/ and wealth_rules/ into the
# Azure AI Search indexes provisioned by setup-index.ps1. Use this after
# editing or adding mock case-file, guide or product/rule JSON files.
#
# What it does:
#   1. Validates every *.json file under each folder before upload (fail-fast
#      JSON parse + required-field check), so a malformed mock document
#      can't quietly take down a whole index batch.
#   2. Echoes each file as it is uploaded with its document id so you can
#      cross-reference the mock documents (e.g. case-req-20261111-ops004-hardship-application).
#   3. Uploads every wealth_rules document twice: as-is into wealth_rules, and
#      projected onto the knowledge schema into wealth_knowledge — the only
#      index the Foundry agents query — so agents can cite rules by title.
#   4. Prints a per-index summary at the end (count and any individual
#      document failures returned by the indexer in the merge response).
#   5. Deletes the case files filed under the scenario cases' old numbers
#      (REQ-yyyyMMdd-DEMOnn, now REQ-yyyyMMdd-OPSnnn), since an upload can only
#      add or replace documents. Once they are gone this is a no-op.

$SearchServiceName = "search-caldovacs"   # Update to the aiSearchName output from main.bicep (search-<baseName>, e.g. search-caldovacs)
$IndexPrefix = "wealth"

$ErrorActionPreference = "Stop"

$searchEndpoint = "https://${SearchServiceName}.search.windows.net"
$apiVersion = "2024-07-01"

$token = (az account get-access-token --resource "https://search.azure.com" --query accessToken -o tsv)
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json; charset=utf-8"
}

# Required fields per index — kept in sync with setup-index.ps1. Used as a
# pre-flight sanity check so a mock doc with a typo in (say) `id` doesn't
# silently land as a partial document.
$requiredFields = @{
    "${IndexPrefix}_knowledge" = @("id", "title", "category", "requestType", "content", "tags", "lastUpdated")
    "${IndexPrefix}_rules"     = @("id", "title", "product", "summary", "rules", "tags", "lastUpdated")
}

function Read-AndValidateDocument {
    param([System.IO.FileInfo]$File, [string[]]$Required)

    try {
        $doc = Get-Content $File.FullName -Raw -Encoding utf8 | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        Write-Warning "    [SKIP] $($File.Name) — invalid JSON: $($_.Exception.Message)"
        return $null
    }

    $missing = @()
    foreach ($field in $Required) {
        if (-not ($doc.PSObject.Properties.Name -contains $field)) {
            $missing += $field
        }
    }
    if ($missing.Count -gt 0) {
        Write-Warning "    [SKIP] $($File.Name) — missing required field(s): $($missing -join ', ')"
        return $null
    }

    return $doc
}

function ConvertTo-KnowledgeDocument {
    # Same projection as setup-index.ps1: maps a wealth_rules document onto the
    # wealth_knowledge schema so it can be retrieved and cited by its title.
    param([object]$RuleDoc)

    $sections = @($RuleDoc.summary)
    if ($RuleDoc.rules) { $sections += "Key rules: $($RuleDoc.rules)" }
    if ($RuleDoc.limits) { $sections += "Limits and exceptions: $($RuleDoc.limits)" }
    if ($RuleDoc.evidenceRequired) { $sections += "Evidence required: $(@($RuleDoc.evidenceRequired) -join '; ')" }
    $sections += "Product: $($RuleDoc.product). Version: $($RuleDoc.version). Owner: $($RuleDoc.owner)."

    [pscustomobject]@{
        id           = $RuleDoc.id
        title        = $RuleDoc.title
        category     = "Product & Rules"
        requestType  = "All"
        caseNumber   = ""
        memberNumber = ""
        content      = ($sections -join "`n`n")
        severity     = "reference"
        department   = $RuleDoc.owner
        tags         = @($RuleDoc.tags)
        lastUpdated  = $RuleDoc.lastUpdated
    }
}

function Upload-Documents {
    param([string]$IndexName, [string]$DocumentFolder, [string]$RulesFolder)

    Write-Host "  Source folder: $DocumentFolder"
    $files = Get-ChildItem -Path $DocumentFolder -Filter "*.json" | Sort-Object Name
    if ($files.Count -eq 0) {
        Write-Host "  No JSON documents found in $DocumentFolder"
        return
    }

    $required = $requiredFields[$IndexName]
    if (-not $required) { $required = @("id") }

    $docs = @()
    foreach ($file in $files) {
        $doc = Read-AndValidateDocument -File $file -Required $required
        if ($null -eq $doc) { continue }

        $docId = $doc.id
        Write-Host ("    [OK]   {0,-62}  -> id: {1}" -f $file.Name, $docId)

        $doc | Add-Member -NotePropertyName "@search.action" -NotePropertyValue "upload" -Force
        $docs += $doc
    }

    if ($RulesFolder) {
        Write-Host "  Rules folder (projected onto the knowledge schema): $RulesFolder"
        foreach ($file in (Get-ChildItem -Path $RulesFolder -Filter "*.json" | Sort-Object Name)) {
            $rule = Read-AndValidateDocument -File $file -Required $requiredFields["${IndexPrefix}_rules"]
            if ($null -eq $rule) { continue }

            $doc = ConvertTo-KnowledgeDocument -RuleDoc $rule
            Write-Host ("    [OK]   {0,-62}  -> id: {1}" -f $file.Name, $doc.id)

            $doc | Add-Member -NotePropertyName "@search.action" -NotePropertyValue "upload" -Force
            $docs += $doc
        }
    }

    if ($docs.Count -eq 0) {
        Write-Warning "  No valid documents to upload to '$IndexName'."
        return
    }

    $body = @{ value = $docs } | ConvertTo-Json -Depth 20
    $uri = "$searchEndpoint/indexes/${IndexName}/docs/index?api-version=$apiVersion"

    try {
        $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body

        $succeeded = @($response.value | Where-Object { $_.status -eq $true }).Count
        $failed    = @($response.value | Where-Object { $_.status -ne $true })

        Write-Host "  Uploaded $succeeded / $($docs.Count) documents to '$IndexName'."
        if ($failed.Count -gt 0) {
            foreach ($f in $failed) {
                Write-Warning "    [FAIL] id=$($f.key) statusCode=$($f.statusCode) error=$($f.errorMessage)"
            }
        }
    }
    catch {
        Write-Warning "  Failed to upload documents to '$IndexName': $_"
    }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Remove-RetiredCaseDocuments {
    # Each renamed case file's old id, e.g. case-req-20261103-ops001-… was case-req-20261103-demo01-….
    param([string]$IndexName, [string]$DocumentFolder)

    $retired = @(Get-ChildItem -Path $DocumentFolder -Filter "case-req-*-ops00*.json" |
        ForEach-Object { $_.BaseName -replace '-ops00(\d)-', '-demo0$1-' })
    if ($retired.Count -eq 0) { return }

    $body = @{ value = @($retired | ForEach-Object { @{ "@search.action" = "delete"; id = $_ } }) } | ConvertTo-Json -Depth 5
    $uri = "$searchEndpoint/indexes/${IndexName}/docs/index?api-version=$apiVersion"
    try {
        Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body | Out-Null
        Write-Host "  Removed any of $($retired.Count) case files still filed under the old REQ-…-DEMOnn case numbers."
    }
    catch {
        Write-Warning "  Failed to remove old case files from '$IndexName': $_"
    }
}

Write-Host "Ingesting documents into '${IndexPrefix}_knowledge' (case files, guides and projected rules)..."
Remove-RetiredCaseDocuments -IndexName "${IndexPrefix}_knowledge" -DocumentFolder (Join-Path $scriptDir "wealth_knowledge")
Upload-Documents -IndexName "${IndexPrefix}_knowledge" -DocumentFolder (Join-Path $scriptDir "wealth_knowledge") -RulesFolder (Join-Path $scriptDir "wealth_rules")

Write-Host "`nIngesting documents into '${IndexPrefix}_rules'..."
Upload-Documents -IndexName "${IndexPrefix}_rules" -DocumentFolder (Join-Path $scriptDir "wealth_rules")

Write-Host "`nDocument ingestion complete."
