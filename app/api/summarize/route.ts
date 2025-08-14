import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { groq } from "@ai-sdk/groq"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"

// Schema for the AI-generated summary
const summarySchema = z.object({
  highlights: z.array(z.string()).describe("4-6 key highlights from the video"),
  key_takeaways: z.array(z.string()).describe("5-7 actionable takeaways"),
  overview: z.string().describe("2-3 sentence overview of the video content"),
  chapters: z
    .array(
      z.object({
        start: z.number().describe("Start time in seconds"),
        end: z.number().describe("End time in seconds"),
        title: z.string().describe("Chapter title"),
        summary: z.array(z.string()).describe("3-4 bullet points summarizing this chapter"),
        quotes: z
          .array(
            z.object({
              text: z.string(),
              t: z.number().describe("Timestamp in seconds"),
            }),
          )
          .describe("Notable quotes from this chapter"),
        entities: z.array(z.string()).describe("Key terms, people, or concepts mentioned"),
      }),
    )
    .describe("Video chapters with timestamps"),
  faq: z
    .array(
      z.object({
        q: z.string().describe("Frequently asked question"),
        a: z.string().describe("Answer to the question"),
        t: z.number().describe("Timestamp where this is discussed"),
      }),
    )
    .describe("FAQ based on video content"),
  glossary: z
    .array(
      z.object({
        term: z.string(),
        definition: z.string(),
      }),
    )
    .describe("Key terms and definitions from the video"),
})

// Extract video ID from YouTube URL
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

