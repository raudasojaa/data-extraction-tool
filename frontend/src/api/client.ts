import axios from "axios";
import { useAuthStore } from "@/store/authStore";

const api = axios.create({
  baseURL: "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const store = useAuthStore.getState();
      if (store.refreshToken) {
        try {
          const response = await axios.post("/api/v1/auth/refresh", {
            refresh_token: store.refreshToken,
          });
          store.setTokens(
            response.data.access_token,
            response.data.refresh_token
          );
          error.config.headers.Authorization = `Bearer ${response.data.access_token}`;
          return api.request(error.config);
        } catch {
          store.logout();
        }
      } else {
        store.logout();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
