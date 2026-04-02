# VermilionVoid Sync Plugin Build Script

# 1. Install dependencies
npm install

# 2. Build the plugin
npm run build

Write-Host "`nBuild complete. To install the plugin manually:" -ForegroundColor Green
Write-Host "1. Create a folder in your Obsidian vault: .obsidian/plugins/vermilion-void-sync/"
Write-Host "2. Copy 'main.js', 'manifest.json', and 'styles.css' (if it exists) to that folder."
Write-Host "3. Reload Obsidian and enable the plugin in 'Community Plugins'."
