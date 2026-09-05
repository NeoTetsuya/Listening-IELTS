<#
.SYNOPSIS
    Automatically updates index.html with all listening simulator tests and pushes to GitHub.
.DESCRIPTION
    Scans for Part [1-4] - *.html test files, updates index.html cards, counts, and badges,
    and commits/pushes to GitHub.
.PARAMETER Push
    Whether to push to GitHub (default is $true).
.PARAMETER Message
    Custom commit message.
.EXAMPLE
    .\update-and-push.ps1
    .\update-and-push.ps1 -Message "feat: add new practice tests"
    .\update-and-push.ps1 -NoPush
#>

param(
    [switch]$NoPush,
    [string]$Message = ""
)

Set-Location $PSScriptRoot

$cmdArgs = @("update-index.js")
if (-not $NoPush) {
    $cmdArgs += "--push"
}
if ($Message -ne "") {
    $cmdArgs += @("-m", $Message)
}

Write-Host "Running index update..." -ForegroundColor Cyan
node @cmdArgs
