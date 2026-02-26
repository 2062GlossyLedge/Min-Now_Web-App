'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { searchItems, fetchLocationTree, queryElasticsearchAgent } from '@/utils/api'
import { ItemSearchResult, ESAgentQueryResponse } from '@/types/item'
import { LocationTreeNode } from '@/types/location'
import { toast } from 'sonner'
import LocationTreePicker from '@/components/location/LocationTreePicker'
import LocationItemCard from '@/components/item_view/LocationItemCard'
import { buildExpandedSet, groupItemsByLocation, findNodeById } from '@/utils/treeHelpers'

// Streaming phases based on backend KIBANA_EVENT_MAPPING
const STREAMING_PHASES = [
    { emoji: '💭', text: 'Analyzing your question' },
    { emoji: '🔧', text: 'Searching inventory' },
    { emoji: '⏳', text: 'Processing' },
    { emoji: '📄', text: 'Forming Response' },
]

interface SearchItemDialogProps {
    onClose: () => void
}

export default function SearchItemDialog({ onClose }: SearchItemDialogProps) {
    const { getToken } = useAuth()
    const [activeTab, setActiveTab] = useState<'manual' | 'quick'>('manual')
    const [manualSearchQuery, setManualSearchQuery] = useState('')
    const [quickSearchQuery, setQuickSearchQuery] = useState('')
    const [itemSearchResults, setItemSearchResults] = useState<ItemSearchResult[]>([])
    const [locationTree, setLocationTree] = useState<LocationTreeNode[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [isLoadingTree, setIsLoadingTree] = useState(true)
    const [expandedLocationIds, setExpandedLocationIds] = useState<Set<string>>(new Set())
    const [highlightedLocationIds, setHighlightedLocationIds] = useState<Set<string>>(new Set())

    // Min Search (Elasticsearch Agent) state
    const [isQuerying, setIsQuerying] = useState(false)
    const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0)
    const [agentResponse, setAgentResponse] = useState<string | null>(null)
    const [agentError, setAgentError] = useState<string | null>(null)
    const [elapsedTimeMs, setElapsedTimeMs] = useState<number | null>(null)
    const phaseIntervalRef = useRef<NodeJS.Timeout | null>(null)

    // Disable body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [])

    // Load location tree on mount
    useEffect(() => {
        const loadTree = async () => {
            setIsLoadingTree(true)
            try {
                const { data, error } = await fetchLocationTree(getToken)
                if (error) {
                    console.error('Error fetching location tree:', error)
                    toast.error('Failed to load location tree')
                    setLocationTree([])
                } else if (data) {
                    setLocationTree(data)
                }
            } catch (error) {
                console.error('Error loading location tree:', error)
                setLocationTree([])
            } finally {
                setIsLoadingTree(false)
            }
        }

        loadTree()
    }, [getToken])

    // Handle manual search
    useEffect(() => {
        const searchTimer = setTimeout(async () => {
            if (manualSearchQuery.trim().length >= 2) {
                setIsSearching(true)
                try {
                    const { data, error } = await searchItems(manualSearchQuery, getToken)
                    if (error) {
                        console.error('Search error:', error)
                        toast.error('Failed to search items')
                        setItemSearchResults([])
                        setExpandedLocationIds(new Set())
                        setHighlightedLocationIds(new Set())
                    } else if (data) {
                        console.log('Search found items:', data)
                        setItemSearchResults(data)
                    }
                } catch (error) {
                    console.error('Search exception:', error)
                    setItemSearchResults([])
                    setExpandedLocationIds(new Set())
                    setHighlightedLocationIds(new Set())
                } finally {
                    setIsSearching(false)
                }
            } else {
                setItemSearchResults([])
                setExpandedLocationIds(new Set())
                setHighlightedLocationIds(new Set())
            }
        }, 300) // Debounce search

        return () => clearTimeout(searchTimer)
    }, [manualSearchQuery, getToken])

    // Update expanded/highlighted nodes when search results or location tree changes
    useEffect(() => {
        if (itemSearchResults.length > 0 && locationTree.length > 0) {
            // Extract unique location IDs from results
            const locationIds = [...new Set(
                itemSearchResults
                    .filter(item => item.currentLocationId)
                    .map(item => item.currentLocationId!)
            )]

            console.log('Processing search results:', {
                itemCount: itemSearchResults.length,
                locationIds,
                treeLoaded: locationTree.length > 0
            })

            // Build expanded set (includes all ancestors)
            const expanded = buildExpandedSet(locationIds, locationTree)
            console.log('Expanded node count:', expanded.size)
            setExpandedLocationIds(expanded)

            // Highlight only the locations that have items
            setHighlightedLocationIds(new Set(locationIds))
        } else if (itemSearchResults.length === 0) {
            setExpandedLocationIds(new Set())
            setHighlightedLocationIds(new Set())
        }
    }, [itemSearchResults, locationTree])

    // Cleanup phase interval on unmount
    useEffect(() => {
        return () => {
            if (phaseIntervalRef.current) {
                clearInterval(phaseIntervalRef.current)
            }
        }
    }, [])

    // Fake streaming: cycle through phases
    const startFakeStreaming = () => {
        setCurrentPhaseIndex(0)
        if (phaseIntervalRef.current) {
            clearInterval(phaseIntervalRef.current)
        }

        phaseIntervalRef.current = setInterval(() => {
            setCurrentPhaseIndex(prev => {
                if (prev < STREAMING_PHASES.length - 1) {
                    return prev + 1
                }
                return prev
            })
        }, 3000)
    }

    const stopFakeStreaming = () => {
        if (phaseIntervalRef.current) {
            clearInterval(phaseIntervalRef.current)
            phaseIntervalRef.current = null
        }
    }

    // Validate query for Min Search
    const validateQuery = (query: string): { isValid: boolean; error?: string } => {
        if (!query.trim()) {
            return { isValid: false, error: 'Please enter a search query' }
        }
        if (!/[a-zA-Z]/.test(query)) {
            return { isValid: false, error: 'Query must contain at least one letter' }
        }
        return { isValid: true }
    }

    const handleMinSearch = async () => {
        // Validate query
        const validation = validateQuery(quickSearchQuery)
        if (!validation.isValid) {
            toast.error(validation.error || 'Invalid query')
            return
        }

        // Clear previous results
        setAgentResponse(null)
        setAgentError(null)
        setElapsedTimeMs(null)

        // Start fake streaming and querying
        setIsQuerying(true)
        startFakeStreaming()

        try {
            const { data, error } = await queryElasticsearchAgent(quickSearchQuery, getToken)

            // Stop fake streaming
            stopFakeStreaming()
            setIsQuerying(false)

            if (error) {
                console.error('Agent query error:', error)
                setAgentError(error)
            } else if (data) {
                if (data.success && data.response?.message) {
                    setAgentResponse(data.response.message)
                    setElapsedTimeMs(data.elapsed_time_ms)
                } else if (data.error) {
                    setAgentError(data.error)
                } else {
                    setAgentError('No response from agent')
                }
            }
        } catch (error) {
            console.error('Agent query exception:', error)
            stopFakeStreaming()
            setIsQuerying(false)
            setAgentError('An unexpected error occurred')
        }
    }

    const handleQuickSearch = () => {
        handleMinSearch()
    }

    const handleDevFill = () => {
        setManualSearchQuery('acrid toy')
    }

    const handleMinSearchDevFill = () => {
        setQuickSearchQuery('where is my acrid toy?')
    }

    const renderSearchResults = () => {
        if (itemSearchResults.length === 0) {
            return null
        }

        // Group items by location
        const groupedItems = groupItemsByLocation(itemSearchResults)

        // Convert Map to array and sort by location path
        const sortedGroups = Array.from(groupedItems.entries())
            .map(([locationId, items]) => {
                const locationNode = findNodeById(locationTree, locationId)
                return {
                    locationId,
                    locationPath: locationNode?.full_path || 'Unknown location',
                    items
                }
            })
            .sort((a, b) => a.locationPath.localeCompare(b.locationPath))

        return (
            <div className="mt-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Found {itemSearchResults.length} {itemSearchResults.length === 1 ? 'item' : 'items'}
                    {' '}in {sortedGroups.length} {sortedGroups.length === 1 ? 'location' : 'locations'}
                </h3>
                {sortedGroups.map(({ locationId, locationPath, items }) => (
                    <LocationItemCard
                        key={locationId}
                        locationPath={locationPath}
                        items={items}
                    />
                ))}
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
                        Min Search
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'manual' ? (
                    <div className="space-y-4">
                        {/* Search Input with Dev Mode Badge */}
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Search for item name..."
                                value={manualSearchQuery}
                                onChange={(e) => setManualSearchQuery(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
                            />
                            {process.env.NEXT_PUBLIC_DEBUG === 'true' && (
                                <button
                                    onClick={handleDevFill}
                                    className="px-2 py-1 text-xs font-medium bg-purple-500 hover:bg-purple-600 text-white rounded transition-colors"
                                    title="Dev: Autofill search"
                                >
                                    Dev Fill
                                </button>
                            )}
                        </div>

                        {/* Location Tree */}
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                            <div className="mb-2">
                                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    Location Tree
                                </h3>
                                {isSearching && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Searching...
                                    </p>
                                )}
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                                {isLoadingTree ? (
                                    <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto"></div>
                                        <p className="mt-2 text-sm">Loading locations...</p>
                                    </div>
                                ) : (
                                    <LocationTreePicker
                                        selectedLocationId={null}
                                        onLocationSelect={() => { }}
                                        variant="compact"
                                        initialExpandedNodes={expandedLocationIds}
                                        highlightedNodes={highlightedLocationIds}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Search Results */}
                        {renderSearchResults()}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    placeholder="Ask a natural question..."
                                    value={quickSearchQuery}
                                    onChange={(e) => setQuickSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !isQuerying) {
                                            handleMinSearch()
                                        }
                                    }}
                                    disabled={isQuerying}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 disabled:opacity-50 disabled:cursor-not-allowed"
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
                            {process.env.NEXT_PUBLIC_DEBUG === 'true' && (
                                <>
                                    <button
                                        onClick={handleMinSearchDevFill}
                                        className="px-2 py-1 text-xs font-medium bg-purple-500 hover:bg-purple-600 text-white rounded transition-colors"
                                        title="Dev: Autofill search"
                                        disabled={isQuerying}
                                    >
                                        Dev Fill
                                    </button>
                                    {elapsedTimeMs !== null && (
                                        <button
                                            onClick={() => {
                                                const seconds = (elapsedTimeMs / 1000).toFixed(2)
                                                toast.info(`Elapsed time: ${seconds}s`)
                                            }}
                                            className="px-2 py-1 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                                            title="View elapsed time"
                                        >
                                            Show Time
                                        </button>
                                    )}
                                </>
                            )}
                        </div>

                        <button
                            onClick={handleQuickSearch}
                            disabled={isQuerying}
                            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isQuerying ? 'Searching...' : 'Search'}
                        </button>

                        {/* Fake Streaming Phase Display */}
                        {isQuerying && (
                            <div className="bg-gradient-to-r from-teal-50 to-blue-50 dark:from-teal-900/20 dark:to-blue-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4 transition-all duration-500 ease-in-out">
                                <div className="flex items-center gap-3 animate-pulse">
                                    <span className="text-3xl" role="img" aria-label="status">
                                        {STREAMING_PHASES[currentPhaseIndex].emoji}
                                    </span>
                                    <p className="text-sm font-medium text-teal-800 dark:text-teal-200">
                                        {STREAMING_PHASES[currentPhaseIndex].text}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Agent Response */}
                        {agentResponse && !isQuerying && (
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                                <div className="flex items-start gap-2">
                                    {/* <span className="text-xl" role="img" aria-label="success">✨</span> */}
                                    <div className="flex-1">
                                        {/* <h3 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">
                                            Agent Response
                                        </h3> */}
                                        <p className="text-m text-green-700 dark:text-green-300">
                                            {agentResponse}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Agent Error */}
                        {agentError && !isQuerying && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                                <div className="flex items-start gap-2">
                                    <span className="text-xl" role="img" aria-label="error">❌</span>
                                    <div className="flex-1">
                                        <h3 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
                                            Error
                                        </h3>
                                        <p className="text-sm text-red-700 dark:text-red-300">
                                            {agentError}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Initial state - no results yet */}
                        {!isQuerying && !agentResponse && !agentError && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                <p className="text-sm text-blue-800 dark:text-blue-200">
                                    <strong>Min Search:</strong> Ask natural language questions like "where is my vacuum?" or "find my winter clothes" to locate your items.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
