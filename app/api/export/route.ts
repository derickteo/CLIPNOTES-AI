import { type NextRequest, NextResponse } from "next/server"

interface ExportData {
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

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`
}

function generateMarkdown(data: ExportData): string {
  const date = new Date(data.meta.created_at).toLocaleDateString()

  let markdown = `# ${data.meta.title}\n\n`
  markdown += `**Channel:** ${data.meta.channel}  \n`
  markdown += `**Duration:** ${formatTime(data.meta.duration_sec)}  \n`
  markdown += `**Language:** ${data.meta.language.toUpperCase()}  \n`
  markdown += `**URL:** [Watch Video](${data.meta.url})  \n`
  markdown += `**Generated:** ${date}\n\n`

  markdown += `---\n\n`

  // Highlights
  markdown += `## 🌟 Highlights\n\n`
  data.highlights.forEach((highlight) => {
    markdown += `- ${highlight}\n`
  })
  markdown += `\n`

  // Key Takeaways
  markdown += `## 💡 Key Takeaways\n\n`
  data.key_takeaways.forEach((takeaway, index) => {
    markdown += `${index + 1}. ${takeaway}\n`
  })
  markdown += `\n`

  // Chapters
  markdown += `## 📚 Chapters\n\n`
  data.chapters.forEach((chapter, index) => {
    markdown += `### ${index + 1}. ${chapter.title}\n`
    markdown += `**Time:** ${formatTime(chapter.start)} - ${formatTime(chapter.end)}\n\n`

    markdown += `**Summary:**\n`
    chapter.summary.forEach((point) => {
      markdown += `- ${point}\n`
    })
    markdown += `\n`

    if (chapter.quotes.length > 0) {
      markdown += `**Notable Quotes:**\n`
      chapter.quotes.forEach((quote) => {
        markdown += `> "${quote.text}" *(${formatTime(quote.t)})*\n\n`
      })
    }

    if (chapter.entities.length > 0) {
      markdown += `**Key Terms:** ${chapter.entities.join(", ")}\n\n`
    }

    markdown += `---\n\n`
  })

  // FAQ
  if (data.faq.length > 0) {
    markdown += `## ❓ FAQ\n\n`
    data.faq.forEach((item) => {
      markdown += `**Q: ${item.q}** *(${formatTime(item.t)})*\n\n`
      markdown += `A: ${item.a}\n\n`
    })
  }

  // Glossary
  if (data.glossary.length > 0) {
    markdown += `## 📖 Glossary\n\n`
    data.glossary.forEach((item) => {
      markdown += `**${item.term}:** ${item.definition}\n\n`
    })
  }

  return markdown
}

function generatePlainText(data: ExportData): string {
  const date = new Date(data.meta.created_at).toLocaleDateString()

  let text = `${data.meta.title}\n`
  text += `${"=".repeat(data.meta.title.length)}\n\n`

  text += `Channel: ${data.meta.channel}\n`
  text += `Duration: ${formatTime(data.meta.duration_sec)}\n`
  text += `Language: ${data.meta.language.toUpperCase()}\n`
  text += `URL: ${data.meta.url}\n`
  text += `Generated: ${date}\n\n`

  text += `${"=".repeat(50)}\n\n`

  // Highlights
  text += `HIGHLIGHTS\n`
  text += `${"-".repeat(10)}\n`
  data.highlights.forEach((highlight, index) => {
    text += `${index + 1}. ${highlight}\n`
  })
  text += `\n`

  // Key Takeaways
  text += `KEY TAKEAWAYS\n`
  text += `${"-".repeat(13)}\n`
  data.key_takeaways.forEach((takeaway, index) => {
    text += `${index + 1}. ${takeaway}\n`
  })
  text += `\n`

  // Chapters
  text += `CHAPTERS\n`
  text += `${"-".repeat(8)}\n`
  data.chapters.forEach((chapter, index) => {
    text += `\n${index + 1}. ${chapter.title}\n`
    text += `   Time: ${formatTime(chapter.start)} - ${formatTime(chapter.end)}\n\n`

    text += `   Summary:\n`
    chapter.summary.forEach((point) => {
      text += `   - ${point}\n`
    })

    if (chapter.quotes.length > 0) {
      text += `\n   Notable Quotes:\n`
      chapter.quotes.forEach((quote) => {
        text += `   "${quote.text}" (${formatTime(quote.t)})\n`
      })
    }

    if (chapter.entities.length > 0) {
      text += `\n   Key Terms: ${chapter.entities.join(", ")}\n`
    }
    text += `\n`
  })

  // FAQ
  if (data.faq.length > 0) {
    text += `FAQ\n`
    text += `${"-".repeat(3)}\n`
    data.faq.forEach((item) => {
      text += `\nQ: ${item.q} (${formatTime(item.t)})\n`
      text += `A: ${item.a}\n`
    })
    text += `\n`
  }

  // Glossary
  if (data.glossary.length > 0) {
    text += `GLOSSARY\n`
    text += `${"-".repeat(8)}\n`
    data.glossary.forEach((item) => {
      text += `\n${item.term}: ${item.definition}\n`
    })
  }

  return text
}