async function getVideoTranscript(
  videoId: string,
): Promise<{ transcript: string; title: string; duration: number; channel: string; audioStatus: any }> {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY

    let videoData = null
    if (apiKey) {
      try {
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,contentDetails,statistics`,
        )
        const data = await response.json()
        if (data.items && data.items.length > 0) {
          videoData = data.items[0]
        }
      } catch (error) {
        console.error("YouTube API error:", error)
      }
    }

    const title = videoData?.snippet?.title || "YouTube Video"
    const channel = videoData?.snippet?.channelTitle || "Unknown Channel"
    const description = videoData?.snippet?.description || ""
    const durationISO = videoData?.contentDetails?.duration || "PT0S"
    const duration = parseDuration(durationISO)

    console.log(
      `Processing: "${title}" by ${channel} (${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")})`,
    )

    console.log("Attempting audio extraction...")
    const audioUrl = await extractYouTubeAudio(videoId)

    let transcript = ""
    const audioStatus = {
      successful: false,
      method: "Generic fallback",
      error: "No audio URL returned from extraction services",
      transcriptLength: 0,
      audioUrl: null,
      detailedErrors: [],
      processingSteps: [],
    }

    if (audioUrl) {
      console.log("Audio extraction successful, transcribing with Whisper...")
      audioStatus.audioUrl = audioUrl
      audioStatus.successful = true
      audioStatus.method = "Zyla API + Groq Whisper"
      audioStatus.error = null
      audioStatus.processingSteps.push("Audio extraction successful")

      try {
        const whisperTranscript = await transcribeWithWhisper(audioUrl)
        audioStatus.processingSteps.push(`Whisper returned ${whisperTranscript.length} characters`)

        if (whisperTranscript && whisperTranscript.length > 50) {
          transcript = whisperTranscript
          audioStatus.transcriptLength = transcript.length
          console.log(`Whisper transcription successful: ${transcript.length} characters`)
          audioStatus.processingSteps.push("Whisper transcription successful")
        } else {
          console.log("Whisper transcription failed or returned very short result")
          audioStatus.successful = false
          audioStatus.method = "Whisper transcription failed"
          audioStatus.error = `Whisper returned only ${whisperTranscript.length} characters`
          audioStatus.detailedErrors.push(`Whisper transcription too short: ${whisperTranscript.length} chars`)
        }
      } catch (whisperError) {
        console.error("Whisper transcription error:", whisperError)
        audioStatus.successful = false
        audioStatus.method = "Whisper transcription error"
        audioStatus.error = whisperError instanceof Error ? whisperError.message : "Unknown Whisper error"
        audioStatus.detailedErrors.push(`Whisper error: ${audioStatus.error}`)
      }
    } else {
      audioStatus.detailedErrors.push("No audio URL returned from any extraction service")
    }

    if (!transcript || transcript.length < 50) {
      console.log("Using video metadata as fallback...")
      const contentParts = []

      if (title) contentParts.push(`Video Title: ${title}`)
      if (channel) contentParts.push(`Channel: ${channel}`)
      if (description && description.length > 50) {
        const cleanDescription = description
          .replace(/https?:\/\/[^\s]+/g, "[URL]")
          .replace(/\n{3,}/g, "\n\n")
          .substring(0, 2000)
        contentParts.push(`Description: ${cleanDescription}`)
      }

      if (transcript && transcript.length > 0) {
        contentParts.unshift(`Partial Transcript: ${transcript}`)
        audioStatus.method = "Partial transcript + metadata"
      }

      transcript = contentParts.join("\n\n")

      if (!audioStatus.successful) {
        audioStatus.method = "Video metadata only"
        audioStatus.transcriptLength = transcript.length
      }
    }

    return {
      transcript: transcript.substring(0, 8000),
      title,
      duration,
      channel,
      audioStatus,
    }
  } catch (error) {
    console.error("Error getting video data:", error)
    return {
      transcript: `Unable to extract content for video ID: ${videoId}`,
      title: "YouTube Video",
      duration: 600,
      channel: "Unknown Channel",
      audioStatus: {
        successful: false,
        method: "Error",
        error: error instanceof Error ? error.message : "Unknown error",
        transcriptLength: 0,
        audioUrl: null,
        detailedErrors: [error instanceof Error ? error.message : "Unknown error"],
        processingSteps: ["Failed at video data extraction"],
      },
    }
  }
}

async function extractTopicsFromTitle(title: string): string {
  const titleLower = title.toLowerCase()

  if (/tutorial|how to|guide|learn|course|lesson|explain/i.test(title)) {
    return "educational content, tutorials, and step-by-step guidance"
  }
  if (/code|programming|software|tech|ai|data|web|app/i.test(title)) {
    return "technology, programming, and software development"
  }
  if (/business|marketing|startup|entrepreneur|money|finance/i.test(title)) {
    return "business strategies, marketing, and entrepreneurship"
  }
  if (/lifestyle|health|fitness|cooking|travel|diy/i.test(title)) {
    return "lifestyle topics, personal development, and practical advice"
  }
  if (/review|unbox|test|comparison/i.test(title)) {
    return "product reviews, comparisons, and evaluations"
  }
  if (/news|update|announcement/i.test(title)) {
    return "current events, updates, and announcements"
  }

  return "the main topic and related subjects"
}

async function extractYouTubeAudio(videoId: string): Promise<string | null> {
  console.log(`Attempting audio extraction for video: ${videoId}`)

  const zylaApiKey = process.env.ZYLA_API_KEY
  if (zylaApiKey) {
    try {
      console.log("Trying Zyla YouTube to Audio API (documented format)...")
      console.log(`Using API key: ${zylaApiKey.substring(0, 10)}...`)

      const zylaUrl = `https://zylalabs.com/api/381/youtube+to+audio+api/8884/get+audio?id=${videoId}`
      console.log(`Zyla API URL: ${zylaUrl}`)

      const zylaResponse = await fetch(zylaUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${zylaApiKey}`,
        },
      })

      console.log(`Zyla API response status: ${zylaResponse.status}`)
      console.log(`Zyla API response headers:`, Object.fromEntries(zylaResponse.headers.entries()))

      const responseText = await zylaResponse.text()
      console.log(`Zyla API raw response: ${responseText}`)

      if (zylaResponse.ok) {
        try {
          const zylaData = JSON.parse(responseText)
          console.log("Zyla YouTube to Audio parsed response:", zylaData)

          const possibleAudioFields = ["link", "download_url", "url", "audio_url", "file_url", "mp3_url"]
          let audioUrl = null

          for (const field of possibleAudioFields) {
            if (zylaData[field]) {
              audioUrl = zylaData[field]
              console.log(`Found audio URL in field '${field}': ${audioUrl}`)
              break
            }
          }

          // Check status and progress
          if (zylaData.status) {
            console.log(`Zyla status: ${zylaData.status}`)
          }
          if (zylaData.progress !== undefined) {
            console.log(`Zyla progress: ${zylaData.progress}%`)
          }
          if (zylaData.message || zylaData.msg) {
            console.log(`Zyla message: ${zylaData.message || zylaData.msg}`)
          }

          if (audioUrl) {
            console.log(`Zyla YouTube to Audio API success: ${audioUrl}`)
            return audioUrl
          } else {
            console.log(`No audio URL found in Zyla response. Available fields:`, Object.keys(zylaData))
          }

          if (zylaData.status === "processing" || (zylaData.progress && zylaData.progress < 100)) {
            console.log(`Zyla is still processing. Status: ${zylaData.status}, Progress: ${zylaData.progress}%`)
          } else if (zylaData.status === "error" || zylaData.error) {
            console.log(`Zyla returned error: ${zylaData.error || zylaData.message || "Unknown error"}`)
          }
        } catch (parseError) {
          console.log(`Failed to parse Zyla JSON response:`, parseError)
          console.log(`Raw response was: ${responseText}`)
        }
      } else {
        console.log(`Zyla YouTube to Audio API failed: ${zylaResponse.status}`)
        console.log(`Error response: ${responseText}`)

        try {
          console.log("Trying Zyla Audio Extraction API as fallback...")
          const altUrl = `https://zylalabs.com/api/8354/youtube+audio+extraction+api/14520/get+audio?id=${videoId}`
          console.log(`Fallback Zyla URL: ${altUrl}`)

          const altResponse = await fetch(altUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${zylaApiKey}`,
            },
          })

          if (altResponse.ok) {
            const altData = await altResponse.json()
            console.log("Fallback Zyla Audio Extraction response:", altData)

            if (altData.link || altData.download_url || altData.url) {
              const altAudioUrl = altData.link || altData.download_url || altData.url
              console.log(`Fallback Zyla Audio Extraction success: ${altAudioUrl}`)
              return altAudioUrl
            }
          }
        } catch (altError) {
          console.log("Fallback Zyla Audio Extraction also failed:", altError)
        }
      }
    } catch (zylaError) {
      console.log(`Zyla YouTube to Audio API error:`, zylaError)
    }
  } else {
    console.log("Zyla API key not available, skipping...")
  }

  try {
    console.log("Trying YouTube transcript extraction as fallback...")
    const transcript = await extractYouTubeTranscript(videoId)
    if (transcript && transcript.length > 100) {
      console.log(`YouTube transcript found: ${transcript.length} characters`)
      // Return a special marker to indicate we have transcript, not audio
      return `TRANSCRIPT:${transcript}`
    }
  } catch (transcriptError) {
    console.log("YouTube transcript extraction failed:", transcriptError)
  }

  try {
    console.log("Trying simplified ApiYT approach as secondary fallback...")

    // Try direct conversion endpoint
    const convertUrl = `https://apiyt.com/api/json/mp3/${videoId}`
    const response = await fetch(convertUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; VideoSummarizer/1.0)",
      },
    })

    if (response.ok) {
      const data = await response.json()
      console.log("ApiYT JSON response:", data)

      if (data.url || data.download_url || data.audio_url) {
        const audioUrl = data.url || data.download_url || data.audio_url
        console.log(`ApiYT returned audio URL: ${audioUrl}`)
        return audioUrl
      }
    }
  } catch (apiYtError) {
    console.log("Simplified ApiYT failed:", apiYtError)
  }

  console.log("All audio extraction methods failed")
  return null
}

async function extractYouTubeTranscript(videoId: string): Promise<string | null> {
  try {
    // Try to get transcript from YouTube's transcript API
    const transcriptUrl = `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`

    const response = await fetch(transcriptUrl)
    if (response.ok) {
      const xmlText = await response.text()

      // Parse XML transcript
      const textMatches = xmlText.match(/<text[^>]*>([^<]*)<\/text>/g)
      if (textMatches) {
        const transcript = textMatches
          .map((match) => {
            const textContent = match.replace(/<[^>]*>/g, "")
            return textContent.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          })
          .join(" ")
          .trim()

        return transcript
      }
    }

    // Try alternative transcript endpoints
    const altEndpoints = [
      `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}&fmt=srv3`,
      `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}&fmt=ttml`,
    ]

    for (const endpoint of altEndpoints) {
      try {
        const altResponse = await fetch(endpoint)
        if (altResponse.ok) {
          const altText = await altResponse.text()
          if (altText && altText.length > 100) {
            // Extract text content from different formats
            const cleanText = altText
              .replace(/<[^>]*>/g, " ")
              .replace(/&[^;]+;/g, " ")
              .replace(/\s+/g, " ")
              .trim()

            if (cleanText.length > 100) {
              return cleanText
            }
          }
        }
      } catch (altError) {
        console.log(`Alternative transcript endpoint failed: ${endpoint}`)
      }
    }

    return null
  } catch (error) {
    console.log("YouTube transcript extraction error:", error)
    return null
  }
}

async function transcribeWithWhisper(audioUrl: string): Promise<string> {
  try {
    if (audioUrl.startsWith("TRANSCRIPT:")) {
      // This is already a transcript, not an audio URL
      const transcript = audioUrl.substring(11) // Remove 'TRANSCRIPT:' prefix
      console.log(`Using extracted transcript: ${transcript.length} characters`)
      return transcript
    }

    console.log(`Starting Whisper transcription for: ${audioUrl}`)

    const audioResponse = await fetch(audioUrl, {
      method: "GET",
      redirect: "follow", // Explicitly follow redirects
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VideoSummarizer/1.0)",
        Accept: "audio/mpeg, audio/mp3, audio/*, */*",
      },
    })

    console.log(`Audio download response status: ${audioResponse.status}`)
    console.log(`Audio download response headers:`, Object.fromEntries(audioResponse.headers.entries()))

    if (!audioResponse.ok) {
      // If we get a redirect status, try to follow it manually
      if (audioResponse.status === 302 || audioResponse.status === 301) {
        const redirectUrl = audioResponse.headers.get("location")
        if (redirectUrl) {
          console.log(`Following redirect to: ${redirectUrl}`)
          const redirectResponse = await fetch(redirectUrl, {
            method: "GET",
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; VideoSummarizer/1.0)",
              Accept: "audio/mpeg, audio/mp3, audio/*, */*",
            },
          })

          if (!redirectResponse.ok) {
            throw new Error(`Failed to download audio after redirect: ${redirectResponse.status}`)
          }

          const audioBuffer = await redirectResponse.arrayBuffer()
          console.log(`Audio downloaded after redirect: ${audioBuffer.byteLength} bytes`)

          // Validate audio file
          if (audioBuffer.byteLength < 1000) {
            throw new Error(`Audio file too small: ${audioBuffer.byteLength} bytes`)
          }

          return await processAudioWithWhisper(audioBuffer)
        }
      }

      throw new Error(`Failed to download audio: ${audioResponse.status}`)
    }

    const audioBuffer = await audioResponse.arrayBuffer()
    console.log(`Audio downloaded: ${audioBuffer.byteLength} bytes`)

    // Validate audio file
    if (audioBuffer.byteLength < 1000) {
      throw new Error(`Audio file too small: ${audioBuffer.byteLength} bytes`)
    }

    return await processAudioWithWhisper(audioBuffer)
  } catch (error) {
    console.error("Whisper transcription error:", error)
    return ""
  }
}

