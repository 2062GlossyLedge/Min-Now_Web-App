'use client'

import { useState, useEffect } from 'react'
import ItemCard from '../../components/ItemCard'
import AuthMessage from '../../components/AuthMessage'
import { updateItem, deleteItem, fetchItemsByStatus, createHandleEdit } from '@/utils/api'
import { Item } from '@/types/item'
import { SignedIn, SignedOut, useUser } from '@clerk/nextjs'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import { useRouter } from 'next/navigation'
import { useItemUpdate } from '@/contexts/ItemUpdateContext'

export default function DonatedView() {
    const [items, setItems] = useState<Item[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const { authenticatedFetch } = useAuthenticatedFetch()
    const { refreshTrigger, clearUpdatedItems } = useItemUpdate()
    const { isSignedIn, isLoaded } = useUser() // Get user authentication status
    const router = useRouter()

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
                const { data, error } = await fetchItemsByStatus('Donate', authenticatedFetch)
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
    }, [authenticatedFetch, refreshTrigger, isLoaded, isSignedIn]) // Add authentication dependencies

    const handleStatusChange = async (id: string, newStatus: string) => {
        const { data: updatedItem, error } = await updateItem(id, { status: newStatus }, authenticatedFetch)

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

    // Use shared handleEdit function to eliminate code duplication
    const handleEdit = createHandleEdit('Donate', setItems, authenticatedFetch)

    const handleDelete = async (id: string) => {
        const { error } = await deleteItem(id, authenticatedFetch)

        if (error) {
            console.error(error)
            return
        }

        setItems(items.filter((item) => item.id !== id))
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
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Given Items</h1>
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
                {error && <p className="text-center text-red-500 dark:text-red-400">Error: {error}</p>}

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