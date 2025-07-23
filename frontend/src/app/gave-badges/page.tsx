"use client"

import { useState, useEffect } from "react"
import { useAuthenticatedFetch } from "@/hooks/useAuthenticatedFetch"
import AuthMessage from "@/components/AuthMessage"
import { SignedIn, SignedOut, useUser } from '@clerk/nextjs'

// Emoji map for item types (no question marks, fallback to 🏷️)
const itemTypeEmojis: Record<string, string> = {
    Clothing: "👕",
    Books: "📚",
    Electronics: "💻",
    Technology: "💻",
    "Household Item": "🏠",
    Vehicle: "🚗",
    Other: "🏷️",
}

// Tier color map
const tierColors: Record<string, string> = {
    bronze: "border-[#cd7f32]",
    silver: "border-[#c0c0c0]",
    gold: "border-[#ffd700]",
}

type Badge = {
    tier: "bronze" | "silver" | "gold"
    name: string
    description: string
    min: number
    unit?: string
    progress: number // 0.0 to 1.0
    achieved: boolean
}
type BadgeGroups = Record<string, Badge[]>

// Shared grid component for badges
const BadgeGrid = ({ itemType, badges }: { itemType: string; badges: Badge[] }) => (
    <div className="mb-12">
        {/* Item type header on the left */}
        <div className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">
            {itemType}
        </div>
        {/* Two-column grid of badges under the header */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {badges.map((badge) => (
                <div
                    key={badge.name}
                    className="flex flex-col gap-2 bg-white dark:bg-gray-900 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700"
                >
                    {/* Badge content */}
                    <div className="flex items-center gap-4">
                        {/* Circular badge with emoji and border color */}
                        <span
                            className={`w-12 h-12 flex items-center justify-center rounded-full border-4 text-2xl bg-white dark:bg-gray-800 ${tierColors[badge.tier]}`}
                        >
                            {itemTypeEmojis[itemType] || "🏷️"}
                        </span>
                        {/* Badge name and description */}
                        <div>
                            <span className="font-semibold text-teal-600 dark:text-teal-400 text-base mb-1 block">
                                {badge.name}
                            </span>
                            <span className="text-gray-600 dark:text-gray-300 text-sm">
                                {badge.description}
                            </span>
                        </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                        <div
                            className={`h-2.5 rounded-full ${badge.achieved ? "bg-green-500" : "bg-teal-500"}`}
                            style={{ width: `${badge.progress * 100}%` }}
                        ></div>
                    </div>
                    {/* Progress Text */}
                    <div className="text-right text-xs text-gray-600 dark:text-gray-300">
                        {badge.achieved ? "Achieved!" : `${Math.round(badge.progress * 100)}% progress`}
                    </div>
                </div>
            ))}
        </div>
    </div>
)

const GaveBadgesPage = () => {
    const [badgeGroups, setBadgeGroups] = useState<BadgeGroups>({}) // State to store fetched badge data
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const { authenticatedFetch } = useAuthenticatedFetch()
    const { isSignedIn, isLoaded } = useUser() // Get user authentication status

    // Separate effect to handle authentication state changes
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            setLoading(false)
            setBadgeGroups({})
            setError(null)
        }
    }, [isLoaded, isSignedIn])

    useEffect(() => {
        const fetchGaveBadges = async () => {
            // Only fetch badges if user is signed in and Clerk has loaded
            if (!isLoaded || !isSignedIn) {
                setLoading(false)
                return
            }

            setLoading(true)
            setError(null)
            try {
                // Fetch donated badges from the backend endpoint
                const response = await authenticatedFetch(`/api/badges/donated`)
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }
                const data: BadgeGroups = await response.json()
                setBadgeGroups(data)
            } catch (err) {
                console.error("Failed to fetch gave badges:", err)
                setError("Failed to load gave badges.")
            } finally {
                setLoading(false)
            }
        }

        fetchGaveBadges()
    }, [authenticatedFetch, isLoaded, isSignedIn])

    return (
        <div className="container mx-auto py-8 px-4">
            <SignedOut>
                <AuthMessage />
            </SignedOut>
            <SignedIn>
                {/* Page header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Gave Badges</h1>
                    <p className="text-gray-600 dark:text-gray-400">Track your progress for items you've donated or given away</p>
                </div>

                {loading && <p className="text-center text-gray-500 dark:text-gray-400">Loading gave badges...</p>}
                {error && <p className="text-center text-red-500 dark:text-red-400">Error: {error}</p>}

                {!loading && !error && Object.keys(badgeGroups).length === 0 && (
                    <p className="text-center text-gray-500 dark:text-gray-400">No gave badges to display yet.</p>
                )}

                {/* Render badge grids for each item type */}
                {!loading && !error && Object.keys(badgeGroups).length > 0 && (
                    Object.entries(badgeGroups).map(([itemType, badges]) => (
                        <BadgeGrid key={itemType} itemType={itemType} badges={badges} />
                    ))
                )}
            </SignedIn>
        </div>
    )
}

export default GaveBadgesPage
