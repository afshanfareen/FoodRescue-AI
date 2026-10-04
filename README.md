# FoodRescue AI

AI-Assisted Hyperlocal Surplus Food Redistribution Platform.

Connects food donors (restaurants, hotels, events) with NGOs via trained volunteers, using AI quality screening and smart matching to reduce food waste.

---

## Features

- **AI Quality Screening** — computer vision + rule-based scoring on donated food
- **Smart Matching** — weighted scoring to match donations with nearby NGOs and available volunteers
- **Role-based Dashboards** — Admin, Donor, Volunteer, NGO each have their own workflow
- **OTP-verified Pickup & Delivery** — tamper-proof handoff chain
- **Impact Analytics** — food rescued, meals served, CO₂ saved estimates
- **Demand Forecasting** — historical trend analysis per zone

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, shadcn/ui |
| Backend | FastAPI (Python), SQLAlchemy ORM, Alembic migrations |
| Database | PostgreSQL |
| Auth | JWT (python-jose), bcrypt (passlib) |
| AI/ML | scikit-learn, numpy, pandas, Pillow |
| Maps | Leaflet.js |
| Charts | Recharts |

---

## Project Structure

```
foodrescue-ai/
├── backend/                  # FastAPI application
│   ├── app/
│   │   ├── api/routes/       # Auth, donations, volunteers, NGOs, admin, delivery
│   │   ├── core/             # Config, database, security, deps
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── ai/               # Quality screening, matching, forecasting
│   │   └── services/         # Audit logs, notifications
│   ├── alembic/              # DB migrations
│   ├── scripts/              # Seed data, model training
│   ├── requirements.txt
│   └── .env.example
├── frontend/                 # React + Vite SPA
│   ├── src/
│   │   ├── pages/            # Admin, Donor, Volunteer, NGO, Auth pages
│   │   ├── components/       # UI components, layout, maps
│   │   ├── stores/           # Auth store
│   │   ├── lib/              # API client, utils
│   │   └── types/            # Shared TypeScript types
│   ├── package.json
│   └── vite.config.ts
└── docker-compose.yml
```

---

## Getting Started

### Prerequisites

- Python 3.10+ (tested on 3.14)
- Node.js 18+
- PostgreSQL 14+

### Backend Setup

```bash
cd backend

# Copy env file and fill in your values
cp .env.example .env

# Install dependencies
pip install -r requirements.txt

# Create the database (run once)
python -c "
import psycopg, os
conn = psycopg.connect('host=127.0.0.1 port=5432 user=postgres password=postgres dbname=postgres', autocommit=True)
conn.cursor().execute('CREATE DATABASE foodrescue')
conn.close()
print('Database created')
"

# Start the server (tables auto-created on startup)
uvicorn app.main:app --reload --port 8000

# Seed demo data (optional)
python scripts/seed_data.py
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open http://localhost:5173

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@foodrescue.ai | Admin@1234 |
| Donor | spicegarden@demo.com | Donor@1234 |
| Volunteer | raj@demo.com | Vol@1234 |
| NGO | annapoorna@demo.com | NGO@1234 |

---

## API Documentation

Once the backend is running, visit:
- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

---

## Deployment

### Backend (Render)

A `render.yaml` is included in `backend/`. Set these environment variables in the Render dashboard:
- `DATABASE_URL` — PostgreSQL connection string (use `postgresql+psycopg://...`)
- `SECRET_KEY` — random 32+ char string
- `CORS_ORIGINS` — your frontend URL

### Frontend (Vercel)

A `vercel.json` is included in `frontend/`. Set:
- `VITE_API_URL` — your Render backend URL + `/api`

---

## Environment Variables

See `backend/.env.example` for all available configuration options.

---

## Disclaimer

AI quality screening scores are decision aids only. They are **not** food safety certifications and should not replace professional food safety judgment.

---

## License

MIT
