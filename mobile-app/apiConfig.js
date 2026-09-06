// Read the API URL from environment variables, defaulting to the local machine IP if not provided
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.151.63.12:8000';

export default API_BASE_URL;
