import { cache } from "react"

export const isSupabaseConfigured = false

// Mock server client that matches the client interface
export const createClient = cache(() => ({
  auth: {
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    signInWithPassword: ({ email, password }: { email: string; password: string }) =>
      Promise.resolve({
        data: { user: null, session: null },
        error: { message: "Authentication not available in demo mode" },
      }),
    signUp: ({ email, password, options }: { email: string; password: string; options?: any }) =>
      Promise.resolve({
        data: { user: null, session: null },
        error: { message: "Sign up not available in demo mode" },
      }),
    signOut: () => Promise.resolve({ error: null }),
  },
  from: (table: string) => ({
    select: (columns = "*") => ({
      eq: (column: string, value: any) => ({
        single: () =>
          Promise.resolve({ data: null, error: { message: "Mock server client - database not available" } }),
      }),
    }),
    insert: (data: any) => ({
      select: () => Promise.resolve({ data: null, error: { message: "Mock server client - database not available" } }),
    }),
    update: (data: any) => ({
      eq: (column: string, value: any) => ({
        select: () =>
          Promise.resolve({ data: null, error: { message: "Mock server client - database not available" } }),
      }),
    }),
  }),
}))

// Legacy export for backward compatibility
export const createServerClient = createClient
