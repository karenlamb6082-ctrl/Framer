Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap(800,600)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(70,130,180))
$brush1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255,200,100))
$g.FillEllipse($brush1, 100, 80, 200, 200)
$brush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(34,139,34))
$g.FillRectangle($brush2, 400, 300, 300, 200)
$g.Dispose()
$bmp.Save("e:\vibe\photoeditor\test_photo.jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg)
$bmp.Dispose()
Write-Host "OK"
