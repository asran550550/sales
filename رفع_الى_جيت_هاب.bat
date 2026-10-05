@echo off
chcp 65001 > nul
title روز لمستحضرات التجميل - رفع الكود إلى GitHub
echo ================================================================
echo   🌸 رفع مشروع روز لمستحضرات التجميل إلى حسابك على GitHub 🌸
echo ================================================================
echo.
echo 1. ادخل على حسابك في GitHub وأنشئ مستودع جديد (New Repository):
echo    https://github.com/new
echo.
echo 2. الصق رابط المستودع الخاص بك هنا (مثل https://github.com/username/repo.git):
set /p REPO_URL="رابط المستودع: "

if "%REPO_URL%"=="" (
    echo لم يتم إدخال رابط. يرجى إعادة المحاولة.
    pause
    exit /b
)

echo.
echo جاري ربط المستودع ورفع الملفات...
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main
git push -u origin main

echo.
echo ================================================================
echo تم رفع المشروع بنجاح إلى GitHub!
echo الآن يمكنك الانتقال إلى Vercel واختيار هذا المستودع للربط مع Turso.
echo ================================================================
pause
