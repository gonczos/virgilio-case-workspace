[CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'Medium')]
param(
    [Parameter(Mandatory)]
    [ValidateNotNullOrEmpty()]
    [string]$Email,

    [ValidateNotNullOrEmpty()]
    [string]$Realm = 'consultation'
)

$ErrorActionPreference = 'Stop'

$composeFile = Join-Path $PSScriptRoot 'compose.yml'
$envFile = Join-Path $PSScriptRoot '.env'

if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
    throw "Missing deployment environment file: $envFile"
}

function Invoke-Docker {
    param(
        [Parameter(Mandatory)]
        [string[]]$Arguments,

        [switch]$AllowEmptyOutput
    )

    $output = & docker @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed with exit code $LASTEXITCODE."
    }

    if (-not $AllowEmptyOutput -and -not $output) {
        throw 'Docker command returned no output.'
    }

    return $output
}

$composeArguments = @(
    'compose',
    '--env-file', $envFile,
    '-f', $composeFile
)

$keycloakContainer = Invoke-Docker -Arguments ($composeArguments + @('ps', '--status', 'running', '-q', 'keycloak'))
if (@($keycloakContainer).Count -ne 1) {
    throw 'Expected exactly one running Keycloak container.'
}
$keycloakContainer = "$keycloakContainer".Trim()

$publicHostname = Invoke-Docker -Arguments @('exec', $keycloakContainer, 'printenv', 'KC_HOSTNAME')
$publicHostname = "$publicHostname".Trim()
if ($publicHostname -notmatch '^https://[^/]+/?$' -or $publicHostname -match '(?i)localhost|127\.0\.0\.1') {
    throw "Keycloak is not in public mode (KC_HOSTNAME=$publicHostname). Restore public mode before sending email."
}

$tunnelContainer = Invoke-Docker -Arguments ($composeArguments + @('--profile', 'publish', 'ps', '--status', 'running', '-q', 'cloudflared'))
if (@($tunnelContainer).Count -ne 1) {
    throw 'Cloudflare Tunnel is not running. Restore public mode before sending email.'
}

$kcadm = '/opt/keycloak/bin/kcadm.sh'
$authenticateCommand = @'
/opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master --user bootstrap-admin --password "$(cat /run/secrets/keycloak_bootstrap_password)"
'@
Invoke-Docker -Arguments @(
    'exec', $keycloakContainer,
    '/bin/sh', '-c', $authenticateCommand.Trim()
) -AllowEmptyOutput | Out-Null

$userJson = Invoke-Docker -Arguments @(
    'exec', $keycloakContainer,
    $kcadm, 'get', 'users',
    '-r', $Realm,
    '-q', "email=$Email",
    '-q', 'exact=true'
)
$users = @($userJson | Out-String | ConvertFrom-Json)
$matches = @($users | Where-Object { $_.email -ieq $Email })

if ($matches.Count -eq 0) {
    throw "No user with the exact email '$Email' exists in realm '$Realm'."
}
if ($matches.Count -gt 1) {
    throw "More than one user has the email '$Email' in realm '$Realm'."
}
if (-not $matches[0].enabled) {
    throw "User '$Email' is disabled."
}
if ($matches[0].emailVerified) {
    throw "User '$Email' is already verified."
}

$target = "$Email in Keycloak realm $Realm"
if ($PSCmdlet.ShouldProcess($target, 'Send verification email')) {
    Invoke-Docker -Arguments @(
        'exec', $keycloakContainer,
        $kcadm, 'update', "users/$($matches[0].id)/send-verify-email",
        '-r', $Realm
    ) -AllowEmptyOutput | Out-Null

    Write-Host "Verification email requested for $Email."
}
