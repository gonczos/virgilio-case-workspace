param(
    [Parameter(Mandatory = $true)]
    [string]$TaskId,

    [Parameter(Mandatory = $true)]
    [string]$Prompt,

    [string]$RepoRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
    Write-Error $Message
    exit 1
}

function Get-RepoRelativePath([string]$BasePath, [string]$TargetPath) {
    $baseFull = [System.IO.Path]::GetFullPath($BasePath)
    $targetFull = [System.IO.Path]::GetFullPath($TargetPath)

    if ($targetFull.StartsWith($baseFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        $relative = $targetFull.Substring($baseFull.Length).TrimStart('\', '/')
        if ($relative) {
            return $relative.Replace('\', '/')
        }
    }

    return $targetFull.Replace('\', '/')
}

if (-not $RepoRoot) {
    $RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
} else {
    $RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)
}

if ($TaskId -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*$') {
    Fail "Invalid TaskId '$TaskId'. Use only letters, numbers, dot, underscore, or hyphen, and start with a letter or number."
}

$promptPath = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot $Prompt))

if (-not (Test-Path -LiteralPath $promptPath -PathType Leaf)) {
    Fail "Prompt file not found: $promptPath"
}

$runsRoot = Join-Path $RepoRoot "docs/agent-runs"
$runDir = Join-Path $runsRoot $TaskId
$runPromptPath = Join-Path $runDir "prompt.md"
$runReportPath = Join-Path $runDir "report.md"

if (Test-Path -LiteralPath $runDir) {
    Fail "Recorded run already exists: $runDir"
}

[System.IO.Directory]::CreateDirectory($runDir) | Out-Null

$promptBytes = [System.IO.File]::ReadAllBytes($promptPath)
[System.IO.File]::WriteAllBytes($runPromptPath, $promptBytes)

$reportTemplate = @"
# Task Report - $TaskId

## Outcome

Pending

## Changes

- Pending

## Validation

- Pending

## Findings / deviations

- Pending

## Remaining task-related residue

- Pending

## Unrelated working-tree state

- Pending

## Recommended next step

- Pending
"@

[System.IO.File]::WriteAllText($runReportPath, $reportTemplate, [System.Text.UTF8Encoding]::new($false))

$relativePromptPath = Get-RepoRelativePath $RepoRoot $runPromptPath
$relativeReportPath = Get-RepoRelativePath $RepoRoot $runReportPath
$quotedRepoRoot = $RepoRoot.Replace('"', '""')
$quotedPromptPath = $runPromptPath.Replace('"', '""')
$codexCommand = "Get-Content -Raw `"$quotedPromptPath`" | codex exec -C `"$quotedRepoRoot`" -"

Write-Output "Recorded run created: $runDir"
Write-Output "Frozen prompt: $relativePromptPath"
Write-Output "Report path: $relativeReportPath"
Write-Output "Execute Codex with the frozen prompt:"
Write-Output $codexCommand
