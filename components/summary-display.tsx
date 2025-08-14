"use client"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Clock,
  ChevronDown,
  ChevronRight,
  Quote,
  HelpCircle,
  Lightbulb,
  BookOpen,
  ExternalLink,
  Copy,
  FileText,
  Mic,
} from "lucide-react"
import { ExportMenu } from "./export-menu"

// Types based on the specification
interface SummaryData {
  meta: {
    video_id: string
    title: string
    channel: string
    duration_sec: number
    language: string
    url: string
    created_at: string
  }
  highlights: string[]
  key_takeaways: string[]
  chapters: Array<{
    start: number
    end: number
    title: string
    summary: string[]
    quotes: Array<{ text: string; t: number }>
    faq: Array<{ q: string; a: string; t: number }>
    entities: string[]
  }>
  faq: Array<{ q: string; a: string; t: number }>
  glossary: Array<{ term: string; definition: string }>
}

interface SummaryDisplayProps {
  data: SummaryData
  transcript?: string // Added transcript prop
  audioStatus?: any // Added audioStatus prop
  onTimestampClick?: (timestamp: number) => void
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`
}

function TimestampButton({ timestamp, onClick }: { timestamp: number; onClick?: (t: number) => void }) {
  return (
    <button
      onClick={() => onClick?.(timestamp)}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-md transition-colors duration-200"
    >
      <Clock className="w-3 h-3" />
      {formatTime(timestamp)}
    </button>
  )
}

export function SummaryDisplay({ data, transcript, audioStatus, onTimestampClick }: SummaryDisplayProps) {
  const [openChapters, setOpenChapters] = useState<Set<number>>(new Set([0]))

  const toggleChapter = (index: number) => {
    const newOpen = new Set(openChapters)
    if (newOpen.has(index)) {
      newOpen.delete(index)
    } else {
      newOpen.add(index)
    }
    setOpenChapters(newOpen)
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(data.meta.url)
      // You could add a toast notification here
      console.log("URL copied to clipboard")
    } catch (error) {
      console.error("Failed to copy URL:", error)
    }
  }

  const handleWatchVideo = () => {
    window.open(data.meta.url, "_blank")
  }

  const handleCopyTranscript = async () => {
    if (!transcript) return
    try {
      await navigator.clipboard.writeText(transcript)
      console.log("Transcript copied to clipboard")
    } catch (error) {
      console.error("Failed to copy transcript:", error)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Video Meta Information */}
      <Card className="border-0 bg-white/90 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-xl text-slate-900">{data.meta.title}</CardTitle>
              <CardDescription className="flex items-center gap-4 text-sm">
                <span>{data.meta.channel}</span>
                <span>•</span>
                <span>{formatTime(data.meta.duration_sec)}</span>
                <span>•</span>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                  {(data.meta.language || "EN").toUpperCase()}
                </Badge>
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyUrl}>
                <Copy className="w-4 h-4 mr-2" />
                Copy URL
              </Button>
              <ExportMenu data={data} />
              <Button variant="outline" size="sm" onClick={handleWatchVideo}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Watch
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6 bg-white/90 backdrop-blur-sm">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="chapters">Chapters</TabsTrigger>
          <TabsTrigger value="takeaways">Key Points</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="glossary">Glossary</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card className="border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-emerald-600" />
                Highlights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {data.highlights.map((highlight, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-emerald-600 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-slate-700">{highlight}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-600" />
                Chapter Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.chapters.map((chapter, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-slate-900">{chapter.title}</h4>
                      <p className="text-sm text-slate-600">
                        {formatTime(chapter.start)} - {formatTime(chapter.end)}
                      </p>
                    </div>
                    <TimestampButton timestamp={chapter.start} onClick={onTimestampClick} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chapters Tab */}
        <TabsContent value="chapters" className="space-y-4">
          {data.chapters.map((chapter, index) => (
            <Card key={index} className="border-0 bg-white/90 backdrop-blur-sm">
              <Collapsible open={openChapters.has(index)} onOpenChange={() => toggleChapter(index)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-slate-50/50 transition-colors duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {openChapters.has(index) ? (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        )}
                        <div>
                          <CardTitle className="text-lg text-slate-900">{chapter.title}</CardTitle>
                          <CardDescription>
                            {formatTime(chapter.start)} - {formatTime(chapter.end)} • {chapter.summary.length} key
                            points
                          </CardDescription>
                        </div>
                      </div>
                      <TimestampButton timestamp={chapter.start} onClick={onTimestampClick} />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      {/* Chapter Summary */}
                      <div>
                        <h4 className="font-medium text-slate-900 mb-2">Summary</h4>
                        <ul className="space-y-1">
                          {chapter.summary.map((point, pointIndex) => (
                            <li key={pointIndex} className="flex items-start gap-3">
                              <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full mt-2 flex-shrink-0" />
                              <span className="text-slate-700 text-sm">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Chapter Quotes */}
                      {chapter.quotes.length > 0 && (
                        <div>
                          <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
                            <Quote className="w-4 h-4" />
                            Notable Quotes
                          </h4>
                          <div className="space-y-2">
                            {chapter.quotes.map((quote, quoteIndex) => (
                              <div
                                key={quoteIndex}
                                className="bg-slate-50 p-3 rounded-lg border-l-4 border-emerald-600"
                              >
                                <p className="text-slate-700 italic mb-2">"{quote.text}"</p>
                                <TimestampButton timestamp={quote.t} onClick={onTimestampClick} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Chapter Entities */}
                      {chapter.entities.length > 0 && (
                        <div>
                          <h4 className="font-medium text-slate-900 mb-2">Key Terms</h4>
                          <div className="flex flex-wrap gap-2">
                            {chapter.entities.map((entity, entityIndex) => (
                              <Badge key={entityIndex} variant="secondary" className="bg-slate-100 text-slate-700">
                                {entity}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </TabsContent>

        {/* Key Takeaways Tab */}
        <TabsContent value="takeaways">
          <Card className="border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-emerald-600" />
                Key Takeaways
              </CardTitle>
              <CardDescription>The most important insights and actionable points from this video</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {data.key_takeaways.map((takeaway, index) => (
                  <li key={index} className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg">
                    <div className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                      {index + 1}
                    </div>
                    <span className="text-slate-700">{takeaway}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAQ Tab */}
        <TabsContent value="faq">
          <Card className="border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-600" />
                Frequently Asked Questions
              </CardTitle>
              <CardDescription>Questions and answers extracted from the video content</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.faq.map((item, index) => (
                  <div key={index} className="border-b border-slate-200 pb-4 last:border-b-0">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-slate-900 pr-4">{item.q}</h4>
                      <TimestampButton timestamp={item.t} onClick={onTimestampClick} />
                    </div>
                    <p className="text-slate-700">{item.a}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Glossary Tab */}
        <TabsContent value="glossary">
          <Card className="border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-600" />
                Glossary
              </CardTitle>
              <CardDescription>Key terms and definitions mentioned in the video</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {data.glossary.map((item, index) => (
                  <div key={index} className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-semibold text-slate-900 mb-1">{item.term}</h4>
                    <p className="text-slate-700">{item.definition}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transcript">
          <Card className="border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {audioStatus?.successful ? (
                      <Mic className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <FileText className="w-5 h-5 text-orange-600" />
                    )}
                    Video Transcript
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    {audioStatus?.successful ? (
                      <>
                        <Badge variant="default" className="bg-green-100 text-green-700">
                          Whisper AI Transcription
                        </Badge>
                        <span className="text-sm text-slate-600">Generated from audio via {audioStatus.method}</span>
                      </>
                    ) : (
                      <>
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                          Video Metadata
                        </Badge>
                        <span className="text-sm text-slate-600">Based on video description and metadata</span>
                      </>
                    )}
                  </CardDescription>
                </div>
                {transcript && (
                  <Button variant="outline" size="sm" onClick={handleCopyTranscript}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Transcript
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {transcript ? (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-700">
                        Transcript Length: {transcript.length.toLocaleString()} characters
                      </span>
                      {audioStatus?.transcriptLength && (
                        <span className="text-xs text-slate-500">Processing: {audioStatus.method}</span>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-sans">
                        {transcript}
                      </pre>
                    </div>
                  </div>
                  {audioStatus?.successful && (
                    <div className="text-xs text-slate-500 bg-green-50 p-3 rounded-lg">
                      ✅ This transcript was generated using Groq's Whisper AI from the actual video audio. The summary
                      above is based on this real spoken content.
                    </div>
                  )}
                  {!audioStatus?.successful && (
                    <div className="text-xs text-slate-500 bg-orange-50 p-3 rounded-lg">
                      ⚠️ Audio extraction failed. This content is based on video metadata and descriptions only. The
                      summary may be less accurate than audio-based transcription.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No transcript available for this video.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
