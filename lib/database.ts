import { supabase } from "./supabase/client"
import { createServerClient } from "./supabase/server"

export interface Summary {
  id: string
  user_id: string | null // Allow null for anonymous users
  video_id: string
  video_url: string
  video_title: string
  video_duration: number
  overview: string
  highlights: string[]
  key_takeaways: string[]
  action_items: string[]
  quotes: string[]
  chapters: any
  faq: any
  glossary: any
  status: "processing" | "completed" | "failed"
  processing_time?: number
  tokens_used?: number
  error_message?: string
  summary_data: any
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  subscription_tier: string
  tokens_remaining: number
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

// Client-side database functions
export const db = {
  // Get user summaries
  async getUserSummaries(userId: string): Promise<Summary[]> {
    const { data, error } = await supabase
      .from("summaries")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw error
    return data || []
  },

  // Create a new summary
  async createSummary(summary: Partial<Summary>): Promise<Summary> {
    const { data, error } = await supabase.from("summaries").insert([summary]).select().single()

    if (error) throw error
    return data
  },

  // Update summary status
  async updateSummary(id: string, updates: Partial<Summary>): Promise<Summary> {
    const { data, error } = await supabase.from("summaries").update(updates).eq("id", id).select().single()

    if (error) throw error
    return data
  },

  // Get summary by ID
  async getSummary(id: string): Promise<Summary | null> {
    const { data, error } = await supabase.from("summaries").select("*").eq("id", id).single()

    if (error) {
      if (error.code === "PGRST116") return null // Not found
      throw error
    }
    return data
  },

  // Delete summary
  async deleteSummary(id: string): Promise<void> {
    const { error } = await supabase.from("summaries").delete().eq("id", id)

    if (error) throw error
  },

  // Get user profile
  async getUserProfile(userId: string): Promise<User | null> {
    const { data, error } = await supabase.from("users").select("*").eq("id", userId).single()

    if (error) {
      if (error.code === "PGRST116") return null // Not found
      throw error
    }
    return data
  },

  // Update user profile
  async updateUserProfile(userId: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabase.from("users").update(updates).eq("id", userId).select().single()

    if (error) throw error
    return data
  },
}

// Server-side database functions (for API routes and server actions)
export const serverDb = {
  // Create summary with server client
  async createSummary(summary: Partial<Summary>): Promise<Summary> {
    const client = createServerClient()
    if (!client) throw new Error("Supabase not configured")

    const { data, error } = await client.from("summaries").insert([summary]).select().single()

    if (error) throw error
    return data
  },

  // Update summary with server client
  async updateSummary(id: string, updates: Partial<Summary>): Promise<Summary> {
    const client = createServerClient()
    if (!client) throw new Error("Supabase not configured")

    const { data, error } = await client.from("summaries").update(updates).eq("id", id).select().single()

    if (error) throw error
    return data
  },
}
