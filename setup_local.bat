@echo off
echo Installing frontend...
cd frontend
call npm install
call npm run build
cd ..\backend
echo Installing backend...
python -m pip install -r requirements.txt
echo.
echo Starting portal...
python app.py
pause
