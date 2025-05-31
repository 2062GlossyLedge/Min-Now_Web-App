import { useAuth } from "@clerk/nextjs";
import { fetchWithCsrf } from "@/utils/api";
import { useCallback } from "react";

export const useAuthenticatedFetch = () => {
    const { getToken } = useAuth();

    const authenticatedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        const token = await getToken();

        console.log('Fetching with jwt token:', token)

        const response = await fetchWithCsrf(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${token}`,
            },
        });

        return response;
    }, [getToken]);

    return { authenticatedFetch };
}; 