@echo off
cd /d "D:\MG-Commerce"

if exist ".git\index.lock" del ".git\index.lock"

git add app.py modules/database.py push_render.bat
git status
git commit -m "feat: seed data update 2026-04-25"
git push origin main

pause
