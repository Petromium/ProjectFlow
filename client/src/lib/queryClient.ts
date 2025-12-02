import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest<T = unknown>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    // If we received a 401 but aren't set to return null, throw specific error
    // This helps the retry logic identify auth errors
    if (res.status === 401) {
      throw new Error("401: Unauthorized");
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes - reasonable default for most data
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime) - keep unused data for 10 min
      retry: (failureCount, error: any) => {
        const errorMsg = error?.message || "";
        // Don't retry auth errors (401)
        if (errorMsg.includes("401") || errorMsg.includes("Unauthorized")) return false;
        // Don't retry rate limits (429) - wait for user action
        if (errorMsg.includes("429") || errorMsg.includes("Too many requests")) return false;
        // Don't retry client errors (4xx) - these are user errors
        if (errorMsg.match(/^4\d{2}/)) return false;
        // Retry network/server errors (5xx, network failures) up to 3 times
        return failureCount < 3;
      },
    },
    mutations: {
      retry: false, // Mutations should not retry automatically
    },
  },
});
