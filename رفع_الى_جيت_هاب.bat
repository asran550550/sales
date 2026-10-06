@echo off
chcp 65001 > nul
title روز لمستحضرات التجميل - رفع الكود إلى GitHub
echo ================================================================
echo   🌸 جاري رفع المشروع إلى مستودعك على GitHub 🌸
echo   https://github.com/asran550550/sales.git
echo ================================================================
echo.

git remote remove origin 2>nul
git remote add origin https://github.com/asran550550/sales.git
git branch -M main

echo جاري الرفع الآن... يرجى تأكيد تسجيل الدخول إذا فتح المتصفح...
git push -u origin main

echo.
if %ERRORLEVEL% EQU 0 (
    echo ================================================================
    echo   مبروك! تم رفع المشروع بنجاح إلى GitHub!
    echo ================================================================
) else (
    echo.
    echo إذا ظهر خطأ إذن، تأكد من تسجيل الدخول بحساب asran550550 في المتصفح.
)
echo.
pause
