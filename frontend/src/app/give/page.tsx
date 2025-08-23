'use client'

import { useState, useEffect } from 'react'
import ItemCard from '../../components/ItemCard'
import FilterBar from '../../components/FilterBar'
import CheckupManager from '../../components/CheckupManager'
import AuthMessage from '../../components/AuthMessage'
// CSRF-based API imports (commented out - using JWT approach)
// import { updateItem, deleteItem, fetchItemsByStatus, createHandleEdit } from '@/utils/api'

// JWT-based API imports (new approach)
import { updateItemJWT, deleteItemJWT, fetchItemsByStatusJWT, createHandleEditJWT, testClerkJWT } from '@/utils/api'
import { Item } from '@/types/item'
import { useCheckupStatus } from '@/hooks/useCheckupStatus'
import { SignedIn, SignedOut, useUser, useAuth } from '@clerk/nextjs'
// import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch' // Not needed for JWT approach
import { useItemUpdate } from '@/contexts/ItemUpdateContext'

export default function GiveView() {
    const [items, setItems] = useState<Item[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showCheckupManager, setShowCheckupManager] = useState(false)
    const [selectedType, setSelectedType] = useState<string | null>(null)
    const [showFilters, setShowFilters] = useState(false)
    const isCheckupDue = useCheckupStatus('give')
    // const { authenticatedFetch } = useAuthenticatedFetch() // CSRF approach - commented out
    const { getToken } = useAuth() // JWT approach - get token from Clerk
    const { refreshTrigger, clearUpdatedItems } = useItemUpdate()
    const { isSignedIn, isLoaded } = useUser() // Get user authentication status
    const [deletingItemId, setDeletingItemId] = useState<string | null>(null) // Track which item is being deleted

    // Separate effect to handle authentication state changes
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            setLoading(false)
            setItems([])
            setError(null)
        }
    }, [isLoaded, isSignedIn])

    useEffect(() => {
        const fetchItems = async () => {
            // Only fetch items if user is signed in and Clerk has loaded
            if (!isLoaded || !isSignedIn) {
                setLoading(false)
                return
            }

            setLoading(true)
            setError(null)
            try {
                // Test JWT authentication first
                const jwtTest = await testClerkJWT(getToken)
                console.log('JWT Test Result:', jwtTest)

                // JWT approach - using fetchItemsByStatusJWT
                const { data, error } = await fetchItemsByStatusJWT('Give', getToken)

                // CSRF approach (commented out)
                // const { data, error } = await fetchItemsByStatus('Give', authenticatedFetch)

                if (error) {
                    console.error(error)
                    setError(error)
                    setItems([])
                } else {
                    setItems(data || [])
                }
            } catch (error) {
                console.error('Error fetching items:', error)
                setError('Failed to load items.')
                setItems([])
            } finally {
                setLoading(false)
            }
        }

        fetchItems()

        // Clear updated items after refresh
        if (refreshTrigger > 0) {
            clearUpdatedItems()
        }
    }, [getToken, refreshTrigger, isLoaded, isSignedIn]) // Updated dependencies for JWT approach

    const handleStatusChange = async (id: string, newStatus: string) => {
        // JWT approach - using updateItemJWT
        const { data: updatedItem, error } = await updateItemJWT(id, { status: newStatus }, getToken)

        // CSRF approach (commented out)
        // const { data: updatedItem, error } = await updateItem(id, { status: newStatus }, authenticatedFetch)

        if (error) {
            console.error(error)
            return
        }

        if (updatedItem) {
            // Remove the item from the current view if its status has changed
            if (updatedItem.status !== 'Give') {
                setItems(items.filter((item) => item.id !== id))
            }
        }
    }

    const handleFilterChange = (type: string | null) => {
        setSelectedType(type)
    }

    // JWT approach - using createHandleEditJWT
    const handleEdit = createHandleEditJWT('Give', setItems, getToken)

    // CSRF approach (commented out)
    // const handleEdit = createHandleEdit('Give', setItems, authenticatedFetch)

    const handleDelete = async (id: string) => {
        setDeletingItemId(id) // Set which item is being deleted
        try {
            // JWT approach - using deleteItemJWT
            const { error } = await deleteItemJWT(id, getToken)

            // CSRF approach (commented out)
            // const { error } = await deleteItem(id, authenticatedFetch)

            if (error) {
                console.error(error)
                return
            }

            setItems(items.filter((item) => item.id !== id))
        } catch (error) {
            console.error('Error deleting item:', error)
        } finally {
            setDeletingItemId(null) // Clear loading state
        }
    }

    const filteredItems = selectedType
        ? items.filter((item) => item.itemType === selectedType)
        : items

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-6">
                <SignedIn>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Items to Give</h1>
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => setShowCheckupManager(true)}
                            className="p-2 text-gray-900 dark:text-white hover:text-teal-500 dark:hover:text-teal-400 transition-colors relative"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {isCheckupDue && (
                                <div className="absolute top-1.5 right-1.5 w-3 h-3 bg-red-500 rounded-full"></div>
                            )}
                        </button>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="p-2 text-gray-900 dark:text-white hover:text-teal-500 dark:hover:text-teal-400 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                        </button>
                    </div>
                </SignedIn>
            </div>

            <SignedOut>
                <AuthMessage />
            </SignedOut>

            <SignedIn>
                {showFilters && (
                    <FilterBar
                        selectedType={selectedType}
                        onTypeChange={handleFilterChange}
                    />
                )}

                {loading && <p className="text-center text-gray-500 dark:text-gray-400">Loading items...</p>}
                {error && (
                    <p className="text-center text-red-500 dark:text-red-400">Error</p>
                )}
                {process.env.NEXT_PUBLIC_DEBUG === 'true' && error && (
                    <p className="text-center text-red-500 dark:text-red-400">Error: {error}</p>
                )}

                {!loading && !error && filteredItems.length === 0 ? (
                    <p className="text-gray-500">No items to give at the moment.</p>
                ) : (
                    !loading && !error && (
                        <div className="space-y-4">
                            {filteredItems.map((item) => (
                                <ItemCard
                                    key={item.id}
                                    id={item.id}
                                    name={item.name}
                                    pictureUrl={item.pictureUrl}
                                    itemType={item.itemType}
                                    status={item.status}
                                    ownershipDuration={item.ownershipDuration}
                                    lastUsedDuration={item.lastUsedDuration}
                                    receivedDate={item.item_received_date}
                                    onStatusChange={handleStatusChange}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    isDeleting={deletingItemId === item.id}
                                    isAnyDeleting={deletingItemId !== null}
                                />
                            ))}
                        </div>
                    )
                )}

                {showCheckupManager && (
                    <CheckupManager
                        checkupType="Give"
                        onClose={() => setShowCheckupManager(false)}
                    />
                )}
            </SignedIn>
        </div>
    )
} 