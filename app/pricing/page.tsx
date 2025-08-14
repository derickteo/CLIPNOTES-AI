"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, LogIn, LogOut, User, Loader2 } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { signOut } from "@/lib/actions"

export default function PricingPage() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const supabase = createClient()

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
  }, [supabase.auth])

  const handleUpgrade = async () => {
    if (!user) {
      // Redirect to login if not authenticated
      window.location.href = "/auth/login?redirect=/pricing"
      return
    }

    setCheckoutLoading(true)

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          priceId: "price_1234567890", // Replace with your actual Stripe price ID
          userId: user.id,
        }),
      })

      const data = await response.json()

      if (response.ok && data.checkoutUrl) {
        // Redirect to Stripe checkout
        window.location.href = data.checkoutUrl
      } else {
        alert(data.message || "Failed to create checkout session")
      }
    } catch (error) {
      console.error("Checkout error:", error)
      alert("Something went wrong. Please try again.")
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">ClipNotesAI</h1>
            </Link>
            <div className="flex items-center gap-2">
              {!authLoading && (
                <>
                  {user ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        <User className="w-3 h-3 mr-1" />
                        {user.email}
                      </Badge>
                      <form action={signOut}>
                        <Button type="submit" variant="ghost" size="sm">
                          <LogOut className="w-4 h-4" />
                        </Button>
                      </form>
                    </div>
                  ) : (
                    <Link href="/auth/login">
                      <Button variant="ghost" size="sm">
                        <LogIn className="w-4 h-4 mr-1" />
                        Sign In
                      </Button>
                    </Link>
                  )}
                </>
              )}
              <Link href="/">
                <Button variant="ghost" size="sm">
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-slate-900 mb-16">Simple, Transparent Pricing</h2>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Free Plan */}
            <Card className="bg-white border border-slate-200 rounded-lg p-8">
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-2xl font-bold text-slate-900 mb-4">Free Plan</CardTitle>
                <div className="text-4xl font-bold text-slate-900">
                  $0<span className="text-lg font-normal text-slate-500">/month</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 text-slate-600">
                  <li>• 5 video summaries per month</li>
                  <li>• Max video length: 15 minutes</li>
                  <li>• Basic export formats</li>
                  <li>• Community support</li>
                </ul>
                <Link href="/" className="block pt-4">
                  <Button
                    variant="outline"
                    className="w-full bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Get Started Free
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="bg-white border-2 border-emerald-500 rounded-lg p-8 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-emerald-600 text-white px-3 py-1 text-sm font-medium">Most Popular</Badge>
              </div>
              <CardHeader className="text-center pb-6 pt-4">
                <CardTitle className="text-2xl font-bold text-slate-900 mb-4">Pro Plan</CardTitle>
                <div className="text-4xl font-bold text-slate-900">
                  $19<span className="text-lg font-normal text-slate-500">/month</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 text-slate-600">
                  <li>• Unlimited video summaries</li>
                  <li>• Max video length: 2 hours</li>
                  <li>• All export formats</li>
                  <li>• Priority support</li>
                  <li>• Advanced AI features</li>
                </ul>
                <div className="pt-4">
                  <Button
                    onClick={handleUpgrade}
                    disabled={checkoutLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {checkoutLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Upgrade to Pro"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-16 text-center">
            <p className="text-sm text-slate-500">Secure payments powered by Stripe. Cancel anytime.</p>
          </div>
        </div>
      </main>
    </div>
  )
}
