$ErrorActionPreference = "Stop"

$secretDirectory = Join-Path $PSScriptRoot "secrets"
New-Item -ItemType Directory -Force -Path $secretDirectory | Out-Null

$names = @(
  "consultation_db_password",
  "api_db_password",
  "mcp_db_password",
  "gateway_db_password",
  "internal_gateway_token",
  "keycloak_db_password",
  "keycloak_bootstrap_password",
  "oidc_client_secret",
  "smtp_password"
)

foreach ($name in $names) {
  $target = Join-Path $secretDirectory "$name.txt"
  if (Test-Path -LiteralPath $target) {
    Write-Output "kept $name"
    continue
  }
  $bytes = [byte[]]::new(48)
  [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  $value = [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
  [IO.File]::WriteAllText($target, $value, [Text.UTF8Encoding]::new($false))
  Write-Output "created $name"
}

Write-Output "SMTP testing: replace secrets/smtp_password.txt with the provider credential."
Write-Output "Cloudflare is Stage 4; add secrets/cloudflare_tunnel_token.txt only when publishing."
