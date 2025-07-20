'use client'

import { useState, useEffect } from 'react'
import ItemCard from '../../components/ItemCard'
import AuthMessage from '../../components/AuthMessage'
import { updateItem, deleteItem, fetchItemsByStatus, createHandleEdit } from '@/utils/api'
import { Item } from '@/types/item'
import { SignedIn, SignedOut, useUser } from '@clerk/nextjs'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import { useItemUpdate } from '@/contexts/ItemUpdateContext'

export default function DonatedView() {
    const [items, setItems] = useState<Item[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const { authenticatedFetch } = useAuthenticatedFetch()
    const { refreshTrigger, clearUpdatedItems } = useItemUpdate()
    const { isSignedIn, isLoaded } = useUser() // Get user authentication status

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