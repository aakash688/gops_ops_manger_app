# Fixes common Windows Gradle errors: "Unexpected lock protocol found in lock file"
# Safe to run; next build re-downloads resolved dependencies (may take longer once).

$ErrorActionPreference = "SilentlyContinue"

Write-Host "Stopping Gradle daemons..."
if (Test-Path ".\android\gradlew.bat") {
  Push-Location ".\android"
  & .\gradlew.bat --stop 2>$null
  Pop-Location
}

function Repair-GradleDir {
  param([string]$gradleHome)
  if (-not (Test-Path $gradleHome)) { return }
  Write-Host "Cleaning: $gradleHome"
  Remove-Item -Recurse -Force (Join-Path $gradleHome "caches\8.14.3") -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force (Join-Path $gradleHome "daemon") -ErrorAction SilentlyContinue
}

$dirs = @()
if ($env:GRADLE_USER_HOME) { $dirs += $env:GRADLE_USER_HOME }
$dirs += (Join-Path $env:USERPROFILE ".gradle")
foreach ($letter in @("D", "C")) {
  $root = "${letter}:\"
  if (Test-Path $root) {
    $dirs += (Join-Path $root "ggradle")
    $dirs += (Join-Path $root "ggradle-fresh")
  }
}
$dirs = $dirs | Select-Object -Unique
foreach ($d in $dirs) { Repair-GradleDir $d }

$repoLocal = Join-Path (Split-Path -Parent $PSScriptRoot) ".gradle-local-home"
if (Test-Path $repoLocal) {
  Write-Host "Removing legacy repo Gradle home (long paths): $repoLocal"
  Remove-Item -Recurse -Force $repoLocal -ErrorAction SilentlyContinue
}

Write-Host "Done. From project root run: npm run android"
Write-Host "Or APK only: npm run android:gradle-debug"
