# Creates / updates the two Azure AI Search indexes used by Wealth Team in a Day
# (Caldova Wealth) and uploads the mock JSON documents from the sibling folders:
#   wealth_knowledge  <- wealth_knowledge/*.json (case files + operational guides)
#                        + wealth_rules/*.json projected onto the knowledge schema
#   wealth_rules      <- wealth_rules/*.json (product & rule documents)
# Adapted from https://github.com/qkfang/quant-agent/blob/main/ai-search/setup-index.ps1.

$SearchServiceName = "search-caldovacs"     # Update to the aiSearchName output from main.bicep (search-<baseName>, e.g. search-caldovacs)
$ResourceGroupName = "rg-caldova-super"
$IndexPrefix = "wealth"
$FoundryEndpoint = "https://aif-caldovacs.cognitiveservices.azure.com"  # Update to match foundryAccountEndpoint output

$ErrorActionPreference = "Stop"

$searchEndpoint = "https://${SearchServiceName}.search.windows.net"
$apiVersion = "2024-07-01"

# Get an AAD bearer token for Azure AI Search (the search service is configured
# with aadOrApiKey + http401WithBearerChallenge in aisearch.bicep).
$token = (az account get-access-token --resource "https://search.azure.com" --query accessToken -o tsv)
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json; charset=utf-8"
}

function New-SearchIndex {
    param([string]$IndexName, [object]$IndexDefinition)

    Write-Host "Creating index: $IndexName"
    $IndexDefinition.name = $IndexName
    $body = $IndexDefinition | ConvertTo-Json -Depth 30

    $uri = "$searchEndpoint/indexes/${IndexName}?api-version=$apiVersion"
    try {
        Invoke-RestMethod -Uri $uri -Method Put -Headers $headers -Body $body
        Write-Host "  Index '$IndexName' created/updated."
    }
    catch {
        Write-Warning "  Failed to create index '$IndexName': $_"
    }
}

