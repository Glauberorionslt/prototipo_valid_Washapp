import { useEffect, useState } from "react";
import { ApiError, fetchCurrentUser, type CurrentUser } from "@/lib/api";
import { clearAccessToken, getAccessToken } from "@/lib/auth";

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    let active = true;

    fetchCurrentUser()
      .then((value) => {
        if (!active) return;
        setUser(value);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) {
          clearAccessToken();
        }
        setUser(null);
        setError(err instanceof Error ? err.message : "Falha ao carregar sessao");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return { user, loading, error };
}