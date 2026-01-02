import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:3000/api";

/**
 * Extract CSRF token from cookie
 *
 * The CSRF token is set by the backend on every response as a non-httpOnly cookie,
 * allowing JavaScript to read it and send it back in the X-CSRF-Token header.
 */
function getCsrfToken(): string | undefined {
  if (typeof document === "undefined") return undefined;

  const cookies = document.cookie.split("; ");
  const csrfCookie = cookies.find((cookie) => cookie.startsWith("csrf-token="));

  if (csrfCookie) {
    return decodeURIComponent(csrfCookie.split("=")[1]);
  }

  return undefined;
}

/**
 * Custom fetch that adds CSRF token for request protection
 *
 * SECURITY: CSRF tokens protect against cross-site request forgery attacks.
 * The token is read from a cookie and sent in a header - this works because:
 * 1. Same-origin policy prevents other sites from reading our cookies
 * 2. The backend validates that the header matches the cookie
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
 */
const customFetch: typeof fetch = async (uri, options) => {
  const headers = new Headers(options?.headers as HeadersInit);

  // Add CSRF token from cookie for mutation protection
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  return fetch(uri, {
    ...options,
    headers,
    credentials: "include", // Send httpOnly auth cookies
  });
};

const httpLink = new HttpLink({
  uri: GRAPHQL_URL,
  fetch: customFetch,
  credentials: "include", // Ensure cookies are sent
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
