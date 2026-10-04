#!/bin/bash
# FoodRescue AI - Local Development Startup Script (Mac/Linux)
# Usage: chmod +x start-dev.sh && ./start-dev.sh

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🌿 FoodRescue AI - Starting Local Development${NC}"
echo "============================================="

# Check prerequisites
echo -e "\n${CYAN}[1/4] Checking prerequisites...${NC}"
command -v python3 >/dev/null 2>&1 && echo -e "  ${GREEN}✅ Python3 found${NC}" || { echo -e "  ${RED}❌ Python3 not found${NC}"; exit 1; }
command -v node >/dev/null 2>&1 && echo -e "  ${GREEN}✅ Node.js found${NC}" || { echo -e "  ${RED}❌ Node.js not found${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 && echo -e "  ${GREEN}✅ npm found${NC}" || { echo -e "  ${RED}❌ npm not found${NC}"; exit 1; }

# Backend setup
echo -e "\n${CYAN}[2/4] Setting up backend...${NC}"
cd backend

if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "  ${GREEN}✅ Created backend/.env from .env.example${NC}"
    echo -e "  ${YELLOW}⚠️  Edit backend/.env with your DATABASE_URL${NC}"
fi

if [ ! -d "venv" ]; then
    echo "  Creating virtual environment..."
    python3 -m venv venv
fi

echo "  Installing Python dependencies..."
./venv/bin/pip install -r requirements.txt -q
echo -e "  ${GREEN}✅ Backend dependencies installed${NC}"
cd ..

# Frontend setup
echo -e "\n${CYAN}[3/4] Setting up frontend...${NC}"
cd frontend

if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "  ${GREEN}✅ Created frontend/.env${NC}"
fi

if [ ! -d "node_modules" ]; then
    echo "  Installing Node.js dependencies..."
    npm install --silent
fi

echo -e "  ${GREEN}✅ Frontend dependencies installed${NC}"
cd ..

echo -e "\n${CYAN}[4/4] Instructions${NC}"
echo ""
echo -e "${NC}Start Backend (in one terminal):"
echo "  cd backend"
echo "  source venv/bin/activate"
echo "  python scripts/seed_data.py   # first time only"
echo "  uvicorn app.main:app --reload --port 8000"
echo ""
echo "Start Frontend (in another terminal):"
echo "  cd frontend"
echo "  npm run dev"
echo ""
echo -e "Open in browser:"
echo -e "  ${CYAN}Frontend:  http://localhost:5173${NC}"
echo -e "  ${CYAN}API Docs:  http://localhost:8000/api/docs${NC}"
echo ""
echo "Demo Credentials:"
echo "  Admin:     admin@foodrescue.ai     / Admin@1234"
echo "  Donor:     spicegarden@demo.com    / Donor@1234"
echo "  Volunteer: raj@demo.com             / Vol@1234"
echo "  NGO:       annapoorna@demo.com      / NGO@1234"
echo ""
echo -e "${GREEN}🌿 Setup complete!${NC}"