function ConvertTo-KnowledgeDocument {
    # The Foundry agents query only the wealth_knowledge index, so every
    # wealth_rules document is also uploaded there in the knowledge schema and
    # can be retrieved and cited by its title.
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

    $files = Get-ChildItem -Path $DocumentFolder -Filter "*.json"
    if ($files.Count -eq 0) {
        Write-Host "  No JSON documents found in $DocumentFolder"
        return
    }

    $docs = @()
    foreach ($file in $files) {
        $doc = Get-Content $file.FullName -Raw -Encoding utf8 | ConvertFrom-Json
        $doc | Add-Member -NotePropertyName "@search.action" -NotePropertyValue "upload" -Force
        $docs += $doc
    }

    if ($RulesFolder) {
        foreach ($file in Get-ChildItem -Path $RulesFolder -Filter "*.json") {
            $doc = ConvertTo-KnowledgeDocument -RuleDoc (Get-Content $file.FullName -Raw -Encoding utf8 | ConvertFrom-Json)
            $doc | Add-Member -NotePropertyName "@search.action" -NotePropertyValue "upload" -Force
            $docs += $doc
        }
    }

    $body = @{ value = $docs } | ConvertTo-Json -Depth 20
    $uri = "$searchEndpoint/indexes/${IndexName}/docs/index?api-version=$apiVersion"

    try {
        Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body
        Write-Host "  Uploaded $($docs.Count) documents to '$IndexName'."
    }
    catch {
        Write-Warning "  Failed to upload documents to '$IndexName': $_"
    }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# --- wealth_knowledge index ------------------------------------------------
# Member case files (one or more per demo scenario), operational guides
# (financial-crime red flags, authority matrix, fund directory, NIGO checklist)
# and a knowledge-schema copy of every product & rule document.
$knowledgeIndexName = "${IndexPrefix}_knowledge"
$knowledgeIndexDef = @{
    name   = $knowledgeIndexName
    fields = @(
        @{ name = "id"; type = "Edm.String"; key = $true; filterable = $true }
        @{ name = "title"; type = "Edm.String"; searchable = $true; filterable = $true; sortable = $true; analyzer = "en.microsoft" }
        @{ name = "category"; type = "Edm.String"; searchable = $true; filterable = $true; facetable = $true }
        @{ name = "requestType"; type = "Edm.String"; filterable = $true; facetable = $true }
        @{ name = "caseNumber"; type = "Edm.String"; filterable = $true; searchable = $true }
        @{ name = "memberNumber"; type = "Edm.String"; filterable = $true; searchable = $true }
        @{ name = "content"; type = "Edm.String"; searchable = $true; analyzer = "en.microsoft" }
        @{ name = "severity"; type = "Edm.String"; filterable = $true; facetable = $true }
        @{ name = "department"; type = "Edm.String"; filterable = $true; facetable = $true }
        @{ name = "tags"; type = "Collection(Edm.String)"; searchable = $true; filterable = $true; facetable = $true }
        @{ name = "lastUpdated"; type = "Edm.DateTimeOffset"; filterable = $true; sortable = $true }
        @{ name = "contentVector"; type = "Collection(Edm.Single)"; searchable = $true; dimensions = 1536; vectorSearchProfile = "vector-profile-knowledge" }
    )
    vectorSearch = @{
        algorithms = @(
            @{
                name = "hnsw-algorithm"
                kind = "hnsw"
                hnswParameters = @{
                    m = 4
                    efConstruction = 400
                    efSearch = 500
                    metric = "cosine"
                }
            }
        )
        profiles = @(
            @{
                name = "vector-profile-knowledge"
                algorithm = "hnsw-algorithm"
                vectorizer = "openai-vectorizer"
            }
        )
        vectorizers = @(
            @{
                name = "openai-vectorizer"
                kind = "azureOpenAI"
                azureOpenAIParameters = @{
                    resourceUri = $FoundryEndpoint
                    deploymentId = "text-embedding-ada-002"
                    modelName = "text-embedding-ada-002"
                }
            }
        )
    }
    semantic = @{
        defaultConfiguration = "semantic-config-knowledge"
        configurations = @(
            @{
                name = "semantic-config-knowledge"
                prioritizedFields = @{
                    titleField = @{ fieldName = "title" }
                    prioritizedContentFields = @(
                        @{ fieldName = "content" }
                    )
                    prioritizedKeywordsFields = @(
                        @{ fieldName = "category" }
                        @{ fieldName = "requestType" }
                        @{ fieldName = "department" }
                    )
                }
            }
        )
    }
}

New-SearchIndex -IndexName $knowledgeIndexName -IndexDefinition $knowledgeIndexDef
Upload-Documents -IndexName $knowledgeIndexName -DocumentFolder (Join-Path $scriptDir "wealth_knowledge") -RulesFolder (Join-Path $scriptDir "wealth_rules")

# --- wealth_rules index ----------------------------------------------------
# Caldova product & rule documents (PDS, IDPS guide, trust deed, super-law rule
# summaries, fee schedule, managed portfolio menu) in their structured form.
$rulesIndexName = "${IndexPrefix}_rules"
$rulesIndexDef = @{
    name   = $rulesIndexName
    fields = @(
        @{ name = "id"; type = "Edm.String"; key = $true; filterable = $true }
        @{ name = "title"; type = "Edm.String"; searchable = $true; filterable = $true; sortable = $true; analyzer = "en.microsoft" }
        @{ name = "product"; type = "Edm.String"; filterable = $true; facetable = $true }
        @{ name = "version"; type = "Edm.String"; filterable = $true }
        @{ name = "summary"; type = "Edm.String"; searchable = $true; analyzer = "en.microsoft" }
        @{ name = "rules"; type = "Edm.String"; searchable = $true; analyzer = "en.microsoft" }
        @{ name = "limits"; type = "Edm.String"; searchable = $true; analyzer = "en.microsoft" }
        @{ name = "evidenceRequired"; type = "Collection(Edm.String)"; searchable = $true; filterable = $true; facetable = $true }
        @{ name = "owner"; type = "Edm.String"; filterable = $true }
        @{ name = "tags"; type = "Collection(Edm.String)"; searchable = $true; filterable = $true; facetable = $true }
        @{ name = "lastUpdated"; type = "Edm.DateTimeOffset"; filterable = $true; sortable = $true }
        @{ name = "summaryVector"; type = "Collection(Edm.Single)"; searchable = $true; dimensions = 1536; vectorSearchProfile = "vector-profile-rules" }
    )
    vectorSearch = @{
        algorithms = @(
            @{
                name = "hnsw-algorithm"
                kind = "hnsw"
                hnswParameters = @{
                    m = 4
                    efConstruction = 400
                    efSearch = 500
                    metric = "cosine"
                }
            }
        )
        profiles = @(
            @{
                name = "vector-profile-rules"
                algorithm = "hnsw-algorithm"
                vectorizer = "openai-vectorizer"
            }
        )
        vectorizers = @(
            @{
                name = "openai-vectorizer"
                kind = "azureOpenAI"
                azureOpenAIParameters = @{
                    resourceUri = $FoundryEndpoint
                    deploymentId = "text-embedding-ada-002"
                    modelName = "text-embedding-ada-002"
                }
            }
        )
    }
    semantic = @{
        defaultConfiguration = "semantic-config-rules"
        configurations = @(
            @{
                name = "semantic-config-rules"
                prioritizedFields = @{
                    titleField = @{ fieldName = "title" }
                    prioritizedContentFields = @(
                        @{ fieldName = "summary" }
                        @{ fieldName = "rules" }
                        @{ fieldName = "limits" }
                    )
                    prioritizedKeywordsFields = @(
                        @{ fieldName = "product" }
                        @{ fieldName = "owner" }
                    )
                }
            }
        )
    }
}

New-SearchIndex -IndexName $rulesIndexName -IndexDefinition $rulesIndexDef
Upload-Documents -IndexName $rulesIndexName -DocumentFolder (Join-Path $scriptDir "wealth_rules")

Write-Host "`nSetup complete. Indexes '${IndexPrefix}_knowledge' and '${IndexPrefix}_rules' created with semantic search and vector search enabled."
