@echo off
REM start-dev.sh(macOS용)를 Windows용으로 옮긴 스크립트
REM 실행 방법: 이 파일을 더블클릭하거나, cmd/PowerShell에서 start-dev.bat 실행

set "DIR=%~dp0"

REM 1) Backend (Python/uvicorn)
start "Planit Backend" cmd /k "cd /d "%DIR%" && python -m uvicorn server:app --reload"

REM 2) Checklist (Gradle)
start "Planit Checklist" cmd /k "cd /d "%DIR%Planit-Web-Checklist-main" && gradlew.bat bootRun"

REM 3) Auth (Gradle)
start "Planit Auth" cmd /k "cd /d "%DIR%Planit-Web-Auth-Plan-Quiz-master\Planit-Web-Auth-Plan-Quiz-master\backend" && gradlew.bat bootRun"

REM 4) Frontend (npm)
start "Planit Frontend" cmd /k "cd /d "%DIR%frontend" && npm run dev"
