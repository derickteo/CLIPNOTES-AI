"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Download, FileText, Hash, BookOpen, Database, Loader2 } from "lucide-react"

interface ExportMenuProps {
  data: any
  disabled?: boolean
}

export function ExportMenu({ data, disabled = false }: ExportMenuProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportingFormat, setExportingFormat] = useState<string | null>(null)

  const handleExport = async (format: string) => {
    setIsExporting(true)
    setExportingFormat(format)

    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data, format }),
      })

      if (!response.ok) {
        throw new Error("Export failed")
      }

      if (format === "notion") {
        const result = await response.json()
        // Copy to clipboard for Notion
        await navigator.clipboard.writeText(JSON.stringify(result.blocks, null, 2))
        alert("Notion blocks copied to clipboard! Paste them into your Notion page.")
      } else {
        // Download file
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url

        const contentDisposition = response.headers.get("content-disposition")
        const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || `summary.${format}`
        a.download = filename

        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error("Export error:", error)
      alert("Failed to export summary. Please try again.")
    } finally {
      setIsExporting(false)
      setExportingFormat(null)
    }
  }

  const exportOptions = [
    {
      format: "markdown",
      label: "Markdown (.md)",
      icon: Hash,
      description: "Perfect for GitHub, documentation",
    },
    {
      format: "text",
      label: "Plain Text (.txt)",
      icon: FileText,
      description: "Simple text format",
    },
    {
      format: "notion",
      label: "Notion Blocks",
      icon: BookOpen,
      description: "Copy blocks to Notion",
    },
    {
      format: "json",
      label: "JSON Data (.json)",
      icon: Database,
      description: "Raw structured data",
    },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || isExporting}>
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Export
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">Export Summary</p>
          <p className="text-xs text-muted-foreground">Choose your preferred format</p>
        </div>
        <DropdownMenuSeparator />
        {exportOptions.map((option) => {
          const Icon = option.icon
          const isCurrentlyExporting = exportingFormat === option.format

          return (
            <DropdownMenuItem
              key={option.format}
              onClick={() => handleExport(option.format)}
              disabled={isExporting}
              className="flex flex-col items-start gap-1 p-3"
            >
              <div className="flex items-center gap-2 w-full">
                {isCurrentlyExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                <span className="font-medium">{option.label}</span>
              </div>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
