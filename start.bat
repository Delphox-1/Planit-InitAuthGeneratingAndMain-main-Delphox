@echo off
REM start-dev.sh(macOS용)를 Windows용으로 옮긴 스크립트
REM 실행 방법: 이 파일을 더블클릭하거나, cmd/PowerShell에서 start-dev.bat 실행

set "DIR=%~dp0"

REM 1) Backend (Python/uvicorn)
REM --host 0.0.0.0: 안드로이드 실기기(같은 와이파이)에서도 PC IP로 접속할 수 있게 한다.
start "Planit Backend" cmd /k "cd /d "%DIR%" && python -m uvicorn server:app --reload --host 0.0.0.0"

REM 2) Checklist (Gradle)
start "Planit Checklist" cmd /k "cd /d "%DIR%Planit-Web-Checklist-main" && gradlew.bat bootRun"

REM 3) Auth (Gradle)
start "Planit Auth" cmd /k "cd /d "%DIR%Planit-Web-Auth-Plan-Quiz-master\Planit-Web-Auth-Plan-Quiz-master\backend" && gradlew.bat bootRun"

REM 4) Frontend (npm)
start "Planit Frontend" cmd /k "cd /d "%DIR%frontend" && npm run dev"
