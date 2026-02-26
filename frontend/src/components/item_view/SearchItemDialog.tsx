'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { searchItems, fetchLocationTree } from '@/utils/api'
import { ItemSearchResult } from '@/types/item'
import { LocationTreeNode } from '@/types/location'
import { toast } from 'sonner'
import LocationTreePicker from '@/components/location/LocationTreePicker'
import LocationItemCard from '@/components/item_view/LocationItemCard'
import { buildExpandedSet, groupItemsByLocation, findNodeById } from '@/utils/treeHelpers'

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

    const handleQuickSearch = () => {
        toast.info('Quick search coming soon!', {
            description: 'AI-powered search will be available in a future update'
        })
    }

    const handleDevFill = () => {
        setManualSearchQuery('acrid toy')
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
