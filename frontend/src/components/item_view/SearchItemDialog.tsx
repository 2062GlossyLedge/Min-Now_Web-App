'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { searchLocations } from '@/utils/api'
import { LocationSearchResult } from '@/types/location'
import { toast } from 'sonner'

interface SearchItemDialogProps {
    onClose: () => void
}

export default function SearchItemDialog({ onClose }: SearchItemDialogProps) {
    const { getToken } = useAuth()
    const [activeTab, setActiveTab] = useState<'manual' | 'quick'>('manual')
    const [manualSearchQuery, setManualSearchQuery] = useState('')
    const [quickSearchQuery, setQuickSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set())

    // Disable body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [])

    // Handle manual search
    useEffect(() => {
        const searchTimer = setTimeout(async () => {
            if (manualSearchQuery.trim().length >= 2) {
                setIsSearching(true)
                try {
                    const { data, error } = await searchLocations(manualSearchQuery, getToken)
                    if (error) {
                        console.error('Search error:', error)
                        toast.error('Failed to search locations')
                        setSearchResults([])
                    } else if (data) {
                        setSearchResults(data)
                    }
                } catch (error) {
                    console.error('Search exception:', error)
                    setSearchResults([])
                } finally {
                    setIsSearching(false)
                }
            } else {
                setSearchResults([])
            }
        }, 300) // Debounce search

        return () => clearTimeout(searchTimer)
    }, [manualSearchQuery, getToken])

    const toggleLocation = (locationId: string) => {
        const newExpanded = new Set(expandedLocations)
        if (newExpanded.has(locationId)) {
            newExpanded.delete(locationId)
        } else {
            newExpanded.add(locationId)
        }
        setExpandedLocations(newExpanded)
    }

    const handleQuickSearch = () => {
        toast.info('Quick search coming soon!', {
            description: 'AI-powered search will be available in a future update'
        })
    }

    const renderLocationTree = () => {
        if (isSearching) {
            return (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto"></div>
                    <p className="mt-2 text-sm">Searching...</p>
                </div>
            )
        }

        if (manualSearchQuery.trim().length < 2) {
            return (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">
                    Type at least 2 characters to search for items and locations
                </div>
            )
        }

        if (searchResults.length === 0) {
            return (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">
                    No locations or items found matching "{manualSearchQuery}"
                </div>
            )
        }

        return (
            <div className="space-y-2">
                {searchResults.map((location) => {
                    const isExpanded = expandedLocations.has(location.id)
                    const hasItems = location.item_count > 0

                    return (
                        <div key={location.id} className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                            <div
                                className="flex items-start justify-between cursor-pointer"
                                onClick={() => hasItems && toggleLocation(location.id)}
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">📁</span>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {location.display_name}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {location.full_path}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {hasItems && (
                                        <span className="text-xs bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 px-2 py-1 rounded">
                                            {location.item_count} {location.item_count === 1 ? 'item' : 'items'}
                                        </span>
                                    )}
                                    {hasItems && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                toggleLocation(location.id)
                                            }}
                                            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Items list - only show when expanded */}
                            {isExpanded && hasItems && (
                                <div className="mt-3 ml-7 space-y-1">
                                    {location.item_names.map((itemName, idx) => (
                                        <div
                                            key={idx}
                                            className="text-sm text-teal-600 dark:text-teal-400 py-1 px-2 bg-white dark:bg-gray-800 rounded"
                                        >
                                            • {itemName}
                                        </div>
                                    ))}
                                    {location.item_count > 10 && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 italic py-1 px-2">
                                            + {location.item_count - 10} more items
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Search for Items</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                    <button
                        onClick={() => setActiveTab('manual')}
                        className={`px-4 py-2 font-medium transition-colors ${activeTab === 'manual'
                                ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        Manual Search
                    </button>
                    <button
                        onClick={() => setActiveTab('quick')}
                        className={`px-4 py-2 font-medium transition-colors ${activeTab === 'quick'
                                ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        Quick Search
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'manual' ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search for item name or location..."
                                    value={manualSearchQuery}
                                    onChange={(e) => setManualSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
                                />
                            </div>
                            <div className="relative group">
                                <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </button>
                                <div className="absolute right-0 top-full mt-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-10">
                                    Search for items by name or location path. Results show locations containing matching items.
                                </div>
                            </div>
                        </div>

                        {/* Search Results */}
                        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto">
                            {renderLocationTree()}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Ask a natural question..."
                                    value={quickSearchQuery}
                                    onChange={(e) => setQuickSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
                                />
                            </div>
                            <div className="relative group">
                                <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </button>
                                <div className="absolute right-0 top-full mt-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-10">
                                    Exact item names are not required. Ask natural questions to find the location of items.
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleQuickSearch}
                            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                        >
                            Search
                        </button>

                        {/* Placeholder info */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                <strong>Coming Soon:</strong> AI-powered quick search will help you find items using natural language queries like "where is my vacuum?" or "find my winter clothes".
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
