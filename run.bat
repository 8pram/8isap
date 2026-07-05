@echo off
echo ===================================================
echo 🚀 ISAP Command Center - Local Server Starter
echo ===================================================

echo [1] Memeriksa Direktori...
cd "%~dp0"

echo [2] Menjalankan Node.js (API Gateway + AI Scraper)...
start "ISAP Node.js Server" cmd /c "cd backend-node && npm install && npm start"

echo [3] Server Monolith sedang berjalan di background!
echo Node.js API: http://localhost:3000
echo ===================================================
echo Anda bisa membuka file frontend/index.html di browser Anda sekarang.
pause
