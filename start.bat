@echo off
chcp 65001 >nul
title MG Commerce - 자동화 플랫폼
color 0A
echo.
echo  ╔══════════════════════════════════════╗
echo  ║   MG Commerce 자동화 플랫폼 시작!   ║
echo  ║   잠시만 기다려주세요...              ║
echo  ╚══════════════════════════════════════╝
echo.

cd /d D:\MG-Commerce

:: Python 경로 설정
set PATH=C:\Users\cmg97\AppData\Local\Programs\Python\Python312;C:\Users\cmg97\AppData\Local\Programs\Python\Python312\Scripts;%PATH%

:: 데이터 경로 (D드라이브)
set MG_DATA_DIR=D:\MG-Commerce\data

:: 서버 시작 (백그라운드)
start /B python app.py

:: 2초 대기 후 Chrome 앱 모드로 열기
timeout /t 2 /nobreak >nul

:: Chrome 앱 모드 (브라우저 탭이 아닌 독립 앱 창으로 열림)
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:5000 --window-size=1400,900

echo.
echo  서버가 실행 중입니다. 이 창을 닫으면 서버가 종료됩니다.
echo  종료하려면 이 창을 닫거나 Ctrl+C를 누르세요.
echo.

:: 서버 프로세스가 끝날 때까지 대기
pause >nul
