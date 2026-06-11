// d:\xeno-ai-crm\frontend\src\services\api.js
import axios from 'axios';

// Backend URL is set to CRM backend
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
