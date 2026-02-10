import axios from 'axios';

const GAS_URL = import.meta.env.VITE_GAS_APP_URL || import.meta.env.VITE_GOOGLE_APP_SCRIPT_URL;

const client = axios.create({
    baseURL: GAS_URL,
    // Google Apps Script requires text/plain to avoid preflight OPTIONS request failure
    // or use JSON.stringify manually.
    headers: {
        'Content-Type': 'text/plain',
    },
});

export const postToGAS = async (action, data = {}) => {
    try {
        const response = await client.post('', JSON.stringify({ action, ...data }));
        // GAS often returns 200 even for logical errors, check response.data.status
        if (response.data.status === 'error') {
            throw new Error(response.data.message || 'Unknown error');
        }
        return response.data;
    } catch (error) {
        if (error.response?.data?.message) {
            throw new Error(error.response.data.message);
        }
        throw error;
    }
};

export default client;
