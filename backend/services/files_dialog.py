"""Native Windows "open video" dialog, run on the backend machine."""
import subprocess

_PICK_SCRIPT = """
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Title = 'Sélectionner une vidéo'
$d.Filter = 'Vidéos (*.mp4;*.mkv;*.mov;*.avi;*.m4v;*.webm)|*.mp4;*.mkv;*.mov;*.avi;*.m4v;*.webm|Tous (*.*)|*.*'
if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.FileName }
"""


def open_video_dialog() -> str | None:
    result = subprocess.run(
        ["powershell", "-NoProfile", "-Command", _PICK_SCRIPT],
        capture_output=True, text=True,
    )
    path = result.stdout.strip()
    return path if path else None
