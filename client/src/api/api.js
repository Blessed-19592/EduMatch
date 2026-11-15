import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

let csrfToken = null;
let csrfRequest = null;

export function clearCsrfToken() {
  csrfToken = null;
}

export async function fetchCsrfToken({ force = false } = {}) {
  if (force) csrfToken = null;
  if (csrfToken) return csrfToken;
  if (csrfRequest) return csrfRequest;

  csrfRequest = api.get('/auth/csrf-token')
    .then(({ data }) => {
      if (!data?.csrfToken) throw new Error('The server did not return a CSRF token.');
      csrfToken = data.csrfToken;
      return csrfToken;
    })
    .finally(() => { csrfRequest = null; });

  return csrfRequest;
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = await fetchCsrfToken();
    config.headers = config.headers || {};
    config.headers['X-CSRF-Token'] = token;
  }
  return config;
});

export function getApiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.code === 'ECONNABORTED') return 'The request took too long. Please try again.';
  if (!error?.response) return 'Unable to connect to EduMatch. Check that the server is running and try again.';
  return error.response.data?.message || fallback;
}

export default api;
