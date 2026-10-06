@echo off
cd /d "%~dp0"
echo ========================================
echo   Pushing code to GitHub: asran550550/sales
echo ========================================
echo.
git remote remove origin 2>nul
git remote add origin https://github.com/asran550550/sales.git
git branch -M main
git push -u origin main
echo.
echo ========================================
pause
