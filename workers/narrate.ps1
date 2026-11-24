param([string]$TextPath,[string]$OutputPath,[int]$Rate=0,[int]$Volume=100)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $speaker.Rate = [Math]::Max(-10, [Math]::Min(10, $Rate))
  $speaker.Volume = [Math]::Max(20, [Math]::Min(100, $Volume))
  $speaker.SetOutputToWaveFile($OutputPath)
  $speaker.Speak([IO.File]::ReadAllText($TextPath))
} finally { $speaker.Dispose() }