async function processAudioWithWhisper(audioBuffer: ArrayBuffer): Promise<string> {
  try {
    // Create FormData for Groq Whisper API
    const formData = new FormData()
    const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" })
    formData.append("file", audioBlob, "audio.mp3")
    formData.append("model", "whisper-large-v3-turbo")
    formData.append("response_format", "verbose_json")
    formData.append("timestamp_granularities[]", "word")

    console.log("Sending audio to Groq Whisper API...")

    // Call Groq Whisper API
    const whisperResponse = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: formData,
    })

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text()
      throw new Error(`Whisper API error: ${whisperResponse.status} - ${errorText}`)
    }

    const whisperData = await whisperResponse.json()
    const transcript = whisperData.text || ""

    console.log(`Whisper transcription completed: ${transcript.length} characters`)

    if (transcript.length < 50) {
      throw new Error(`Whisper returned very short transcript: ${transcript.length} characters`)
    }

    return transcript
  } catch (error) {
    console.error("Whisper processing error:", error)
    throw error
  }
}

function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0

  const hours = Number.parseInt(match[1] || "0", 10)
  const minutes = Number.parseInt(match[2] || "0", 10)
  const seconds = Number.parseInt(match[3] || "0", 10)

  return hours * 3600 + minutes * 60 + seconds
}

async function validateVideoLength(
  duration: number,
  userId: string | null,
  supabase: any,
): Promise<{ valid: boolean; error?: string; plan?: string }> {
  // Default limits
  const FREE_LIMIT = 15 * 60 // 15 minutes in seconds
  const PRO_LIMIT = 2 * 60 * 60 // 2 hours in seconds

  let userPlan = "free" // Default to free plan

  // Check user's plan if authenticated
  if (userId && supabase) {
    try {
      // You can extend this to check a user_subscriptions table or similar
      // For now, we'll assume all authenticated users are on free plan
      // unless they have a specific subscription record
      const { data: subscription } = await supabase
        .from("user_subscriptions")
        .select("plan")
        .eq("user_id", userId)
        .eq("status", "active")
        .single()

      if (subscription?.plan === "pro") {
        userPlan = "pro"
      }
    } catch (error) {
      console.log("No subscription found, defaulting to free plan")
    }
  }

  const limit = userPlan === "pro" ? PRO_LIMIT : FREE_LIMIT
  const limitMinutes = Math.floor(limit / 60)
  const durationMinutes = Math.floor(duration / 60)

  if (duration > limit) {
    const planName = userPlan === "pro" ? "Pro" : "Free"
    return {
      valid: false,
      error: `Video length (${durationMinutes} minutes) exceeds ${planName} plan limit of ${limitMinutes} minutes. ${userPlan === "free" ? "Upgrade to Pro for videos up to 2 hours." : ""}`,
      plan: userPlan,
    }
  }

  return { valid: true, plan: userPlan }
}

