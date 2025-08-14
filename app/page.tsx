"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Play, Sparkles, ArrowRight, Database, History, LogIn, LogOut, User } from "lucide-react"
import { SummaryDisplay } from "@/components/summary-display"
import Link from "next/link"
import { supabase } from "@/lib/supabase/client"
import { signOut } from "@/lib/actions"

// Mock data for demonstration
const mockSummaryData = {
  meta: {
    video_id: "dQw4w9WgXcQ",
    title: "The Future of Artificial Intelligence: Opportunities and Challenges",
    channel: "TechTalks",
    duration_sec: 1847,
    language: "en",
    url: "https://youtube.com/watch?v=example",
    created_at: "2024-01-15T10:30:00Z",
  },
  highlights: [
    "AI will transform every industry within the next decade",
    "Ethical considerations are crucial for responsible AI development",
    "Human-AI collaboration will be more important than AI replacement",
    "Data privacy and security remain top concerns for AI adoption",
  ],
  key_takeaways: [
    "Invest in AI education and training for your workforce",
    "Develop clear AI ethics guidelines for your organization",
    "Start with small AI pilot projects before scaling",
    "Focus on augmenting human capabilities rather than replacing them",
    "Ensure robust data governance and privacy protection",
  ],
  chapters: [
    {
      start: 0,
      end: 300,
      title: "Introduction to AI's Current State",
      summary: [
        "Overview of current AI capabilities and limitations",
        "Discussion of recent breakthroughs in machine learning",
        "Setting the stage for future developments",
      ],
      quotes: [{ text: "AI is not magic, it's mathematics at scale", t: 45 }],
      faq: [
        {
          q: "What makes current AI different from previous attempts?",
          a: "The combination of big data, computational power, and advanced algorithms",
          t: 120,
        },
      ],
      entities: ["Machine Learning", "Neural Networks", "Big Data"],
    },
    {
      start: 300,
      end: 900,
      title: "Industry Applications and Use Cases",
      summary: [
        "Healthcare AI for diagnosis and treatment",
        "Financial services automation and fraud detection",
        "Manufacturing optimization and predictive maintenance",
        "Transportation and autonomous vehicles",
      ],
      quotes: [{ text: "Every industry will be an AI industry", t: 450 }],
      faq: [],
      entities: ["Healthcare AI", "Fintech", "Industry 4.0", "Autonomous Vehicles"],
    },
    {
      start: 900,
      end: 1500,
      title: "Ethical Considerations and Challenges",
      summary: [
        "Bias in AI systems and fairness concerns",
        "Privacy and data protection issues",
        "Job displacement and economic impact",
        "Need for transparent and explainable AI",
      ],
      quotes: [{ text: "With great power comes great responsibility", t: 1200 }],
      faq: [
        {
          q: "How can we ensure AI systems are fair?",
          a: "Through diverse training data, regular auditing, and inclusive development teams",
          t: 1350,
        },
      ],
      entities: ["AI Ethics", "Algorithmic Bias", "Explainable AI"],
    },
  ],
  faq: [
    {
      q: "When will AI achieve human-level intelligence?",
      a: "Experts disagree, with estimates ranging from 10 to 50+ years",
      t: 1600,
    },
    {
      q: "Should we be afraid of AI?",
      a: "We should be cautious and proactive about managing risks while embracing benefits",
      t: 1700,
    },
  ],
  glossary: [
    {
      term: "Machine Learning",
      definition: "A subset of AI that enables systems to learn and improve from data without explicit programming",
    },
    {
      term: "Neural Networks",
      definition: "Computing systems inspired by biological neural networks that process information",
    },
    {
      term: "Algorithmic Bias",
      definition: "Systematic errors in AI systems that create unfair outcomes for certain groups",
    },
  ],
}

