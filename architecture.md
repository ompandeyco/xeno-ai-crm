# System Architecture

## Overview

This system is built as three separate services that communicate over HTTP.

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│              React + Vite (port 5173)                        │
│   Marketer types goal → Views segments → Sees campaign stats │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (Axios)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     CRM BACKEND                              │
│           Node.js + Express + MongoDB (port 5001)            │
│                                                              │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │  Customers │  │   Campaigns  │  │   Comm. Logs      │   │
│  │  /orders   │  │  /segments   │  │   /receipts       │   │
│  └────────────┘  └──────────────┘  └───────────────────┘   │
│                         │                     ▲             │
│                         │ HTTP POST           │ Callback    │
└─────────────────────────┼─────────────────────┼────────────┘
                          │                     │
                          ▼                     │
┌─────────────────────────────────────────────────────────────┐
│                   CHANNEL SERVICE                            │
│              Node.js + Express (port 5002)                   │
│                                                              │
│   Receives message → Simulates delivery → Returns receipt    │
│         WhatsApp | Email | SMS (90% success rate)            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
                   [External APIs]
               Twilio / SendGrid / Meta
                  (future real impl)
```

## Data Flow

### Campaign Launch Flow
1. Marketer types: *"Re-engage customers who haven't ordered in 30 days"*
2. AI (Gemini) converts this to a MongoDB query filter
3. CRM Backend queries matching customers
4. For each customer, CRM sends a message request to Channel Service
5. Channel Service simulates delivery and calls back CRM with receipt
6. CRM stores receipt — marketer sees delivered/failed stats

## Service Responsibilities

### CRM Backend (`/crm-backend`)
- Customer ingestion via bulk upload or API
- Order storage and history
- Audience segmentation (rule-based + AI-assisted)
- Campaign creation and management
- Communication log tracking
- Receipt webhook endpoint

### Channel Service (`/channel-service`)
- Accepts message dispatch requests from CRM
- Routes to correct channel simulator (WhatsApp/Email/SMS)
- Returns async delivery receipts
- Simulates real-world failure rates

### Frontend (`/frontend`)
- Natural language campaign goal input
- Customer and segment explorer
- Campaign dashboard with charts
- Real-time delivery stats via Recharts