async function handlePOST(request: NextRequest) {
  try {
    const { url } = await request.json()
    console.log(`Processing YouTube URL: ${url}`)

    if (!url) {
      return NextResponse.json({ error: "Video URL is required" }, { status: 400 })
    }

    const videoId = extractVideoId(url)
    if (!videoId) {
      console.error(`Invalid YouTube URL: ${url}`)
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 })
    }

    console.log(`Extracted video ID: ${videoId}`)

    const supabase = createServerClient()
    let userId: string | null = null

    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) userId = user.id
    }

    console.log("Checking for existing summary...")
    let existingSummary = null
    let fetchError = null

    if (userId) {
      // First check for user-specific summary
      const { data, error } = await supabase
        .from("summaries")
        .select("*")
        .eq("video_id", videoId)
        .eq("user_id", userId)
        .single()

      if (data && !error) {
        existingSummary = data
        fetchError = error
      } else {
        // If no user-specific summary, check for public summary
        const { data: publicData, error: publicError } = await supabase
          .from("summaries")
          .select("*")
          .eq("video_id", videoId)
          .is("user_id", null)
          .single()

        existingSummary = publicData
        fetchError = publicError
      }
    } else {
      // For unauthenticated users, only check public summaries
      const { data, error } = await supabase
        .from("summaries")
        .select("*")
        .eq("video_id", videoId)
        .is("user_id", null)
        .single()

      existingSummary = data
      fetchError = error
    }

    if (existingSummary && !fetchError) {
      console.log("Found existing summary in database")

      // Return stored summary with proper format
      const storedSummary = {
        highlights: existingSummary.highlights || [],
        key_takeaways: existingSummary.key_takeaways || [],
        overview: existingSummary.overview || "",
        chapters: existingSummary.chapters || [],
        faq: existingSummary.faq || [],
        glossary: existingSummary.glossary || [],
        meta: {
          video_id: videoId,
          title: existingSummary.video_title,
          channel: existingSummary.summary_data?.channel || "Unknown",
          duration_sec: existingSummary.video_duration || 0,
          url: existingSummary.video_url,
          created_at: existingSummary.created_at,
          language: "EN",
          content_source: existingSummary.summary_data?.content_source || "stored",
          has_real_content: true,
        },
      }

      return NextResponse.json({
        success: true,
        summary: storedSummary,
        transcript: existingSummary.summary_data?.transcript || "",
        processing_time: 0,
        content_length: existingSummary.summary_data?.transcript?.length || 0,
        audioExtractionStatus: existingSummary.summary_data?.audioStatus || { successful: false, method: "stored" },
        from_storage: true,
        debug_info: {
          video_id: videoId,
          title: existingSummary.video_title,
          channel: existingSummary.summary_data?.channel || "Unknown",
          duration: existingSummary.video_duration || 0,
          content_source: "database_storage",
          has_real_content: true,
          transcript_based: existingSummary.summary_data?.audioStatus?.successful || false,
        },
      })
    }

    console.log("No existing summary found, generating new one...")
    console.log("Getting enhanced video content...")
    const { transcript, title, duration, channel, audioStatus } = await getVideoTranscript(videoId)

    const validation = await validateVideoLength(duration, userId, supabase)
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: validation.error,
          code: "VIDEO_TOO_LONG",
          duration: duration,
          plan: validation.plan,
        },
        { status: 400 },
      )
    }

    console.log(`Video length validation passed for ${validation.plan} plan`)

    const hasRealContent = transcript.length > 200 && !transcript.includes("Unable to extract content")
    const contentSource = audioStatus.successful ? "whisper_transcript" : "video_metadata"

    console.log(`Enhanced video data retrieved:`)
    console.log(`- Title: ${title}`)
    console.log(`- Channel: ${channel}`)
    console.log(`- Duration: ${duration}s`)
    console.log(`- Content length: ${transcript.length} characters`)
    console.log(`- Content source: ${contentSource}`)
    console.log(`- Audio extraction successful: ${audioStatus.successful}`)

    const startTime = Date.now()

    // Use enhanced transcript processing
    const summaryData = await processTranscriptWithAI(transcript, title, channel, duration, audioStatus)

    const summary = summaryData

    summary.meta = {
      video_id: videoId,
      title,
      channel,
      duration_sec: duration,
      url,
      created_at: new Date().toISOString(),
      language: "EN",
      content_source: contentSource,
      has_real_content: hasRealContent,
    }

    const processingTime = Date.now() - startTime

    console.log("Saving summary to database...")
    const summaryToInsert = {
      video_id: videoId,
      video_url: url,
      video_title: title,
      video_duration: duration,
      overview: summary.overview,
      highlights: summary.highlights,
      key_takeaways: summary.key_takeaways,
      chapters: summary.chapters,
      faq: summary.faq,
      glossary: summary.glossary,
      status: "completed",
      processing_time: processingTime,
      summary_data: {
        transcript,
        channel,
        content_source: contentSource,
        audioStatus,
        has_real_content: hasRealContent,
        tokens_used: 0,
      },
    }

    summaryToInsert.user_id = userId

    console.log("Attempting to insert summary:", {
      video_id: videoId,
      video_title: title,
      user_id: userId || "null",
      data_size: JSON.stringify(summaryToInsert).length,
    })

    const { data: insertedData, error: saveError } = await supabase.from("summaries").insert(summaryToInsert).select()

    if (saveError) {
      console.error("Error saving summary to database:", saveError)
      console.error("Error details:", {
        message: saveError.message,
        details: saveError.details,
        hint: saveError.hint,
        code: saveError.code,
      })
      // Continue anyway, don't fail the request
    } else {
      console.log("Summary saved successfully to database")
      console.log("Inserted data:", insertedData)
    }

    console.log(`Processing completed in ${processingTime}ms`)

    return NextResponse.json({
      success: true,
      summary,
      transcript: transcript, // Include the actual transcript from Whisper
      processing_time: processingTime,
      content_length: transcript.length,
      audioExtractionStatus: audioStatus,
      from_storage: false,
      debug_info: {
        video_id: videoId,
        title,
        channel,
        duration,
        content_source: contentSource,
        has_real_content: hasRealContent,
        transcript_based: audioStatus.successful,
      },
    })
  } catch (error) {
    console.error("Summarization error:", error)
    return NextResponse.json(
      {
        error: "Failed to process video. Please try again.",
        debug: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function processTranscriptWithAI(
  transcript: string,
  title: string,
  channel: string,
  duration: number,
  audioStatus: any,
) {
  let summaryData = null

  if (transcript && transcript.length > 100) {
    audioStatus.processingSteps.push("Starting enhanced AI analysis of transcript")

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Enhanced AI processing attempt ${attempt}/3`)

        // Use more of the transcript for better analysis
        const transcriptChunks = splitTranscriptIntoChunks(transcript, 6000)
        const primaryChunk = transcriptChunks[0]

        const { text } = await generateText({
          model: groq("llama-3.3-70b-versatile"),
          prompt: `You are analyzing a YouTube video transcript. Extract information ONLY from the actual spoken content provided.

TRANSCRIPT CONTENT:
"${primaryChunk}"

VIDEO METADATA:
Title: ${title}
Channel: ${channel}
Duration: ${Math.floor(duration / 60)} minutes

INSTRUCTIONS:
1. Read the entire transcript carefully
2. Extract ONLY information that is explicitly mentioned in the spoken content
3. Use direct quotes from the transcript when possible
4. Identify natural topic changes for chapters
5. Look for questions, definitions, and key concepts actually discussed

Create a JSON response with these exact fields:
{
  "overview": "2-3 sentence summary of what is actually discussed in the video",
  "highlights": ["4-5 specific key points mentioned in the transcript", "Use actual quotes or paraphrases from the content"],
  "key_takeaways": ["3-4 actionable insights from what was actually said", "Based on advice or recommendations in the transcript"],
  "main_topics": ["3-5 main topics discussed", "Based on natural topic changes in the content"],
  "questions_discussed": ["Questions or problems addressed in the video"],
  "key_terms": ["Important terms or concepts defined in the video"]
}

Respond with valid JSON only. Base everything on the actual transcript content.`,
          maxTokens: 2000,
          temperature: 0.1,
        })

        audioStatus.processingSteps.push(`Enhanced AI attempt ${attempt}: ${text ? "Got response" : "Empty response"}`)

        if (text && text.trim().length > 0) {
          let jsonData = null

          // Try multiple JSON extraction patterns
          const patterns = [/\{[\s\S]*\}/, /```json\s*(\{[\s\S]*\})\s*```/, /```\s*(\{[\s\S]*\})\s*```/]

          for (const pattern of patterns) {
            const match = text.match(pattern)
            if (match) {
              try {
                jsonData = JSON.parse(match[1] || match[0])
                audioStatus.processingSteps.push(`Successfully parsed enhanced JSON on attempt ${attempt}`)
                break
              } catch (e) {
                continue
              }
            }
          }

          if (jsonData && (jsonData.overview || jsonData.highlights)) {
            summaryData = {
              highlights: Array.isArray(jsonData.highlights)
                ? jsonData.highlights.slice(0, 5)
                : extractSmartHighlightsFromTranscript(transcript),
              key_takeaways: Array.isArray(jsonData.key_takeaways)
                ? jsonData.key_takeaways.slice(0, 4)
                : extractSmartTakeawaysFromTranscript(transcript),
              overview: jsonData.overview || createSmartOverviewFromTranscript(transcript, title),
              chapters: createSmartChaptersFromTranscript(transcript, duration, jsonData.main_topics),
              faq: createSmartFAQFromTranscript(transcript, jsonData.questions_discussed),
              glossary: createSmartGlossaryFromTranscript(transcript, jsonData.key_terms),
            }

            console.log(`Successfully created enhanced transcript-based summary on attempt ${attempt}`)
            audioStatus.processingSteps.push(`Enhanced AI processing successful on attempt ${attempt}`)
            break
          } else {
            audioStatus.detailedErrors.push(`Enhanced AI attempt ${attempt}: Invalid JSON structure`)
          }
        } else {
          audioStatus.detailedErrors.push(`Enhanced AI attempt ${attempt}: Empty response`)
        }
      } catch (aiError) {
        console.error(`Enhanced AI processing attempt ${attempt} failed:`, aiError)
        audioStatus.detailedErrors.push(
          `Enhanced AI attempt ${attempt}: ${aiError instanceof Error ? aiError.message : "Unknown error"}`,
        )

        if (attempt === 3) {
          summaryData = createSmartTranscriptBasedFallback(transcript, title, channel, duration)
          audioStatus.processingSteps.push("Used enhanced transcript-based fallback after AI failures")
        }
      }
    }
  }

  if (!summaryData) {
    console.log("Creating enhanced content from available transcript data")
    summaryData = createSmartTranscriptBasedFallback(transcript, title, channel, duration)
    audioStatus.processingSteps.push("Used enhanced transcript-based content creation")
  }

  return summaryData
}

function splitTranscriptIntoChunks(transcript: string, maxChunkSize: number): string[] {
  const chunks = []
  let currentChunk = ""
  const sentences = transcript.split(/[.!?]+/)

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk += sentence + ". "
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

function extractSmartHighlightsFromTranscript(transcript: string): string[] {
  const sentences = transcript.split(/[.!?]+/).filter((s) => s.trim().length > 30)
  const highlights = []

  // Look for sentences with emphasis words
  const emphasisWords = ["important", "key", "crucial", "significant", "main", "primary", "essential", "critical"]
  const emphasisSentences = sentences.filter((s) => emphasisWords.some((word) => s.toLowerCase().includes(word)))

  // Look for sentences with numbers or statistics
  const numberSentences = sentences.filter((s) => /\d+/.test(s) && s.length > 40)

  // Look for sentences with action words
  const actionWords = ["should", "must", "need to", "have to", "recommend", "suggest"]
  const actionSentences = sentences.filter((s) => actionWords.some((word) => s.toLowerCase().includes(word)))

  // Combine and prioritize
  const prioritySentences = [...emphasisSentences, ...numberSentences, ...actionSentences]
  const uniqueSentences = [...new Set(prioritySentences)]

  // Fill with regular sentences if needed
  if (uniqueSentences.length < 4) {
    const regularSentences = sentences.filter((s) => !uniqueSentences.includes(s))
    uniqueSentences.push(...regularSentences.slice(0, 4 - uniqueSentences.length))
  }

  return uniqueSentences.slice(0, 5).map((s) => s.trim())
}

function extractSmartTakeawaysFromTranscript(transcript: string): string[] {
  const sentences = transcript.split(/[.!?]+/)
  const takeaways = []

  // Look for actionable advice
  const actionPatterns = [
    /you should/i,
    /you need to/i,
    /you must/i,
    /i recommend/i,
    /the key is/i,
    /remember to/i,
    /make sure/i,
    /don't forget/i,
  ]

  for (const sentence of sentences) {
    if (actionPatterns.some((pattern) => pattern.test(sentence)) && sentence.length > 30) {
      takeaways.push(sentence.trim())
      if (takeaways.length >= 4) break
    }
  }

  // If not enough actionable content, look for insights
  if (takeaways.length < 3) {
    const insightWords = ["because", "therefore", "this means", "the reason", "that's why"]
    for (const sentence of sentences) {
      if (insightWords.some((word) => sentence.toLowerCase().includes(word)) && sentence.length > 30) {
        takeaways.push(sentence.trim())
        if (takeaways.length >= 3) break
      }
    }
  }

  return takeaways.length > 0 ? takeaways : [`Key insights from the video content`]
}

function createSmartOverviewFromTranscript(transcript: string, title: string): string {
  const sentences = transcript.split(/[.!?]+/).filter((s) => s.trim().length > 20)

  // Look for introduction sentences
  const introSentences = sentences.slice(0, 3)
  const mainContent = sentences.slice(3, 8)

  const overview = `This video "${title}" ${introSentences[0]?.trim() || "discusses"}. ${mainContent[0]?.trim() || "The content covers various topics related to the subject."}`

  return overview
}

function createSmartChaptersFromTranscript(transcript: string, duration: number, topics?: string[]): any[] {
  const sentences = transcript.split(/[.!?]+/).filter((s) => s.trim().length > 20)
  const chapterCount = Math.min(5, Math.max(2, Math.floor(duration / 180))) // 1 chapter per 3 minutes
  const chapters = []

  // Use topics if available, otherwise create generic chapters
  const chapterTopics = topics && topics.length >= chapterCount ? topics : null

  for (let i = 0; i < chapterCount; i++) {
    const startTime = Math.floor((duration / chapterCount) * i)
    const endTime = i === chapterCount - 1 ? duration : Math.floor((duration / chapterCount) * (i + 1))

    const chapterSentences = sentences.slice(
      Math.floor((sentences.length / chapterCount) * i),
      Math.floor((sentences.length / chapterCount) * (i + 1)),
    )

    const chapterTitle = chapterTopics
      ? chapterTopics[i]
      : `${chapterSentences[0]?.substring(0, 50) || `Chapter ${i + 1}`}...`

    chapters.push({
      start: startTime,
      end: endTime,
      title: chapterTitle,
      summary: chapterSentences.slice(0, 3).map((s) => s.trim()),
      quotes: [
        {
          text: chapterSentences[0]?.trim() || "Content from this section",
          t: startTime + 30,
        },
      ],
      entities: extractKeyWordsFromText(chapterSentences.join(" ")),
    })
  }

  return chapters
}

function createSmartFAQFromTranscript(transcript: string, discussedQuestions?: string[]): any[] {
  const faq = []
  const sentences = transcript.split(/[.!?]+/).filter((s) => s.trim().length > 10)

  // Extract actual questions from transcript
  const directQuestions = sentences.filter((s) => s.includes("?") && s.trim().length > 20).slice(0, 2)

  // Add direct questions with comprehensive answers
  directQuestions.forEach((question, i) => {
    const questionIndex = sentences.indexOf(question)
    // Get multiple sentences for comprehensive answer
    const answerSentences = sentences.slice(questionIndex + 1, questionIndex + 4).filter((s) => s.trim().length > 10)
    const comprehensiveAnswer =
      answerSentences.join(". ").trim() || "This question is addressed in detail in the video content."

    faq.push({
      q: question.trim(),
      a: comprehensiveAnswer,
      t: Math.floor((i + 1) * 180),
    })
  })

  // Generate semantic questions based on content analysis
  const contentKeywords = extractContentKeywords(transcript)
  const semanticQuestions = generateSemanticQuestions(transcript, contentKeywords)

  semanticQuestions.slice(0, 3 - faq.length).forEach((item, i) => {
    faq.push({
      q: item.question,
      a: item.answer,
      t: Math.floor((faq.length + i + 1) * 200),
    })
  })

  return faq.length > 0
    ? faq
    : [
        {
          q: "What is the main topic of this video?",
          a: extractMainTopic(transcript),
          t: 30,
        },
      ]
}

function createSmartGlossaryFromTranscript(transcript: string, keyTerms?: string[]): any[] {
  const glossary = []

  // Extract technical and domain-specific terms
  const extractedTerms = extractTechnicalTerms(transcript)
  const conceptTerms = extractConceptualTerms(transcript)
  const allTerms = [...extractedTerms, ...conceptTerms, ...(keyTerms || [])]

  // Remove duplicates and prioritize
  const uniqueTerms = [...new Set(allTerms)].slice(0, 6)

  uniqueTerms.forEach((term) => {
    const definition = generateComprehensiveDefinition(term, transcript)
    if (definition && definition.length > 20) {
      glossary.push({
        term: term,
        definition: definition,
      })
    }
  })

  return glossary.length > 0
    ? glossary
    : [
        {
          term: "Key Concept",
          definition: "Important ideas and topics discussed throughout the video content.",
        },
      ]
}

function extractContentKeywords(transcript: string): string[] {
  const words = transcript.toLowerCase().split(/\W+/)
  const stopWords = new Set([
    "the",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "can",
    "this",
    "that",
    "these",
    "those",
    "i",
    "you",
    "he",
    "she",
    "it",
    "we",
    "they",
    "me",
    "him",
    "her",
    "us",
    "them",
  ])

  const wordFreq = new Map()
  words.forEach((word) => {
    if (word.length > 3 && !stopWords.has(word)) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
    }
  })

  return Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)
}

function generateSemanticQuestions(
  transcript: string,
  keywords: string[],
): Array<{ question: string; answer: string }> {
  const questions = []
  const sentences = transcript.split(/[.!?]+/).filter((s) => s.trim().length > 20)

  // Generate "How" questions
  const howSentences = sentences.filter(
    (s) => s.toLowerCase().includes("how") || s.toLowerCase().includes("process") || s.toLowerCase().includes("method"),
  )
  if (howSentences.length > 0) {
    const context = howSentences[0]
    questions.push({
      question: "How does this process work?",
      answer: findRelatedSentences(context, sentences, 2).join(". "),
    })
  }

  // Generate "What" questions based on keywords
  keywords.slice(0, 2).forEach((keyword) => {
    const relatedSentences = sentences.filter((s) => s.toLowerCase().includes(keyword.toLowerCase()))
    if (relatedSentences.length > 0) {
      questions.push({
        question: `What is ${keyword}?`,
        answer: findRelatedSentences(relatedSentences[0], sentences, 2).join(". "),
      })
    }
  })

  // Generate "Why" questions
  const whySentences = sentences.filter(
    (s) =>
      s.toLowerCase().includes("because") ||
      s.toLowerCase().includes("reason") ||
      s.toLowerCase().includes("important"),
  )
  if (whySentences.length > 0) {
    questions.push({
      question: "Why is this important?",
      answer: findRelatedSentences(whySentences[0], sentences, 2).join(". "),
    })
  }

  return questions
}

function extractTechnicalTerms(transcript: string): string[] {
  const text = transcript.toLowerCase()
  const terms = []

  // Look for capitalized words (likely proper nouns/technical terms)
  const capitalizedWords = transcript.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []
  terms.push(
    ...capitalizedWords.filter(
      (term) => term.length > 3 && !["YouTube", "Video", "Channel", "Subscribe"].includes(term),
    ),
  )

  // Look for technical patterns
  const technicalPatterns = [
    /\b\w+(?:ing|tion|sion|ment|ness|ity|ism)\b/g, // Technical suffixes
    /\b[A-Z]{2,}\b/g, // Acronyms
    /\b\w+[-_]\w+\b/g, // Hyphenated/underscore terms
  ]

  technicalPatterns.forEach((pattern) => {
    const matches = transcript.match(pattern) || []
    terms.push(...matches.filter((term) => term.length > 3))
  })

  return [...new Set(terms)].slice(0, 8)
}

function extractConceptualTerms(transcript: string): string[] {
  const conceptIndicators = [
    "concept",
    "principle",
    "theory",
    "method",
    "approach",
    "strategy",
    "technique",
    "process",
    "system",
    "framework",
    "model",
    "algorithm",
  ]

  const sentences = transcript.split(/[.!?]+/)
  const conceptTerms = []

  conceptIndicators.forEach((indicator) => {
    const relevantSentences = sentences.filter((s) => s.toLowerCase().includes(indicator))

    relevantSentences.forEach((sentence) => {
      const words = sentence.split(/\W+/)
      const indicatorIndex = words.findIndex((w) => w.toLowerCase() === indicator)

      if (indicatorIndex > 0) {
        const potentialTerm = words.slice(Math.max(0, indicatorIndex - 2), indicatorIndex + 1).join(" ")
        if (potentialTerm.length > 5) {
          conceptTerms.push(potentialTerm)
        }
      }
    })
  })

  return [...new Set(conceptTerms)].slice(0, 5)
}

function generateComprehensiveDefinition(term: string, transcript: string): string {
  const sentences = transcript.split(/[.!?]+/).filter((s) => s.trim().length > 10)

  // Find sentences containing the term
  const relevantSentences = sentences.filter((s) => s.toLowerCase().includes(term.toLowerCase()))

  if (relevantSentences.length === 0) {
    return `A key concept discussed in the video content.`
  }

  // Get context around the term
  const primarySentence = relevantSentences[0]
  const contextSentences = findRelatedSentences(primarySentence, sentences, 2)

  let definition = contextSentences.join(". ").trim()

  // Ensure definition is comprehensive but not too long
  if (definition.length > 200) {
    definition = definition.substring(0, 200) + "..."
  }

  return definition || `Important concept related to ${term} as discussed in the video.`
}

function findRelatedSentences(targetSentence: string, allSentences: string[], count: number): string[] {
  const targetIndex = allSentences.indexOf(targetSentence)
  if (targetIndex === -1) return [targetSentence]

  const start = Math.max(0, targetIndex)
  const end = Math.min(allSentences.length, targetIndex + count + 1)

  return allSentences.slice(start, end).filter((s) => s.trim().length > 10)
}

function extractMainTopic(transcript: string): string {
  const sentences = transcript.split(/[.!?]+/).filter((s) => s.trim().length > 20)
  if (sentences.length === 0) return "Various topics discussed in the video."

  const firstSentences = sentences.slice(0, 3).join(". ")
  return firstSentences.length > 150 ? firstSentences.substring(0, 150) + "..." : firstSentences
}

function createSmartTranscriptBasedFallback(transcript: string, title: string, channel: string, duration: number) {
  return {
    highlights: extractSmartHighlightsFromTranscript(transcript),
    key_takeaways: extractSmartTakeawaysFromTranscript(transcript),
    overview: createSmartOverviewFromTranscript(transcript, title),
    chapters: createSmartChaptersFromTranscript(transcript, duration),
    faq: createSmartFAQFromTranscript(transcript),
    glossary: createSmartGlossaryFromTranscript(transcript),
  }
}

function createTranscriptBasedChapters(transcript: string, duration: number) {
  const sentences = transcript.split(/[.!?]+/).filter((s) => s.trim().length > 20)
  const chapterCount = Math.min(4, Math.max(2, Math.floor(sentences.length / 10)))
  const chapters = []

  for (let i = 0; i < chapterCount; i++) {
    const startTime = Math.floor((duration / chapterCount) * i)
    const endTime = Math.floor((duration / chapterCount) * (i + 1))
    const chapterSentences = sentences.slice(
      Math.floor((sentences.length / chapterCount) * i),
      Math.floor((sentences.length / chapterCount) * (i + 1)),
    )

    chapters.push({
      start: startTime,
      end: endTime,
      title: `Chapter ${i + 1}`,
      summary: chapterSentences.slice(0, 3).map((s) => s.trim()),
      quotes: [
        {
          text: chapterSentences[0]?.trim() || "Content from this section",
          t: startTime + 30,
        },
      ],
      entities: extractKeyWordsFromText(chapterSentences.join(" ")),
    })
  }

  return chapters
}

function createTranscriptBasedFAQ(transcript: string, aiData: any) {
  const questions = []
  const sentences = transcript.split(/[.!?]+/).filter((s) => s.trim().length > 10)

  // Extract question-like content from transcript
  const questionSentences = sentences.filter(
    (s) =>
      s.includes("?") ||
      s.toLowerCase().includes("how") ||
      s.toLowerCase().includes("what") ||
      s.toLowerCase().includes("why"),
  )

  if (questionSentences.length > 0) {
    questionSentences.slice(0, 3).forEach((q, i) => {
      questions.push({
        question: q.trim().endsWith("?") ? q.trim() : `${q.trim()}?`,
        answer: sentences[sentences.indexOf(q) + 1] || "Discussed in the video content",
        timestamp: Math.floor((i + 1) * 60),
      })
    })
  } else {
    // Create questions based on highlights if available
    if (aiData?.highlights) {
      aiData.highlights.slice(0, 3).forEach((highlight: string, i: number) => {
        questions.push({
          question: `What about ${highlight.toLowerCase()}?`,
          answer: highlight,
          timestamp: Math.floor((i + 1) * 60),
        })
      })
    }
  }

  return questions.length > 0
    ? questions
    : [
        {
          question: "What is this video about?",
          answer: "The video covers the topics discussed in the transcript",
          timestamp: 30,
        },
      ]
}

function extractActualTermsFromTranscript(transcript: string) {
  const words = transcript.toLowerCase().split(/\W+/)
  const technicalTerms = words.filter(
    (word) =>
      word.length > 6 &&
      ![
        "the",
        "and",
        "for",
        "are",
        "but",
        "not",
        "you",
        "all",
        "can",
        "had",
        "her",
        "was",
        "one",
        "our",
        "out",
        "day",
        "get",
        "has",
        "him",
        "his",
        "how",
        "its",
        "may",
        "new",
        "now",
        "old",
        "see",
        "two",
        "who",
        "boy",
        "did",
        "man",
        "men",
        "put",
        "say",
        "she",
        "too",
        "use",
      ].includes(word),
  )

  const uniqueTerms = [...new Set(technicalTerms)].slice(0, 5)

  return uniqueTerms.map((term) => ({
    term: term.charAt(0).toUpperCase() + term.slice(1),
    definition: `Term mentioned in the video content`,
  }))
}

function createTranscriptBasedFallback(transcript: string, title: string, channel: string, duration: number) {
  const sentences = transcript.split(/[.!?]+/).filter((s) => s.trim().length > 20)

  return {
    highlights: sentences.slice(0, 4).map((s) => s.trim()),
    key_takeaways: sentences.slice(4, 7).map((s) => s.trim()),
    overview: `This video by ${channel} discusses: ${sentences[0]?.trim() || title}`,
    chapters: createTranscriptBasedChapters(transcript, duration),
    faq: createTranscriptBasedFAQ(transcript, {}),
    glossary: extractActualTermsFromTranscript(transcript),
  }
}

function extractKeyWordsFromText(text: string) {
  return text
    .split(/\W+/)
    .filter((word) => word.length > 4)
    .slice(0, 3)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
}

function createChaptersFromTranscript(transcript: string, duration: number) {
  const words = transcript.split(" ")
  const chapterCount = Math.min(4, Math.max(2, Math.floor(duration / 300))) // 1 chapter per 5 minutes
  const wordsPerChapter = Math.floor(words.length / chapterCount)

  const chapters = []
  for (let i = 0; i < chapterCount; i++) {
    const startTime = Math.floor((duration / chapterCount) * i)
    const endTime = i === chapterCount - 1 ? duration : Math.floor((duration / chapterCount) * (i + 1))

    const chapterWords = words.slice(i * wordsPerChapter, (i + 1) * wordsPerChapter)
    const chapterText = chapterWords.join(" ").substring(0, 200)

    chapters.push({
      start: startTime,
      end: endTime,
      title: `Part ${i + 1}`,
      summary: [
        chapterText.split(".")[0] + ".",
        "Key points discussed in this section",
        "Important details and examples",
      ],
      quotes: [
        {
          text: chapterText.split(".")[0] + ".",
          t: startTime + Math.floor((endTime - startTime) / 2),
        },
      ],
      entities: extractKeyTerms(chapterText),
    })
  }

  return chapters
}

function createFAQFromContent(basicSummary: any, duration: number) {
  const faq = []

  if (basicSummary.highlights && basicSummary.highlights.length > 0) {
    faq.push({
      q: "What are the main points covered?",
      a: basicSummary.highlights.slice(0, 2).join(". ") + ".",
      t: Math.floor(duration * 0.3),
    })
  }

  if (basicSummary.key_takeaways && basicSummary.key_takeaways.length > 0) {
    faq.push({
      q: "What should I remember from this video?",
      a: basicSummary.key_takeaways[0],
      t: Math.floor(duration * 0.7),
    })
  }

  faq.push({
    q: "Who is this video for?",
    a: "Anyone interested in learning about the topics discussed in this video.",
    t: Math.floor(duration * 0.1),
  })

  return faq
}

function extractTermsFromTranscript(transcript: string) {
  const words = transcript.toLowerCase().split(/\s+/)
  const commonTerms = ["important", "key", "main", "essential", "critical", "significant"]

  const glossary = []
  for (const term of commonTerms) {
    if (words.includes(term)) {
      glossary.push({
        term: term.charAt(0).toUpperCase() + term.slice(1),
        definition: `A ${term} concept discussed in the video`,
      })
    }
    if (glossary.length >= 3) break
  }

  return glossary.length > 0
    ? glossary
    : [{ term: "Key Point", definition: "An important concept discussed in the video" }]
}

function extractKeyTerms(text: string) {
  const words = text.split(" ")
  return words.filter((word) => word.length > 6).slice(0, 3)
}

function createIntelligentFallback(title: string, channel: string, duration: number, transcript: string) {
  // Analyze title to determine topic category and create relevant content
  const titleLower = title.toLowerCase()
  const isEducational = /tutorial|how to|guide|learn|course|lesson|explain/i.test(title)
  const isTech = /code|programming|software|tech|ai|data|web|app/i.test(title)
  const isBusiness = /business|marketing|startup|entrepreneur|money|finance/i.test(title)
  const isLifestyle = /lifestyle|health|fitness|cooking|travel|diy/i.test(title)

  let topicSpecificContent = {
    highlights: [],
    key_takeaways: [],
    overview: "",
    chapters: [],
    faq: [],
    glossary: [],
  }

  if (isEducational && isTech) {
    topicSpecificContent = {
      highlights: [
        `Step-by-step walkthrough of ${title.replace(/how to|tutorial|guide/gi, "").trim()}`,
        `Practical coding examples and demonstrations`,
        `Common pitfalls and how to avoid them`,
        `Best practices from ${channel}'s experience`,
        `Tools and resources for implementation`,
      ],
      key_takeaways: [
        "Clear understanding of core concepts",
        "Hands-on implementation techniques",
        "Debugging and troubleshooting methods",
        "Performance optimization tips",
        "Next steps for continued learning",
      ],
      overview: `This ${Math.floor(duration / 60)}-minute technical tutorial by ${channel} provides comprehensive guidance on ${title.toLowerCase()}. Perfect for developers looking to master this topic with practical, actionable insights.`,
      chapters: [
        {
          start: 0,
          end: Math.floor(duration * 0.2),
          title: "Introduction & Setup",
          summary: [
            "Topic overview and prerequisites",
            "Development environment setup",
            "Required tools and dependencies",
          ],
          quotes: [{ text: "Let's start by understanding the fundamentals", t: Math.floor(duration * 0.1) }],
          entities: ["Setup", "Prerequisites", "Environment"],
        },
        {
          start: Math.floor(duration * 0.2),
          end: Math.floor(duration * 0.8),
          title: "Implementation & Examples",
          summary: ["Core implementation details", "Live coding demonstrations", "Real-world examples and use cases"],
          quotes: [{ text: "Here's where the magic happens", t: Math.floor(duration * 0.5) }],
          entities: ["Implementation", "Code Examples", "Best Practices"],
        },
        {
          start: Math.floor(duration * 0.8),
          end: duration,
          title: "Testing & Next Steps",
          summary: ["Testing the implementation", "Common issues and solutions", "Resources for further learning"],
          quotes: [{ text: "Remember to test thoroughly in production", t: Math.floor(duration * 0.9) }],
          entities: ["Testing", "Debugging", "Resources"],
        },
      ],
      faq: [
        {
          q: "What prerequisites do I need for this tutorial?",
          a: "Basic programming knowledge and the development tools mentioned in the setup section.",
          t: Math.floor(duration * 0.15),
        },
        {
          q: "Can I follow along without prior experience?",
          a: "Yes, this tutorial is designed to be beginner-friendly with step-by-step explanations.",
          t: Math.floor(duration * 0.4),
        },
        {
          q: "Where can I find the source code?",
          a: "Check the video description for links to the GitHub repository and additional resources.",
          t: Math.floor(duration * 0.85),
        },
      ],
      glossary: [
        {
          term: "API",
          definition: "Application Programming Interface - a set of protocols for building software applications",
        },
        {
          term: "Framework",
          definition: "A platform for developing software applications with pre-written code and tools",
        },
      ],
    }
  } else if (isBusiness) {
    topicSpecificContent = {
      highlights: [
        `Strategic insights on ${title.replace(/business|marketing|startup/gi, "").trim()}`,
        `Real-world case studies and examples`,
        `Actionable frameworks and methodologies`,
        `Industry trends and market analysis`,
        `Expert advice from ${channel}`,
      ],
      key_takeaways: [
        "Strategic planning approaches",
        "Implementation roadmap",
        "Key performance indicators to track",
        "Common mistakes to avoid",
        "Scaling strategies for growth",
      ],
      overview: `${channel} shares ${Math.floor(duration / 60)} minutes of business insights on ${title.toLowerCase()}. Essential viewing for entrepreneurs and business professionals seeking practical strategies and proven methodologies.`,
      chapters: [
        {
          start: 0,
          end: Math.floor(duration * 0.25),
          title: "Market Context & Overview",
          summary: ["Current market landscape", "Key challenges and opportunities", "Strategic framework introduction"],
          quotes: [{ text: "Understanding the market is crucial for success", t: Math.floor(duration * 0.12) }],
          entities: ["Market Analysis", "Strategy", "Opportunities"],
        },
        {
          start: Math.floor(duration * 0.25),
          end: Math.floor(duration * 0.75),
          title: "Implementation Strategies",
          summary: ["Detailed methodology breakdown", "Case studies and examples", "Step-by-step implementation guide"],
          quotes: [{ text: "Execution is everything in business", t: Math.floor(duration * 0.5) }],
          entities: ["Implementation", "Case Studies", "Methodology"],
        },
        {
          start: Math.floor(duration * 0.75),
          end: duration,
          title: "Results & Scaling",
          summary: ["Measuring success and ROI", "Scaling strategies", "Long-term sustainability"],
          quotes: [{ text: "Scale what works, pivot what doesn't", t: Math.floor(duration * 0.87) }],
          entities: ["ROI", "Scaling", "Sustainability"],
        },
      ],
      faq: [
        {
          q: "How long does it take to see results?",
          a: "Results vary by implementation, but most strategies show initial impact within 3-6 months.",
          t: Math.floor(duration * 0.3),
        },
        {
          q: "What's the typical investment required?",
          a: "Investment depends on scale, but the video covers both low-cost and premium approaches.",
          t: Math.floor(duration * 0.6),
        },
        {
          q: "Can this work for small businesses?",
          a: "Absolutely - the strategies are scalable and adaptable for businesses of all sizes.",
          t: Math.floor(duration * 0.8),
        },
      ],
      glossary: [
        { term: "ROI", definition: "Return on Investment - a measure of the efficiency of an investment" },
        { term: "KPI", definition: "Key Performance Indicator - a measurable value that demonstrates effectiveness" },
      ],
    }
  } else {
    // Generic but intelligent fallback
    topicSpecificContent = {
      highlights: [
        `Comprehensive coverage of ${title}`,
        `Expert insights and practical advice from ${channel}`,
        `Real-world applications and examples`,
        `Step-by-step guidance and explanations`,
        `Valuable tips and best practices`,
      ],
      key_takeaways: [
        "Clear understanding of key concepts",
        "Practical implementation strategies",
        "Expert tips and recommendations",
        "Common pitfalls to avoid",
        "Next steps for continued progress",
      ],
      overview: `This ${Math.floor(duration / 60)}-minute video by ${channel} provides valuable insights on ${title.toLowerCase()}. The content offers practical guidance and expert knowledge for viewers interested in this topic.`,
      chapters: [
        {
          start: 0,
          end: Math.floor(duration * 0.3),
          title: "Introduction & Foundation",
          summary: ["Topic introduction and context", "Key concepts and terminology", "What viewers will learn"],
          quotes: [{ text: "Let's dive into the fundamentals", t: Math.floor(duration * 0.15) }],
          entities: ["Introduction", "Fundamentals", "Context"],
        },
        {
          start: Math.floor(duration * 0.3),
          end: Math.floor(duration * 0.7),
          title: "Deep Dive & Examples",
          summary: [
            "Detailed exploration of main topics",
            "Practical examples and demonstrations",
            "Real-world applications",
          ],
          quotes: [{ text: "Here's how this applies in practice", t: Math.floor(duration * 0.5) }],
          entities: ["Examples", "Applications", "Practice"],
        },
        {
          start: Math.floor(duration * 0.7),
          end: duration,
          title: "Summary & Action Steps",
          summary: ["Key takeaways recap", "Actionable next steps", "Additional resources"],
          quotes: [{ text: "Remember these key points moving forward", t: Math.floor(duration * 0.85) }],
          entities: ["Takeaways", "Action Steps", "Resources"],
        },
      ],
      faq: [
        {
          q: `What is the main focus of "${title}"?`,
          a: `This video focuses on providing comprehensive information and practical insights about the topic.`,
          t: Math.floor(duration * 0.25),
        },
        {
          q: "Who should watch this video?",
          a: "Anyone interested in learning more about this topic and gaining practical knowledge.",
          t: Math.floor(duration * 0.5),
        },
        {
          q: "What will I learn from this?",
          a: "You'll gain valuable insights, practical tips, and actionable knowledge you can apply immediately.",
          t: Math.floor(duration * 0.75),
        },
      ],
      glossary: [
        { term: "Key Concept", definition: "The main idea or principle discussed in the video" },
        { term: "Best Practice", definition: "Recommended approach or method for optimal results" },
      ],
    }
  }

  return {
    highlights: topicSpecificContent.highlights,
    key_takeaways: topicSpecificContent.key_takeaways,
    overview: topicSpecificContent.overview,
    chapters: topicSpecificContent.chapters,
    faq: topicSpecificContent.faq,
    glossary: topicSpecificContent.glossary,
  }
}

export { handlePOST as POST }
