"use client"

import { useState, useEffect } from "react"
import { InfoIcon, X } from 'lucide-react'
// CSRF-based API imports (commented out - using JWT approach)
// import { useAuthenticatedFetch } from "@/hooks/useAuthenticatedFetch"

// JWT-based API imports (new approach)
import { fetchDonatedBadgesJWT, testClerkJWT } from "@/utils/api"
import AuthMessage from "@/components/landing/AuthMessage"
import { SignedIn, SignedOut, useUser, useAuth } from '@clerk/nextjs'

// Map database values to display names
const itemTypeDisplayNames: Record<string, string> = {
    'Clothing_Accessories': 'Clothing & Accessories',
    'Technology': 'Technology',
    'Furniture_Appliances': 'Furniture & Appliances',
    'Kitchenware': 'Kitchenware',
    'Books_Media': 'Books & Media',
    'Vehicles': 'Vehicles',
    'Personal_Care_Items': 'Personal Care Items',
    'Decor_Art': 'Decor & Art',
    'Tools_Equipment': 'Tools & Equipment',
    'Toys_Games': 'Toys & Games',
    'Outdoor_Gear': 'Outdoor Gear',
    'Fitness_Equipment': 'Fitness Equipment',
    'Pet_Supplies': 'Pet Supplies',
    'Subscriptions_Licenses': 'Subscriptions & Licenses',
    'Miscellaneous': 'Miscellaneous',
    'Other': 'Other'
}

