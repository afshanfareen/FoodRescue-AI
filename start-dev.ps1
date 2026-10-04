#!/usr/bin/env pwsh
# FoodRescue AI - Local Development Startup Script (Windows PowerShell)
# Run from the project root: .\start-dev.ps1

Write-Host "🌿 FoodRescue AI - Starting Local Development" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# Check prerequisites
Write-Host "`n[1/4] Checking prerequisites..." -ForegroundColor Cyan

$pythonOk = $null -ne (Get-Command python -ErrorAction SilentlyContinue)
$nodeOk   = $null -ne (Get-Command node -ErrorAction SilentlyContinue)
$npmOk    = $null -ne (Get-Command npm -ErrorAction SilentlyContinue)

if (-not $pythonOk) { Write-Host "  ❌ Python not found. Install from https://python.org" -ForegroundColor Red }
else { Write-Host "  ✅ Python found" -ForegroundColor Green }

if (-not $nodeOk) { Write-Host "  ❌ Node.js not found. Install from https://nodejs.org" -ForegroundColor Red }
else { Write-Host "  ✅ Node.js found" -ForegroundColor Green }

if (-not $pythonOk -or -not $nodeOk) {
    Write-Host "`nPlease install missing prerequisites and re-run." -ForegroundColor Yellow
    exit 1
}

# Backend setup
Write-Host "`n[2/4] Setting up backend..." -ForegroundColor Cyan
Set-Location backend

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "  ✅ Created backend/.env from .env.example" -ForegroundColor Green
    Write-Host "  ⚠️  Edit backend/.env with your DATABASE_URL" -ForegroundColor Yellow
}

if (-not (Test-Path "venv")) {
    Write-Host "  Creating virtual environment..." -ForegroundColor Gray
    python -m venv venv
}

Write-Host "  Installing Python dependencies..." -ForegroundColor Gray
.\venv\Scripts\python.exe -m pip install -r requirements.txt -q

Write-Host "  ✅ Backend dependencies installed" -ForegroundColor Green
Set-Location ..

# Frontend setup
Write-Host "`n[3/4] Setting up frontend..." -ForegroundColor Cyan
Set-Location frontend

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "  ✅ Created frontend/.env" -ForegroundColor Green
}

if (-not (Test-Path "node_modules")) {
    Write-Host "  Installing Node.js dependencies..." -ForegroundColor Gray
    npm install --silent
}

Write-Host "  ✅ Frontend dependencies installed" -ForegroundColor Green
Set-Location ..

Write-Host "`n[4/4] Instructions" -ForegroundColor Cyan
Write-Host ""
Write-Host "Start Backend (in one terminal):" -ForegroundColor White
Write-Host "  cd backend" -ForegroundColor Gray
Write-Host "  .\venv\Scripts\Activate.ps1" -ForegroundColor Gray
Write-Host "  python scripts/seed_data.py   # first time only" -ForegroundColor Gray
Write-Host "  uvicorn app.main:app --reload --port 8000" -ForegroundColor Gray
Write-Host ""
Write-Host "Start Frontend (in another terminal):" -ForegroundColor White
Write-Host "  cd frontend" -ForegroundColor Gray
Write-Host "  npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "Open in browser:" -ForegroundColor White
Write-Host "  Frontend:  http://localhost:5173" -ForegroundColor Cyan
Write-Host "  API Docs:  http://localhost:8000/api/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Demo Credentials:" -ForegroundColor White
Write-Host "  Admin:     admin@foodrescue.ai     / Admin@1234" -ForegroundColor Gray
Write-Host "  Donor:     spicegarden@demo.com    / Donor@1234" -ForegroundColor Gray
Write-Host "  Volunteer: raj@demo.com             / Vol@1234" -ForegroundColor Gray
Write-Host "  NGO:       annapoorna@demo.com      / NGO@1234" -ForegroundColor Gray
Write-Host ""
Write-Host "🌿 Setup complete!" -ForegroundColor Green
