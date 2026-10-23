import axios from "axios";
import config from "@/config/environment";

const api = axios.create({
  baseURL: config.API_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

interface AuthStorage {
  state?: {
    token?: string;
  };
}

interface GuestStorage {
  state?: {
    userId?: string;
  };
}

function getStoredValue<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);

    if (!raw) return null;

    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

api.interceptors.request.use((requestConfig) => {
  const auth = getStoredValue<AuthStorage>("auth-storage");
  const guest = getStoredValue<GuestStorage>("guest-user-storage");

  const token = auth?.state?.token;
  const guestUserId = guest?.state?.userId;

  if (token) {
    requestConfig.headers.set("Authorization", `Bearer ${token}`);
  }

  if (guestUserId) {
    requestConfig.headers.set("X-Guest-Id", guestUserId);
  }

  return requestConfig;
});

export default api;
