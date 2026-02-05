'use client'

import { useState, useEffect } from 'react'
import ItemCard from '../../components/item_view/ItemCard'
import AuthMessage from '../../components/landing/AuthMessage'
// CSRF-based API imports (commented out - using JWT approach)
// import { updateItem, deleteItem, fetchItemsByStatus, createHandleEdit } from '@/utils/api'

// JWT-based API imports (new approach)
import { updateItemJWT, deleteItemJWT, fetchItemsByStatusJWT, createHandleEditJWT, testClerkJWT } from '@/utils/api'
import { Item } from '@/types/item'
import { SignedIn, SignedOut, useUser, useAuth } from '@clerk/nextjs'
// import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch' // Not needed for JWT approach
import { useRouter } from 'next/navigation'
import { useItemUpdate } from '@/contexts/ItemUpdateContext'

export default function DonatedView() {
    const [items, setItems] = useState<Item[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    // const { authenticatedFetch } = useAuthenticatedFetch() // CSRF approach - commented out
    const { getToken } = useAuth() // JWT approach - get token from Clerk
    const { refreshTrigger, clearUpdatedItems } = useItemUpdate()
    const { isSignedIn, isLoaded } = useUser() // Get user authentication status
    const router = useRouter()
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
                //const jwtTest = await testClerkJWT(getToken)
                //console.log('JWT Test Result:', jwtTest)

                // JWT approach - using fetchItemsByStatusJWT
                const { data, error } = await fetchItemsByStatusJWT('Donate', getToken)

                // CSRF approach (commented out)
                // const { data, error } = await fetchItemsByStatus('Donate', authenticatedFetch)

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
            if (updatedItem.status !== 'Donate') {
                setItems(items.filter((item) => item.id !== id))
            }
        }
    }

    // JWT approach - using createHandleEditJWT
    const handleEdit = createHandleEditJWT('Donate', setItems, getToken)

    // CSRF approach (commented out)
    // const handleEdit = createHandleEdit('Donate', setItems, authenticatedFetch)

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

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <SignedIn>
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Items Given</h1>
                    <div className="flex space-x-2">
                        {/* Gave Badges Button */}
                        <button
                            onClick={() => router.push('/gave-badges')}
                            className="p-2 text-gray-900 dark:text-white hover:text-teal-500 dark:hover:text-teal-400 transition-colors"
                            title="View Gave Badges"
                        >
                            {/* Badge Icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                        </button>
                    </div>
                </div>



                {loading && <p className="text-center text-gray-500 dark:text-gray-400">Loading items...</p>}
                {error && (
                    <p className="text-center text-red-500 dark:text-red-400">Error</p>
                )}
                {process.env.NEXT_PUBLIC_DEBUG === 'true' && error && (
                    <p className="text-center text-red-500 dark:text-red-400">Error: {error}</p>
                )}


                {!loading && !error && items.length === 0 ? (
                    <p className="text-gray-500">No Given items at the moment.</p>
                ) : (
                    !loading && !error && (
                        <div className="space-y-4">
                            {items.map((item) => (
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
            </SignedIn>

            <SignedOut>
                <AuthMessage />
            </SignedOut>
        </div>
    )
} 