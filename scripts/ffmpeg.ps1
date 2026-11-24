$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$dest = Join-Path $PWD '.cache/ffmpeg'
New-Item -ItemType Directory -Force $dest | Out-Null
$zip = Join-Path $dest 'release.zip'
$url = 'https://github.com/GyanD/codexffmpeg/releases/download/9.1/ffmpeg-9.1-essentials_build.zip'
$expected = 'b9bbbb3acece000cbeec994f856649354e52c773807841e78908374b24d658fd'
curl.exe -fsSL --retry 2 $url -o $zip
if ($LASTEXITCODE -ne 0 -or (Get-FileHash $zip -Algorithm SHA256).Hash -ne $expected) { throw 'Unduhan FFmpeg gagal diverifikasi.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($zip)
try {
    foreach ($exe in 'ffmpeg.exe', 'ffprobe.exe') {
        $entry = $archive.Entries | Where-Object { $_.FullName -like "*/bin/$exe" } | Select-Object -First 1
        if (!$entry) { throw "Paket tidak memuat $exe." }
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $dest $exe), $true)
    }
} finally { $archive.Dispose() }
& (Join-Path $dest 'ffmpeg.exe') -version | Select-Object -First 1

