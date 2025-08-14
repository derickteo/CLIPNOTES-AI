"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

export default function SuccessPage() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")
  const [isVerifying, setIsVerifying] = useState(true)

  useEffect(() => {
    if (sessionId) {
      // In a real implementation, verify the session with Stripe
      // and update user subscription status in Supabase
      setTimeout(() => setIsVerifying(false), 2000)
    } else {
      setIsVerifying(false)
    }
  }, [sessionId])

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Verifying your payment...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
      <div className="max-w-md mx-auto text-center bg-white rounded-lg shadow-lg p-8">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-4">Welcome to ClipNotesAI Pro!</h1>

        <p className="text-slate-600 mb-6">
          Your subscription has been activated. You now have access to unlimited video summaries and all Pro features.
        </p>

        <Link
          href="/"
          className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Start Creating Summaries
        </Link>
      </div>
    </div>
  )
}
