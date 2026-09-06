const host = (typeof window !== 'undefined' && window.location && window.location.hostname) 
  ? window.location.hostname 
  : 'localhost';

const API_BASE_URL = import.meta.env.VITE_API_URL || `http://${host}:8000`;
export default API_BASE_URL;

