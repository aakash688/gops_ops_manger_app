param(
  [Parameter(Position = 0)]
  [ValidateSet("run", "apk", "prebuild")]
  [string]$Action = "run",

  # Default matches a common standalone SDK path; override or set ANDROID_SDK_ROOT / ANDROID_HOME
  [string]$AndroidSdk = "",

  # Isolated Gradle home on drive root (short path; fixes corrupt cache and Windows MAX_PATH)
  [switch]$FreshGradleHome,

  # Clean stale native outputs under node_modules and app CMake cache, then gradlew clean + assemble.
  # Does not delete build/generated (codegen JNI); deleting that breaks :externalNativeBuildCleanDebug / CMake.
  [switch]$Clean
)

$ErrorActionPreference = "Stop"

$AppRoot = Split-Path -Parent $PSScriptRoot
Set-Location $AppRoot

$sdk = $AndroidSdk
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if (-not $sdk) { $sdk = $env:ANDROID_HOME }
if (-not $sdk) { $sdk = "C:\Android" }

if (-not (Test-Path $sdk)) {
  Write-Error "Android SDK not found at '$sdk'. Pass -AndroidSdk or set ANDROID_SDK_ROOT / ANDROID_HOME."
}

$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk

if ($FreshGradleHome) {
  # Do not use a cache dir inside the repo: paths exceed Windows MAX_PATH for prefab/CMake.
  $driveRoot = Split-Path -Qualifier $AppRoot
  $gh = Join-Path $driveRoot "ggradle-fresh"
  New-Item -ItemType Directory -Force -Path $gh | Out-Null
  $env:GRADLE_USER_HOME = $gh
  Write-Host "GRADLE_USER_HOME -> $gh" -ForegroundColor DarkCyan
}

Write-Host "ANDROID_HOME -> $sdk" -ForegroundColor DarkCyan

switch ($Action) {
  "prebuild" {
    npx expo prebuild --platform android
  }
  "apk" {
    if ($Clean) {
      Write-Host "Cleaning library android/build under node_modules (keeping generated/codegen)..." -ForegroundColor DarkCyan
      Get-ChildItem -Path (Join-Path $AppRoot "node_modules") -Recurse -Directory -Filter "build" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match '\\android\\build$' } |
        ForEach-Object {
          $buildDir = $_.FullName
          Get-ChildItem -LiteralPath $buildDir -Force -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -ne "generated" } |
            ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
        }
      $appCxx = Join-Path $AppRoot "android\app\.cxx"
      if (Test-Path $appCxx) {
        Write-Host "Removing android/app/.cxx (fresh CMake)..." -ForegroundColor DarkCyan
        Remove-Item -LiteralPath $appCxx -Recurse -Force -ErrorAction SilentlyContinue
      }
      Push-Location (Join-Path $AppRoot "android")
      try {
        .\gradlew.bat clean
      }
      finally {
        Pop-Location
      }
    }
    Push-Location (Join-Path $AppRoot "android")
    try {
      .\gradlew.bat assembleDebug
    }
    finally {
      Pop-Location
    }
    $apk = Join-Path $AppRoot "android\app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apk) {
      Write-Host "`nDebug APK: $apk" -ForegroundColor Green
    }
  }
  "run" {
    npx expo run:android
  }
}
