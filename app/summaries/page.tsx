"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar, Clock, ExternalLink, Database, LogIn, User } from "lucide-react"
import Link from "next/link"
import { SummaryDisplay } from "@/components/summary-display"

interface StoredSummary {
  id: string
  video_id: string
  video_url: string
  video_title: string
  overview: string
  highlights: string[]
  key_takeaways: string[]
  chapters: any[]
  faq: any[]
  glossary: any[]
  video_duration: number
  processing_time: number
  created_at: string
  summary_data: any
  user_id: string | null
}

export default function SummariesPage() {
  const [summaries, setSummaries] = useState<StoredSummary[]>([])
  const [selectedSummary, setSelectedSummary] = useState<StoredSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string>("")
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
      setAuthLoading(false)
    }

    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!authLoading) {
      fetchSummaries()
    }
  }, [authLoading, user])

  const fetchSummaries = async () => {
    try {
      setLoading(true)
      setError(null)
      setDebugInfo("")

      let query = supabase
        .from("summaries")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(50)

      if (user) {
        query = query.eq("user_id", user.id)
        console.log(`Fetching summaries for user: ${user.id}`)
      } else {
        query = query.is("user_id", null)
        console.log("Fetching public summaries...")
      }

      const { data, error, count } = await query

      console.log("Query result:", { data, error, count })

      if (error) {
        console.error("Error fetching summaries:", error)
        setError(`Database error: ${error.message}`)
        setDebugInfo(`Error code: ${error.code}, Details: ${error.details}`)
        return
      }

      const userInfo = user ? `for user ${user.email}` : "public summaries"
      setDebugInfo(`Found ${count || 0} total summaries ${userInfo}, displaying ${data?.length || 0}`)
      setSummaries(data || [])

      if (!data || data.length === 0) {
        console.log("No summaries found in database")
        if (user) {
          setError("No summaries found. Generate your first summary!")
        } else {
          setError("Sign in to view your personal summaries, or generate your first summary!")
        }
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      setError("An unexpected error occurred")
      setDebugInfo(`Error: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (selectedSummary) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <Button onClick={() => setSelectedSummary(null)} variant="outline" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Summaries
            </Button>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                <Database className="w-3 h-3 mr-1" />
                Saved Data
              </Badge>
              <span className="text-sm text-gray-600">Generated on {formatDate(selectedSummary.created_at)}</span>
            </div>
          </div>

          <SummaryDisplay
            summary={{
              overview: selectedSummary.overview,
              highlights: selectedSummary.highlights,
              keyTakeaways: selectedSummary.key_takeaways,
              chapters: selectedSummary.chapters,
              faq: selectedSummary.faq,
              glossary: selectedSummary.glossary,
            }}
            videoTitle={selectedSummary.video_title}
            transcript={selectedSummary.summary_data?.transcript || ""}
            audioStatus={{
              successful: selectedSummary.summary_data?.audioStatus?.successful || false,
              method: selectedSummary.summary_data?.audioStatus?.method || "Unknown",
              error: selectedSummary.summary_data?.audioStatus?.error || null,
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/">
            <Button variant="outline" className="mb-4 bg-transparent">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {user ? "Your Video Summaries" : "Recent Video Summaries"}
              </h1>
              <p className="text-gray-600">
                {user
                  ? "View and manage your previously generated video summaries"
                  : "Sign in to save and manage your personal summaries"}
              </p>
            </div>
            {!authLoading && (
              <div className="flex items-center gap-2">
                {user ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    <User className="w-3 h-3 mr-1" />
                    {user.email}
                  </Badge>
                ) : (
                  <Link href="/auth/login">
                    <Button variant="outline">
                      <LogIn className="w-4 h-4 mr-1" />
                      Sign In
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>
          {debugInfo && <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600">Debug: {debugInfo}</div>}
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your summaries...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">{error}</p>
            <div className="space-y-2">
              <Button onClick={fetchSummaries} variant="outline">
                Try Again
              </Button>
              {error.includes("No summaries found") && (
                <div className="text-sm text-gray-600 space-y-2">
                  <p>Start by generating a summary on the home page.</p>
                  {!user && (
                    <p>
                      <Link href="/auth/login" className="text-emerald-600 hover:underline">
                        Sign in
                      </Link>{" "}
                      to save summaries to your personal account.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && !error && summaries.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No summaries found. Generate your first summary!</p>
            <Link href="/">
              <Button>Create Summary</Button>
            </Link>
          </div>
        )}

        {!loading && !error && summaries.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {summaries.map((summary) => (
              <Card key={summary.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-2">{summary.video_title}</CardTitle>
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 shrink-0">
                      <Database className="w-3 h-3 mr-1" />
                      Saved
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-3">{summary.overview}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDuration(summary.video_duration)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(summary.created_at)}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{summary.highlights?.length || 0} Highlights</Badge>
                      <Badge variant="outline">{summary.chapters?.length || 0} Chapters</Badge>
                      <Badge variant="outline">{summary.faq?.length || 0} FAQ</Badge>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button onClick={() => setSelectedSummary(summary)} className="flex-1">
                        View Summary
                      </Button>
                      <Button onClick={() => window.open(summary.video_url, "_blank")} variant="outline" size="sm">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
