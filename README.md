# Xeno AI-Native Mini CRM

An AI-powered CRM for consumer brands that lets marketers describe goals in plain English and uses AI to decide who to target, what to say, and which channel to use.

## Project Structure

```
xeno-ai-crm/
├── frontend/           # React + Vite + Tailwind UI
├── crm-backend/        # Node.js + Express + MongoDB core service
├── channel-service/    # Message delivery simulator (WhatsApp/Email/SMS)
├── README.md
└── architecture.md
```

## Getting Started

### 1. CRM Backend
```bash
cd crm-backend
cp .env.example .env      # Fill in your values
npm install
npm run dev               # Runs on http://localhost:5001
```

### 2. Channel Service
```bash
cd channel-service
cp .env.example .env
npm install
npm run dev               # Runs on http://localhost:5002
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev               # Runs on http://localhost:5173
```

## Tech Stack

| Layer     | Technology                  |
|-----------|-----------------------------|
| Frontend  | React, Vite, Tailwind CSS, Recharts, Axios |
| Backend   | Node.js, Express.js         |
| Database  | MongoDB + Mongoose          |
| AI        | Google Gemini API           |