function generateNotionBlocks(data: ExportData): any[] {
  const blocks = []

  // Title
  blocks.push({
    object: "block",
    type: "heading_1",
    heading_1: {
      rich_text: [{ type: "text", text: { content: data.meta.title } }],
    },
  })

  // Meta info
  blocks.push({
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [
        { type: "text", text: { content: `Channel: ${data.meta.channel} | ` } },
        { type: "text", text: { content: `Duration: ${formatTime(data.meta.duration_sec)} | ` } },
        { type: "text", text: { content: `Language: ${data.meta.language.toUpperCase()}` } },
      ],
    },
  })

  blocks.push({
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [{ type: "text", text: { content: "Watch Video", link: { url: data.meta.url } } }],
    },
  })

  // Highlights
  blocks.push({
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: [{ type: "text", text: { content: "🌟 Highlights" } }],
    },
  })

  data.highlights.forEach((highlight) => {
    blocks.push({
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [{ type: "text", text: { content: highlight } }],
      },
    })
  })

  // Key Takeaways
  blocks.push({
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: [{ type: "text", text: { content: "💡 Key Takeaways" } }],
    },
  })

  data.key_takeaways.forEach((takeaway) => {
    blocks.push({
      object: "block",
      type: "numbered_list_item",
      numbered_list_item: {
        rich_text: [{ type: "text", text: { content: takeaway } }],
      },
    })
  })

  return blocks
}

export async function POST(request: NextRequest) {
  try {
    const { data, format } = await request.json()

    if (!data || !format) {
      return NextResponse.json({ error: "Data and format are required" }, { status: 400 })
    }

    const filename = `${data.meta.title.replace(/[^a-zA-Z0-9]/g, "_")}_summary`

    switch (format) {
      case "markdown":
        const markdown = generateMarkdown(data)
        return new NextResponse(markdown, {
          headers: {
            "Content-Type": "text/markdown",
            "Content-Disposition": `attachment; filename="${filename}.md"`,
          },
        })

      case "text":
        const text = generatePlainText(data)
        return new NextResponse(text, {
          headers: {
            "Content-Type": "text/plain",
            "Content-Disposition": `attachment; filename="${filename}.txt"`,
          },
        })

      case "notion":
        const notionBlocks = generateNotionBlocks(data)
        return NextResponse.json({
          blocks: notionBlocks,
          instructions: "Copy these blocks and paste them into your Notion page using the 'Import' feature.",
        })

      case "json":
        return new NextResponse(JSON.stringify(data, null, 2), {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="${filename}.json"`,
          },
        })

      default:
        return NextResponse.json({ error: "Unsupported format" }, { status: 400 })
    }
  } catch (error) {
    console.error("Export error:", error)
    return NextResponse.json({ error: "Failed to export summary" }, { status: 500 })
  }
}
