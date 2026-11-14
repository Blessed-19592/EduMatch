import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Keep the CSRF token in memory, not localStorage.
let csrfToken = null;
let csrfRequest = null;

// Retrieve a CSRF token associated with the current session.
export const fetchCsrfToken = async () => {
    // Prevent multiple simultaneous token requests.
    if (csrfRequest) {
        return csrfRequest;
    }

    csrfRequest = api.get('/auth/csrf-token')
        .then((response) => {
            csrfToken = response.data.csrfToken;
            return csrfToken;
        })
        .finally(() => {
            csrfRequest = null;
        });

    return csrfRequest;
};

// Clear the cached token when the session changes.
export const clearCsrfToken = () => {
    csrfToken = null;
};

// Attach CSRF protection to state-changing requests.
api.interceptors.request.use(async (config) => {
    const method = config.method?.toUpperCase();

    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

    if (!safeMethods.includes(method)) {
        if (!csrfToken) {
            await fetchCsrfToken();
        }

        config.headers['X-CSRF-Token'] = csrfToken;
    }

    return config;
});

// Extract useful error messages from API responses.
export const getApiErrorMessage = (error) => {
    if (error.response?.data?.message) {
        return error.response.data.message;
    }

    if (error.response?.status === 500) {
        return 'A server error occurred. Please try again later.';
    }

    if (!error.response) {
        return 'Unable to connect to EduMatch. Check your connection and try again.';
    }

    return 'Something went wrong. Please try again.';
};

export default api;