// Mock Supabase client for environments where @supabase/supabase-js is not available
export const isSupabaseConfigured = false

// Mock authentication methods
const mockAuth = {
  getUser: () => Promise.resolve({ data: { user: null }, error: null }),
  getSession: () => Promise.resolve({ data: { session: null }, error: null }),
  signInWithPassword: () =>
    Promise.resolve({ data: null, error: { message: "Mock client - authentication not available" } }),
  signUp: () => Promise.resolve({ data: null, error: { message: "Mock client - authentication not available" } }),
  signOut: () => Promise.resolve({ error: null }),
  onAuthStateChange: (callback) => {
    // Return a mock subscription
    return {
      data: { subscription: { unsubscribe: () => {} } },
    }
  },
}

// Mock database methods
const mockFrom = (table) => ({
  select: (columns = "*") => ({
    eq: (column, value) => ({
      single: () => Promise.resolve({ data: null, error: { message: "Mock client - database not available" } }),
      order: (column, options) => ({
        limit: (count) => Promise.resolve({ data: [], error: null }),
      }),
    }),
    order: (column, options) => ({
      limit: (count) => Promise.resolve({ data: [], error: null }),
    }),
  }),
  insert: (data) => ({
    select: () => Promise.resolve({ data: null, error: { message: "Mock client - database not available" } }),
  }),
  update: (data) => ({
    eq: (column, value) => ({
      select: () => Promise.resolve({ data: null, error: { message: "Mock client - database not available" } }),
    }),
  }),
  delete: () => ({
    eq: (column, value) => Promise.resolve({ error: null }),
  }),
})

// Create mock client
export const createClient = () => ({
  auth: mockAuth,
  from: mockFrom,
})

// Export singleton instance
export const supabase = createClient()
