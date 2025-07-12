'use client'

import { useState, useEffect } from 'react'
import ItemCard from '../../components/ItemCard'
import FilterBar from '../../components/FilterBar'
import CheckupManager from '../../components/CheckupManager'
import AuthMessage from '../../components/AuthMessage'
import { updateItem, deleteItem, fetchItemsByStatus, createHandleEdit } from '@/utils/api'
import { Item } from '@/types/item'
import { useCheckupStatus } from '@/hooks/useCheckupStatus'
import { SignedIn } from '@clerk/nextjs'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'

export default function GiveView() {
    const [items, setItems] = useState<Item[]>([])
    const [loading, setLoading] = useState(true)
    const [showCheckupManager, setShowCheckupManager] = useState(false)
    const [selectedType, setSelectedType] = useState<string | null>(null)
    const [showFilters, setShowFilters] = useState(false)
    const isCheckupDue = useCheckupStatus('give')
    const { authenticatedFetch } = useAuthenticatedFetch()

    useEffect(() => {
        const fetchItems = async () => {
            try {
                const { data, error } = await fetchItemsByStatus('Give', authenticatedFetch)
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
            if (updatedItem.status !== 'Give') {
                setItems(items.filter((item) => item.id !== id))
            }
        }
    }

    const handleFilterChange = (type: string | null) => {
        setSelectedType(type)
    }

    // Use shared handleEdit function to eliminate code duplication
    const handleEdit = createHandleEdit('Give', setItems, authenticatedFetch)

    const handleDelete = async (id: string) => {
        const { error } = await deleteItem(id, authenticatedFetch)

        if (error) {
            console.error(error)
            return
        }

        setItems(items.filter((item) => item.id !== id))
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
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Give Items</h1>
                <SignedIn>
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

            <AuthMessage />

            <SignedIn>
                {showFilters && (
                    <FilterBar
                        selectedType={selectedType}
                        onTypeChange={handleFilterChange}
                    />
                )}

                {filteredItems.length === 0 ? (
                    <p className="text-gray-500">No items to give at the moment.</p>
                ) : (
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
                            />
                        ))}
                    </div>
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