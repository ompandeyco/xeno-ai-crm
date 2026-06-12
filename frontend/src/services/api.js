// d:\xeno-ai-crm\frontend\src\services\api.js
import axios from 'axios';

// In development: Vite proxy forwards /api/* → http://localhost:5001/api (no CORS)
// In production:  Set VITE_API_URL to your deployed backend URL
const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;

