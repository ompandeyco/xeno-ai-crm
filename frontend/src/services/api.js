// d:\xeno-ai-crm\frontend\src\services\api.js
import axios from 'axios';

// In development: Vite dev proxy forwards /api/* → http://localhost:5001 (baseURL = '/api')
// In production:  VITE_API_URL = https://xeno-crm-backend-bnqv.onrender.com
//                 We append /api so every call like api.get('/customers')
//                 resolves to https://xeno-crm-backend-bnqv.onrender.com/api/customers
const RAW_BASE = import.meta.env.VITE_API_URL || '';
const API_BASE = RAW_BASE ? `${RAW_BASE}/api` : '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;

