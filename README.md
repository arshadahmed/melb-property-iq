# 🏙️ Melbourne Property IQ

A mobile-first property investment intelligence app for Melbourne suburbs.  
Data sourced from **Valuer-General Victoria** and **data.vic.gov.au** — all free.

---

## Stack
- **Frontend**: React + Vite + Recharts
- **Backend**: Node.js + Express + SQLite
- **Data**: Victorian Government open data (VPSR, Rental Report)

## Quick Start

### 1. Install everything
```bash
npm run install:all
```

### 2. Download data (one-time)
```bash
cd server
node jobs/downloadData.js
```

### 3. Seed the database
```bash
cd server
node db/seed.js
```

### 4. Run the app
```bash
npm run dev
```

- Frontend: http://localhost:5173  
- Backend API: http://localhost:3001

---

## Data Sources
| Dataset | URL |
|---|---|
| Victorian Property Sales Report | https://discover.data.vic.gov.au/dataset/victorian-property-sales-report-median-house-by-suburb |
| VPSR Quarterly | https://discover.data.vic.gov.au/dataset/victorian-property-sales-report-median-house-by-suburb-quarterly |
| Rental Report | https://discover.data.vic.gov.au/dataset/victorian-rental-report |

## API Endpoints
| Endpoint | Description |
|---|---|
| `GET /api/suburbs` | All suburbs with median, growth, yield |
| `GET /api/suburbs/:name` | Single suburb detail |
| `GET /api/suburbs/:name/trend` | Price trend over time |
| `GET /api/suburbs/leaderboard` | Top suburbs by score |
| `GET /api/rental/:suburb` | Rental data |
| `GET /api/auctions/recent` | Recent auction results |
