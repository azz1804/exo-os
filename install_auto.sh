#!/bin/bash
echo "⚙️ Installation de l'Automatisation Exo OS (21h00 par jour)"
mkdir -p "/Users/asus/Exo OS/logs"
cp "/Users/asus/Exo OS/com.exoos.orchestrator.plist" ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.exoos.orchestrator.plist
echo "✅ Orchestrateur d'ingestion planifié."
echo "Pour stopper : launchctl unload ~/Library/LaunchAgents/com.exoos.orchestrator.plist"
