import { cache } from "react"

export const isSupabaseConfigured = false

// Mock server client that matches the client interface
export const createClient = cache(() => ({
  auth: {
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
  },
  from: (table) => ({
    select: (columns = "*") => ({
      eq: (column, value) => ({
        single: () =>
          Promise.resolve({ data: null, error: { message: "Mock server client - database not available" } }),
      }),
    }),
    insert: (data) => ({
      select: () => Promise.resolve({ data: null, error: { message: "Mock server client - database not available" } }),
    }),
    update: (data) => ({
      eq: (column, value) => ({
        select: () =>
          Promise.resolve({ data: null, error: { message: "Mock server client - database not available" } }),
      }),
    }),
  }),
}))

// Legacy export for backward compatibility
export const createServerClient = createClient