const SignedInDashboard = ({ user, onSubmit, url, setUrl, isLoading, handleTestVideo }) => {
  const [recentSummaries, setRecentSummaries] = useState([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  useEffect(() => {
    const fetchRecentSummaries = async () => {
      try {
        const { data, error } = await supabase
          .from("summaries")
          .select("id, video_title, video_url, created_at, video_duration")
          .order("created_at", { ascending: false })
          .limit(3)

        if (!error && data) {
          setRecentSummaries(data)
        }
      } catch (error) {
        console.error("Error fetching recent summaries:", error)
      } finally {
        setLoadingRecent(false)
      }
    }

    fetchRecentSummaries()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">ClipNotesAI</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-medium text-slate-900">
                    {user.user_metadata?.full_name || user.user_metadata?.display_name || user.email.split("@")[0]}
                  </div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                </div>
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-emerald-600" />
                </div>
                <form action={signOut}>
                  <Button type="submit" variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
                    <LogOut className="w-4 h-4" />
                  </Button>
                </form>
              </div>
              <Link href="/summaries">
                <Button variant="ghost" size="sm" className="text-slate-600 hover:bg-slate-100">
                  <History className="w-4 h-4 mr-1" />
                  History
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="ghost" size="sm" className="text-slate-600 hover:bg-slate-100">
                  Pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">
            Welcome back,{" "}
            {user.user_metadata?.full_name || user.user_metadata?.display_name || user.email.split("@")[0]}!
          </h2>
          <p className="text-slate-600">Ready to summarize your next video?</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Action Card */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg border-0 bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  Create New Summary
                </CardTitle>
                <CardDescription>Paste any YouTube video URL to generate comprehensive AI notes</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="relative">
                    <Input
                      type="url"
                      placeholder="Paste YouTube Video Link Here"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="h-12 text-base border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                      disabled={isLoading}
                    />
                    <Play className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      disabled={!url.trim() || isLoading}
                      className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Processing...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          Generate Summary
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestVideo}
                      disabled={isLoading}
                      className="px-6 bg-transparent"
                    >
                      Try Demo
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid md:grid-cols-3 gap-4 mt-6">
              <Card className="bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-700">Free</div>
                  <div className="text-sm text-emerald-600">Current Plan</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-700">5</div>
                  <div className="text-sm text-blue-600">Videos/Month</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-purple-700">∞</div>
                  <div className="text-sm text-purple-600">Export Formats</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Summaries */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Recent Summaries
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingRecent ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-slate-200 rounded mb-2"></div>
                        <div className="h-3 bg-slate-100 rounded w-2/3"></div>
                      </div>
                    ))}
                  </div>
                ) : recentSummaries.length > 0 ? (
                  <div className="space-y-3">
                    {recentSummaries.map((summary) => (
                      <div key={summary.id} className="border-b border-slate-100 pb-3 last:border-b-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{summary.video_title}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(summary.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="text-slate-400 mb-2">No summaries yet</div>
                    <div className="text-xs text-slate-500">Create your first summary above</div>
                  </div>
                )}
                <div className="mt-4">
                  <Link href="/summaries">
                    <Button variant="outline" size="sm" className="w-full bg-transparent">
                      View All
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Upgrade Card */}
            <Card className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white border-0">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Upgrade to Pro</h3>
                <p className="text-emerald-100 text-sm mb-4">
                  Unlimited summaries, priority support, and advanced features
                </p>
                <Link href="/pricing">
                  <Button size="sm" className="bg-white text-emerald-600 hover:bg-slate-50 w-full">
                    View Plans
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function HomePage() {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [summaryData, setSummaryData] = useState(null)
  const [transcript, setTranscript] = useState(null) // Added transcript state
  const [showDemo, setShowDemo] = useState(false)
  const [audioStatus, setAudioStatus] = useState(null)
  const [fromStorage, setFromStorage] = useState(false)
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(false) // Set to false since we're using mock client

  const supabaseClient = supabase

  const getUserDisplayName = (user) => {
    if (!user) return null

    const displayName = user.user_metadata?.full_name || user.user_metadata?.display_name
    if (displayName) return displayName

    if (user.email) {
      return user.email.split("@")[0]
    }

    return "User"
  }

  useEffect(() => {
    // Mock authentication - always returns no user
    setUser(null)
    setAuthLoading(false)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setIsLoading(true)
    setAudioStatus(null)
    setTranscript(null) // Reset transcript
    setFromStorage(false)

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: url.trim() }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to process video")
      }

      const result = await response.json()
      setSummaryData(result.summary)
      setTranscript(result.transcript) // Set transcript from API response
      setAudioStatus(result.audioExtractionStatus)
      setFromStorage(result.from_storage || false)

      if (result.audioExtractionStatus) {
        const status = result.audioExtractionStatus
        const storageInfo = result.from_storage ? "\n💾 Loaded from saved data" : "\n🆕 Newly generated summary"

        if (status.successful) {
          alert(
            `✅ Audio Extraction SUCCESS!\nMethod: ${status.method}\nTranscript Length: ${status.transcriptLength} characters\nThis summary is based on actual video audio!${storageInfo}`,
          )
        } else {
          alert(
            `❌ Audio Extraction FAILED\nError: ${status.error || "Unknown error"}\nMethod: ${status.method || "None"}\nThis summary is based on video description only.${storageInfo}`,
          )
        }
      } else if (result.from_storage) {
        alert("💾 Summary loaded from saved data - no processing required!")
      }
    } catch (error) {
      console.error("Error processing video:", error)
      alert("Failed to process video. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestVideo = async () => {
    const testUrl = "https://youtu.be/HwmzhX19c3I"
    setUrl(testUrl)
    setAudioStatus(null)
    setTranscript(null) // Reset transcript
    setFromStorage(false)

    setIsLoading(true)
    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: testUrl }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to process video")
      }

      const result = await response.json()
      setSummaryData(result.summary)
      setTranscript(result.transcript) // Set transcript from API response
      setAudioStatus(result.audioExtractionStatus)
      setFromStorage(result.from_storage || false)

      if (result.audioExtractionStatus) {
        const status = result.audioExtractionStatus
        const storageInfo = result.from_storage ? "\n💾 Loaded from database" : "\n🆕 Newly processed"

        const message = status.successful
          ? `🎉 TEST SUCCESS!\n\n✅ Audio extracted via ${status.method}\n✅ Transcript generated: ${status.transcriptLength} characters\n✅ Summary based on actual video content!${storageInfo}`
          : `⚠️ TEST RESULT:\n\n❌ Audio extraction failed: ${status.error}\n📄 Using fallback method: ${status.method}\n⚠️ Summary may be less accurate${storageInfo}`

        alert(message)
      } else if (result.from_storage) {
        alert("💾 TEST: Summary loaded from database - instant results!")
      }
    } catch (error) {
      console.error("Error processing video:", error)
      alert(`Failed to process video: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestAudioExtraction = async () => {
    const testUrl = "https://youtu.be/HwmzhX19c3I"
    setUrl(testUrl)

    console.log("Testing audio extraction specifically...")
    try {
      const response = await fetch("/api/test-audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: testUrl }),
      })

      const result = await response.json()
      console.log("Audio extraction test result:", result)

      if (result.apiYTResult?.success) {
        alert(
          `Audio extraction test successful! Found ${result.apiYTResult.foundLinks?.length || 0} potential download links. Check console for details.`,
        )
      } else {
        alert(
          `Audio extraction test failed: ${result.apiYTResult?.error || "Unknown error"}. Check console for details.`,
        )
      }
    } catch (error) {
      console.error("Audio extraction test error:", error)
      alert(`Test failed: ${error.message}`)
    }
  }

  const handleTimestampClick = (timestamp: number) => {
    // Implement video player integration
    console.log(`Jump to timestamp: ${timestamp}s`)
  }

  if (summaryData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
        {/* Header */}
        <header className="border-b bg-white/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-slate-900">ClipNotesAI</h1>
                {audioStatus && (
                  <Badge
                    variant={audioStatus.successful ? "default" : "secondary"}
                    className={
                      audioStatus.successful
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                    }
                  >
                    {audioStatus.successful ? "🎵 Audio Extracted" : "📄 Description Only"}
                  </Badge>
                )}
                {fromStorage && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">
                    <Database className="w-3 h-3 mr-1" />
                    Saved Data
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                {!authLoading && (
                  <>
                    {user ? (
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-medium text-slate-900">{getUserDisplayName(user)}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                        </div>
                        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-emerald-600" />
                        </div>
                        <form action={signOut}>
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="text-slate-600 hover:text-slate-900"
                          >
                            <LogOut className="w-4 h-4" />
                          </Button>
                        </form>
                      </div>
                    ) : (
                      <Link href="/auth/login">
                        <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
                          <LogIn className="w-4 h-4 mr-1" />
                          Sign In
                        </Button>
                      </Link>
                    )}
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setSummaryData(null)
                    setTranscript(null) // Reset transcript
                    setAudioStatus(null)
                    setFromStorage(false)
                  }}
                  className="text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                >
                  New Summary
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <SummaryDisplay
            data={summaryData}
            transcript={transcript} // Pass transcript to component
            audioStatus={audioStatus} // Pass audioStatus to component
            onTimestampClick={handleTimestampClick}
          />
        </main>
      </div>
    )
  }

  if (user && !authLoading) {
    return (
      <SignedInDashboard
        user={user}
        onSubmit={handleSubmit}
        url={url}
        setUrl={setUrl}
        isLoading={isLoading}
        handleTestVideo={handleTestVideo}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">ClipNotesAI</h1>
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
                Beta
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              {!authLoading && (
                <>
                  {user ? (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-medium text-slate-900">{getUserDisplayName(user)}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </div>
                      <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-emerald-600" />
                      </div>
                      <form action={signOut}>
                        <Button type="submit" variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
                          <LogOut className="w-4 h-4" />
                        </Button>
                      </form>
                    </div>
                  ) : (
                    <Link href="/auth/login">
                      <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
                        <LogIn className="w-4 h-4 mr-1" />
                        Sign In
                      </Button>
                    </Link>
                  )}
                </>
              )}
              <Link href="/summaries">
                <Button variant="ghost" size="sm" className="text-slate-600 hover:bg-slate-100">
                  <History className="w-4 h-4 mr-1" />
                  History
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="ghost" size="sm" className="text-slate-600 hover:bg-slate-100">
                  Pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section - SEO Optimized */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-5xl font-bold text-slate-900 mb-6">
            AI-Powered <span className="text-emerald-600">YouTube Video Summaries</span>
          </h2>
          <p className="text-xl text-slate-600 mb-4 max-w-3xl mx-auto">
            Turn Any Video Into Actionable Notes in Minutes
          </p>
          <p className="text-lg text-slate-500 mb-8 max-w-2xl mx-auto">
            ClipNotesAI turns long videos into clear, actionable notes you can read in minutes. Watch Less, Learn More
            with AI summaries for every video.
          </p>

          {/* Input Form */}
          <Card className="max-w-2xl mx-auto shadow-lg border-0 bg-white/90 backdrop-blur-sm mb-8">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl text-slate-900">Start Free</CardTitle>
              <CardDescription>Paste any YouTube video URL to generate comprehensive AI notes</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Input
                    type="url"
                    placeholder="Paste YouTube Video Link Here"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="h-12 text-base border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                    disabled={isLoading}
                  />
                  <Play className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  disabled={!url.trim() || isLoading}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-all duration-200 hover:scale-[1.02]"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing Video Content...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      Get Your First Summary Free
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <section className="max-w-4xl mx-auto mb-16">
          <h3 className="text-3xl font-bold text-center text-slate-900 mb-12">How It Works</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-emerald-600">1</span>
              </div>
              <h4 className="text-xl font-semibold text-slate-900 mb-2">Paste Link</h4>
              <p className="text-slate-600">Simply paste any YouTube video URL into our AI-powered summarizer</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-emerald-600">2</span>
              </div>
              <h4 className="text-xl font-semibold text-slate-900 mb-2">AI Summarizes</h4>
              <p className="text-slate-600">
                Our AI extracts audio, transcribes content, and creates structured summaries
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-emerald-600">3</span>
              </div>
              <h4 className="text-xl font-semibold text-slate-900 mb-2">Export Notes</h4>
              <p className="text-slate-600">
                Download your notes in multiple formats: PDF, Markdown, Notion, or Google Docs
              </p>
            </div>
          </div>
        </section>

        <section className="max-w-4xl mx-auto mb-16">
          <Card className="bg-slate-50 border-0">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Why You Need AI Summaries for YouTube</h3>
              <div className="prose prose-slate max-w-none">
                <p className="text-slate-700 mb-4">
                  In today's information-rich world, YouTube has become the go-to platform for learning, with millions
                  of hours of educational content uploaded daily. However, watching lengthy videos can be time-consuming
                  and inefficient. This is where AI-powered YouTube video summaries become invaluable for students,
                  professionals, and lifelong learners.
                </p>
                <p className="text-slate-700 mb-4">
                  AI video notes technology transforms how we consume video content by extracting key information,
                  creating structured summaries, and providing timestamped highlights. Whether you're a student
                  reviewing lecture summaries, a professional staying updated with industry trends, or a content creator
                  researching topics, AI summaries help you process information 10x faster than traditional note-taking
                  methods.
                </p>
                <p className="text-slate-700 mb-4">
                  Our AI productivity tool goes beyond simple transcription by analyzing context, identifying key
                  concepts, and organizing information into actionable insights. This makes it perfect for online course
                  notes, podcast summaries, and meeting notes. The ability to export summaries in multiple formats
                  ensures seamless integration with your existing workflow, whether you use Notion, Google Docs, or
                  traditional note-taking apps.
                </p>
                <p className="text-slate-700">
                  By leveraging AI for video summarization, you can focus on understanding and applying knowledge rather
                  than spending hours watching and manually taking notes. This revolutionary approach to learning and
                  information processing is becoming essential for anyone looking to stay competitive in our fast-paced
                  digital world.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="max-w-2xl mx-auto text-center">
          <Card className="bg-emerald-600 border-0 text-white">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold mb-4">Ready to Transform Your Video Learning?</h3>
              <p className="text-emerald-100 mb-6">
                Join thousands of students, professionals, and creators who are already saving hours with AI-powered
                video summaries.
              </p>
              <Button
                size="lg"
                className="bg-white text-emerald-600 hover:bg-slate-50 font-semibold"
                onClick={() => document.querySelector('input[type="url"]')?.focus()}
              >
                Get Your First Summary Free
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