// Emoji map for item types (no question marks, fallback to 🏷️)
const itemTypeEmojis: Record<string, string> = {
    Clothing_Accessories: "💍",
    Personal_Care_Items: "🪮",
    Technology: "💻",
    Subscriptions_Licenses: "📅",
    Vehicles: "🚗",
    Tools_Equipment: "🔧",
    Outdoor_Gear: "🏕️",
    Fitness_Equipment: "🎾",
    Furniture_Appliances: "🪑",
    Kitchenware: "🍽️",
    Decor_Art: "🎄",
    Books_Media: "📚",
    Toys_Games: "🧸",
    Pet_Supplies: "🐾",
    Miscellaneous: "🗃️",
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

// Badge summary component showing fraction of badges collected for each tier
const BadgeSummary = ({ badgeGroups }: { badgeGroups: BadgeGroups }) => {
    const [isTooltipModalOpen, setIsTooltipModalOpen] = useState(false)

    // Get unearned item types for the modal
    const allItemTypes = Object.keys(itemTypeDisplayNames)
    const ownedItemTypes = Object.keys(badgeGroups)
    const unearnedItemTypes = allItemTypes.filter(itemType => !ownedItemTypes.includes(itemType))

    // Calculate badge statistics for each item type and tier
    const badgeStats = Object.entries(badgeGroups).map(([itemType, badges]) => {
        const bronzeBadges = badges.filter(b => b.tier === 'bronze')
        const silverBadges = badges.filter(b => b.tier === 'silver')
        const goldBadges = badges.filter(b => b.tier === 'gold')

        const bronzeAchieved = bronzeBadges.filter(b => b.achieved).length
        const silverAchieved = silverBadges.filter(b => b.achieved).length
        const goldAchieved = goldBadges.filter(b => b.achieved).length

        return {
            itemType,
            displayName: itemTypeDisplayNames[itemType] || itemType,
            emoji: itemTypeEmojis[itemType] || "🏷️",
            bronze: { achieved: bronzeAchieved, total: bronzeBadges.length },
            silver: { achieved: silverAchieved, total: silverBadges.length },
            gold: { achieved: goldAchieved, total: goldBadges.length }
        }
    })

    if (badgeStats.length === 0) return null

    return (
        <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Badge Progress Overview</h2>
                <div className="relative">
                    <InfoIcon
                        className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-pointer"
                        onClick={() => setIsTooltipModalOpen(true)}
                    />
                </div>
            </div>
            {/* Horizontal scrollable container */}
            <div className="overflow-x-auto pb-4">
                <div className="flex space-x-4 min-w-max">
                    {badgeStats.map(({ itemType, displayName, emoji, bronze, silver, gold }) => (
                        <div key={itemType} className="flex-shrink-0 bg-white dark:bg-gray-900 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700 min-w-[200px]">
                            {/* Item type header */}
                            <div className="flex items-center mb-3">
                                <span className="text-2xl mr-2">{emoji}</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{displayName}</span>
                            </div>

                            {/* Badge tier progress */}
                            <div className="space-y-2">
                                {/* Bronze badges */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="w-3 h-3 rounded-full border-2 border-[#cd7f32] mr-2"></div>
                                        <span className="text-xs text-gray-600 dark:text-gray-400">Bronze</span>
                                    </div>
                                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                        {bronze.achieved}/{bronze.total}
                                    </span>
                                </div>

                                {/* Silver badges */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="w-3 h-3 rounded-full border-2 border-[#c0c0c0] mr-2"></div>
                                        <span className="text-xs text-gray-600 dark:text-gray-400">Silver</span>
                                    </div>
                                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                        {silver.achieved}/{silver.total}
                                    </span>
                                </div>

                                {/* Gold badges */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="w-3 h-3 rounded-full border-2 border-[#ffd700] mr-2"></div>
                                        <span className="text-xs text-gray-600 dark:text-gray-400">Gold</span>
                                    </div>
                                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                        {gold.achieved}/{gold.total}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tooltip Modal */}
            {isTooltipModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Badge Progress Information</h3>
                            <button
                                onClick={() => setIsTooltipModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Explanation */}
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            The Badge Progress Overview only shows item types where you have donated or sold at least one item.
                            Below are all the item types where you haven't donated or sold any items yet - donate or sell items of these types to start earning badges!
                        </p>
                        {/* Unearned Badges Grid */}
                        {unearnedItemTypes.length > 0 && (
                            <div>
                                <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">Available Badge Categories</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {unearnedItemTypes.map((itemType) => (
                                        <div key={itemType} className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                                            <span className="text-2xl mr-3">{itemTypeEmojis[itemType] || "🏷️"}</span>
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium block">
                                                    {itemTypeDisplayNames[itemType]}
                                                </span>
                                                <div className="flex space-x-1 mt-1">
                                                    {/* Show mini badge tier indicators */}
                                                    <div className="w-2 h-2 rounded-full border border-[#cd7f32] opacity-70"></div>
                                                    <div className="w-2 h-2 rounded-full border border-[#c0c0c0] opacity-70"></div>
                                                    <div className="w-2 h-2 rounded-full border border-[#ffd700] opacity-70"></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {unearnedItemTypes.length === 0 && (
                            <div className="text-center py-8">
                                <span className="text-4xl mb-2 block">🎉</span>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Congratulations! You have donated items in all available categories and can earn all badge types.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

// Shared grid component for badges
const BadgeGrid = ({ itemType, badges }: { itemType: string; badges: Badge[] }) => (
    <div className="mb-12">
        {/* Item type header on the left */}
        <div className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">
            {itemTypeDisplayNames[itemType] || itemType}
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
    // const { authenticatedFetch } = useAuthenticatedFetch() // CSRF approach - commented out
    const { getToken } = useAuth() // JWT approach - get token from Clerk
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
                // Test JWT authentication first
                //const jwtTest = await testClerkJWT(getToken)
                //console.log('GaveBadges JWT Test Result:', jwtTest)

                // JWT approach - using fetchDonatedBadgesJWT
                const { data, error: apiError } = await fetchDonatedBadgesJWT(getToken)

                // CSRF approach (commented out)
                // const response = await authenticatedFetch(`/api/badges/donated`)
                // if (!response.ok) {
                //     throw new Error(`HTTP error! status: ${response.status}`)
                // }
                // const data: BadgeGroups = await response.json()

                if (apiError) {
                    throw new Error(apiError)
                }

                setBadgeGroups(data || {})
            } catch (err) {
                console.error("Failed to fetch gave badges:", err)
                setError("Failed to load gave badges.")
            } finally {
                setLoading(false)
            }
        }

        fetchGaveBadges()
    }, [getToken, isLoaded, isSignedIn]) // Updated dependencies for JWT approach

    return (
        <div className="container mx-auto py-8 px-4">
            <SignedOut>
                <AuthMessage />
            </SignedOut>
            <SignedIn>
                {/* Page header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Gave Badges</h1>
                    <p className="text-gray-600 dark:text-gray-400">Track your progress for items you've donated or sold</p>
                </div>

                {/* Badge Summary - show overview of all badge progress */}
                {!loading && !error && Object.keys(badgeGroups).length > 0 && (
                    <BadgeSummary badgeGroups={badgeGroups} />
                )}

                {loading && <p className="text-center text-gray-500 dark:text-gray-400">Loading gave badges...</p>}
                {error && (
                    <p className="text-center text-red-500 dark:text-red-400">Error</p>
                )}
                {process.env.NEXT_PUBLIC_DEBUG === 'true' && error && (
                    <p className="text-center text-red-500 dark:text-red-400">Error: {error}</p>
                )}
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
