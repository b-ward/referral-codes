# Regenerate the committed sharing image on Windows. Not needed for site builds.
Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Bitmap]::new(1200, 630)
$canvas = [System.Drawing.Graphics]::FromImage($image)
$canvas.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$canvas.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$green = [System.Drawing.ColorTranslator]::FromHtml('#183548')
$lime = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#f7e4a4'))
$white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$circle = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#244a60'))
$brandFont = [System.Drawing.Font]::new('Georgia', 32, [System.Drawing.FontStyle]::Bold)
$headlineFont = [System.Drawing.Font]::new('Georgia', 68)
$italicFont = [System.Drawing.Font]::new('Georgia', 68, [System.Drawing.FontStyle]::Italic)
$bodyFont = [System.Drawing.Font]::new('Arial', 20)
try {
  $canvas.Clear($green)
  $canvas.FillEllipse($circle, 800, -200, 560, 560)
  $canvas.DrawString('SignUp Sidekick', $brandFont, $lime, 84, 60)
  $canvas.DrawString('Referral codes.', $headlineFont, $white, 80, 205)
  $canvas.DrawString('Yours to use.', $italicFont, $lime, 80, 315)
  $canvas.DrawString('A personal list of offers, links and claim instructions.', $bodyFont, $white, 90, 510)
  $target = Join-Path $PSScriptRoot '../public/social.png'
  $image.Save([System.IO.Path]::GetFullPath($target), [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $canvas.Dispose(); $image.Dispose()
  $lime.Dispose(); $white.Dispose(); $circle.Dispose()
  $brandFont.Dispose(); $headlineFont.Dispose(); $italicFont.Dispose(); $bodyFont.Dispose()
}
