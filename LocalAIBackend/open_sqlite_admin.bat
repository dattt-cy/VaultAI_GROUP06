@echo off
chcp 65001 > nul
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║        LOCAL AI – ADMIN PANEL LAUNCHER       ║
echo  ╚══════════════════════════════════════════════╝
echo.
echo  [1] SQLite Web UI   →  http://localhost:8080
echo  [2] FastAPI Swagger →  http://127.0.0.1:8000/docs
echo      Admin API       →  http://127.0.0.1:8000/api/admin/overview
echo.

:: Cửa sổ 1 – SQLite Viewer
start "SQLite Admin" cmd /k "cd /d %~dp0 && venv\Scripts\python.exe -m sqlite_web localai.db --host 0.0.0.0 --port 8080"

:: Đợi 1 giây rồi mở trình duyệt
timeout /t 2 /nobreak > nul
start http://localhost:8080

echo  Đang khởi động... Nhấn Ctrl+C để dừng SQLite Viewer.
pause
