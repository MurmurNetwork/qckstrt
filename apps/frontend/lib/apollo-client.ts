import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { generateHmacHeader } from "./hmac";

const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:3000/api";

// Custom fetch that adds HMAC header for request integrity
// SECURITY: User authentication is handled via JWT in Authorization header,
// NOT via a user header which could be spoofed.
const customFetch: typeof fetch = async (uri, options) => {
  // Extract path from URL for HMAC signing
  const url = new URL(
    GRAPHQL_URL,
    globalThis.location?.origin || "http://localhost:3200",
  );
  const path = url.pathname;

  // Generate HMAC header for request integrity
  const hmacHeader = await generateHmacHeader("POST", path);

  // Merge headers
  const headers = new Headers(options?.headers as HeadersInit);
  if (hmacHeader) {
    headers.set("X-HMAC-Auth", hmacHeader);
  }

  return fetch(uri, {
    ...options,
    headers,
  });
};

const httpLink = new HttpLink({
  uri: GRAPHQL_URL,
  fetch: customFetch,
});

export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});

export interface DemoUser {
  id: string;
  email: string;
  roles: string[];
  department: string;
  clearance: string;
}

export const setDemoUser = (user: DemoUser) => {
  globalThis.localStorage.setItem("user", JSON.stringify(user));
};

export const getDemoUser = (): DemoUser | null => {
  if (globalThis.localStorage === undefined) return null;
  const userJson = globalThis.localStorage.getItem("user");
  return userJson ? JSON.parse(userJson) : null;
};

export const clearDemoUser = () => {
  globalThis.localStorage.removeItem("user");
};
