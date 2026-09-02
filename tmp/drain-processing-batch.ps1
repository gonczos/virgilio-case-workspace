param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("cheap", "xberg", "docling", "native-docling")]
    [string]$Batch,
    [int]$WorkerCount = 4
)

$ErrorActionPreference = "Stop"
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runRoot = Join-Path $PSScriptRoot ("worker-logs-" + $Batch + "-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force -Path $runRoot | Out-Null
$workers = @()
$env:OMP_NUM_THREADS = if ($Batch -eq "native-docling") { "4" } else { "8" }
$env:MKL_NUM_THREADS = $env:OMP_NUM_THREADS
$workerScript = if ($Batch -eq "native-docling") { ".\tmp\native-docling-worker.mjs" } else { ".\app\processing-worker.mjs" }

function Get-BatchState {
    $json = & node.exe (Join-Path $PSScriptRoot "batch-state.mjs") $Batch
    return ($json | ConvertFrom-Json)
}

try {
    for ($index = 1; $index -le $WorkerCount; $index += 1) {
        $stdout = Join-Path $runRoot "worker-$index.stdout.log"
        $stderr = Join-Path $runRoot "worker-$index.stderr.log"
        $worker = Start-Process -FilePath "node.exe" -ArgumentList $workerScript -WorkingDirectory $workspaceRoot -RedirectStandardOutput $stdout -RedirectStandardError $stderr -WindowStyle Hidden -PassThru
        $workers += $worker
        Write-Output "WORKER index=$index pid=$($worker.Id)"
    }

    while ($true) {
        $state = Get-BatchState
        Write-Output ("STATE time={0} queued={1} running={2} completed={3} failed={4}" -f (Get-Date -Format "HH:mm:ss"), $state.queued, $state.running, $state.completed, $state.failed)
        if ($state.queued -eq 0 -and $state.running -eq 0) { break }
        Start-Sleep -Seconds 10
    }
} finally {
    foreach ($worker in $workers) {
        if (-not $worker.HasExited) {
            Stop-Process -Id $worker.Id
            $worker.WaitForExit()
        }
    }
}

$finalState = Get-BatchState
Write-Output ("FINAL batch={0} queued={1} running={2} completed={3} failed={4} logs={5}" -f $Batch, $finalState.queued, $finalState.running, $finalState.completed, $finalState.failed, $runRoot)
