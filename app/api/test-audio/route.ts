import { type NextRequest, NextResponse } from "next/server"

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

async function testApiYTExtraction(videoId: string): Promise<any> {
  console.log(`Testing ApiYT extraction for video: ${videoId}`)

  try {
    // Try ApiYT.com iframe endpoint
    const apiYtUrl = `https://apiyt.com/iframe/?vid=${videoId}`
    console.log(`Calling ApiYT: ${apiYtUrl}`)

    const response = await fetch(apiYtUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        Connection: "keep-alive",
      },
    })

    console.log(`ApiYT Response Status: ${response.status}`)
    console.log(`ApiYT Response Headers:`, Object.fromEntries(response.headers.entries()))

    if (response.ok) {
      const html = await response.text()
      console.log(`ApiYT HTML Response Length: ${html.length} characters`)
      console.log(`First 500 chars:`, html.substring(0, 500))

      // Look for various download link patterns
      const patterns = [
        /href="([^"]*\.mp3[^"]*)"/gi,
        /url['"]\s*:\s*['"]([^'"]*\.mp3[^'"]*)['"]/gi,
        /download['"]\s*:\s*['"]([^'"]*)['"]/gi,
        /"downloadUrl":\s*"([^"]*)"/gi,
        /"audio_url":\s*"([^"]*)"/gi,
        /data-url="([^"]*)"/gi,
      ]

      const foundLinks = []
      for (const pattern of patterns) {
        let match
        while ((match = pattern.exec(html)) !== null) {
          foundLinks.push({
            pattern: pattern.source,
            url: match[1],
          })
        }
      }

      return {
        success: response.ok,
        status: response.status,
        htmlLength: html.length,
        foundLinks,
        htmlPreview: html.substring(0, 1000),
      }
    } else {
      const errorText = await response.text()
      return {
        success: false,
        status: response.status,
        error: errorText.substring(0, 500),
      }
    }
  } catch (error) {
    console.error("ApiYT test error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "YouTube URL is required" }, { status: 400 })
    }

    const videoId = extractVideoId(url)
    if (!videoId) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 })
    }

    console.log(`Testing audio extraction for video ID: ${videoId}`)

    const result = await testApiYTExtraction(videoId)

    return NextResponse.json({
      videoId,
      url,
      apiYTResult: result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Test error:", error)
    return NextResponse.json(
      {
        error: "Test failed",
        debug: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
