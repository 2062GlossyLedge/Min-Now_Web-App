'use client'

import { useState, useEffect } from 'react'
import ItemCard from '../../components/ItemCard'
import AuthMessage from '../../components/AuthMessage'
import { updateItem, deleteItem, fetchItemsByStatus } from '@/utils/api'
import { Item } from '@/types/item'
import { SignedIn } from '@clerk/nextjs'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'

export default function DonatedView() {
    const [items, setItems] = useState<Item[]>([])
    const [loading, setLoading] = useState(true)
    const { authenticatedFetch } = useAuthenticatedFetch()

    useEffect(() => {
        const fetchItems = async () => {
            try {
                const { data, error } = await fetchItemsByStatus('Donate', authenticatedFetch)
                if (error) {
                    console.error(error)
                    setItems([])
                } else {
                    setItems(data || [])
                }
            } catch (error) {
                console.error('Error fetching items:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchItems()
    }, [authenticatedFetch])

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

    const handleEdit = async (id: string, updates: { name?: string, ownershipDate?: Date, lastUsedDate?: Date }) => {
        const { data: updatedItem, error } = await updateItem(id, updates, authenticatedFetch)

        if (error) {
            console.error(error)
            return
        }

        if (updatedItem) {
            // Update the item in place while maintaining the list order
            setItems(prevItems =>
                prevItems.map(item =>
                    item.id === id ? { ...item, ...updatedItem } : item
                )
            )
        }
    }

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
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Given Items</h1>
            </div>

            <AuthMessage />

            <SignedIn>
                {items.length === 0 ? (
                    <p className="text-gray-500">No Given items at the moment.</p>
                ) : (
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
                                onStatusChange={handleStatusChange}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}
            </SignedIn>
        </div>
    )
} 