'use client'

import { useState, useEffect } from 'react'
import ItemCard from '../../components/ItemCard'
import AddItemForm from '../../components/AddItemForm'
import FilterBar from '../../components/FilterBar'
import CheckupManager from '../../components/CheckupManager'
import AuthMessage from '../../components/AuthMessage'
import { updateItem, deleteItem, fetchItemsByStatus, createItem, sendTestCheckupEmail, agentAddItem, createHandleEdit } from '@/utils/api'
import { Item } from '@/types/item'
import { useCheckupStatus } from '@/hooks/useCheckupStatus'
import { SignedIn } from '@clerk/nextjs'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import { useRouter } from 'next/navigation'
import { useItemUpdate } from '@/contexts/ItemUpdateContext'

export default function KeepView() {
    const [items, setItems] = useState<Item[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddForm, setShowAddForm] = useState(false)
    const [showCheckupManager, setShowCheckupManager] = useState(false)
    const [selectedType, setSelectedType] = useState<string | null>(null)
    const [csrfToken, setCsrfToken] = useState('')
    const isCheckupDue = useCheckupStatus('keep')
    const [showFilters, setShowFilters] = useState(false)
    const { authenticatedFetch } = useAuthenticatedFetch()
    const router = useRouter()
    const [emailStatus, setEmailStatus] = useState<string | null>(null)
    // State for add item menu/modal
    const [showAddMenu, setShowAddMenu] = useState(false)
    // State for AI add item modal
    const [showAIPrompt, setShowAIPrompt] = useState(false)
    const [aiPrompt, setAIPrompt] = useState('')
    const [aiLoading, setAILoading] = useState(false)
    const [aiError, setAIError] = useState<string | null>(null)
    const { refreshTrigger, clearUpdatedItems } = useItemUpdate()

    useEffect(() => {
        // duplicate code - see api.ts
        const fetchCsrfToken = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/csrf-token`, {
                    credentials: 'include',
                })
                if (response.ok) {
                    const data = await response.json()
                    setCsrfToken(data.token)
                }
            } catch (error) {
                console.error('Error fetching CSRF token:', error)
            }
        }

        fetchCsrfToken()
    }, [])

    useEffect(() => {
        const fetchItems = async () => {
            try {
                const { data, error } = await fetchItemsByStatus('Keep', authenticatedFetch)
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

        // Clear updated items after refresh
        if (refreshTrigger > 0) {
            clearUpdatedItems()
        }
    }, [authenticatedFetch, refreshTrigger]) // Add refreshTrigger as dependency

    const handleStatusChange = async (id: string, newStatus: string) => {
        try {
            const { error } = await updateItem(id, { status: newStatus }, authenticatedFetch)
            if (error) {
                console.error('Error updating item status:', error)
                return
            }
            setItems(items.map(item =>
                item.id === id ? { ...item, status: newStatus } : item
            ))
        } catch (error) {
            console.error('Error updating item status:', error)
        }
    }

    const handleFilterChange = (type: string | null) => {
        setSelectedType(type)
    }

    // Use shared handleEdit function to eliminate code duplication
    const handleEdit = createHandleEdit('Keep', setItems, authenticatedFetch)

    const handleDelete = async (id: string) => {
        try {
            const { error } = await deleteItem(id, authenticatedFetch)
            if (error) {
                console.error('Error deleting item:', error)
                return
            }
            setItems(items.filter(item => item.id !== id))
        } catch (error) {
            console.error('Error deleting item:', error)
        }
    }

    const handleAddItem = async (newItem: Item) => {
        // Map backend fields to frontend interface
        const mappedItem = {
            ...newItem,
            itemType: newItem.item_type || newItem.itemType,
            pictureUrl: newItem.picture_url || newItem.pictureUrl,
            ownershipDuration: newItem.ownership_duration?.description || 'Not specified'
        }
        setItems(prevItems => [...prevItems, mappedItem])
    }

    // Filter items based on selected type
    const filteredItems = selectedType
        ? items.filter((item) => item.itemType === selectedType)
        : items

    // Handler for sending test checkup email
    const handleSendTestEmail = async () => {
        setEmailStatus(null)
        try {
            const result = await sendTestCheckupEmail(authenticatedFetch)
            if (result.data) {
                setEmailStatus('Test checkup email sent successfully!')
            } else {
                setEmailStatus(result.error || 'Failed to send test checkup email')
            }
        } catch (error) {
            setEmailStatus('Failed to send test checkup email')
        }
    }

    // Handler for agent add item (dev only, magnifying glass)
    const handleAgentAddItem = async () => {
        setEmailStatus(null)
        try {
            const prompt = "Add a new item to keep: name 'Jacket', received Dec 2020, last used Dec 2024"
            const result = await agentAddItem(prompt, authenticatedFetch)
            if (result.data) {
                setEmailStatus('Item added successfully via AI agent!')
                const { data, error } = await fetchItemsByStatus('Keep', authenticatedFetch)
                if (!error && data) setItems(data)
            } else {
                setEmailStatus(result.error || 'Failed to add item via AI agent')
            }
        } catch (error) {
            setEmailStatus('Failed to add item via AI agent')
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
            <div className="flex justify-between items-center mb-6">
                <SignedIn>
                    <h1 className="text-2xl font-bold">Items to Keep</h1>
                    <div className="flex space-x-2">
                        {/* Checkup Manager Button */}
                        <button
                            onClick={() => setShowCheckupManager(true)}
                            className="p-2 text-gray-900 dark:text-white hover:text-teal-500 dark:hover:text-teal-400 transition-colors relative"
                        >
                            {/* Calendar Icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {isCheckupDue && (
                                <div className="absolute top-1.5 right-1.5 w-3 h-3 bg-red-500 rounded-full"></div>
                            )}
                        </button>
                        {/* Test Checkup Email Button (dev only) */}
                        {process.env.NEXT_PUBLIC_PROD_FE !== 'true' && (
                            <button
                                onClick={handleSendTestEmail}
                                className="p-2 text-gray-900 dark:text-white hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                                title="Send Test Checkup Email"
                            >
                                {/* Email Icon */}
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12l-4-4-4 4m8 0v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6m16-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v4" />
                                </svg>
                            </button>
                        )}
                        {emailStatus && (
                            <span className="ml-2 text-sm text-green-600 dark:text-green-400">{emailStatus}</span>
                        )}
                        {/* Filter Button */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="p-2 text-gray-900 dark:text-white hover:text-teal-500 dark:hover:text-teal-400 transition-colors"
                        >
                            {/* Filter Icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                        </button>
                        <div className="flex items-center space-x-2">
                            {/* Magnifying Glass Button (AI agent add, dev only) */}
                            {process.env.NEXT_PUBLIC_PROD_FE !== 'true' && (
                                <button
                                    onClick={handleAgentAddItem}
                                    className="p-2 text-gray-900 dark:text-white hover:text-purple-500 dark:hover:text-purple-400 transition-colors"
                                    title="Add Item with AI Agent (Dev Only)"
                                >
                                    {/* Magnifying Glass Icon */}
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </button>
                            )}
                            {/* Add Item Button (shows add item form directly) */}
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="p-2 text-gray-900 dark:text-white hover:text-teal-500 dark:hover:text-teal-400 transition-colors"
                                title="Add Item"
                            >
                                {/* Plus Icon */}
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                            {/* Test Item Button (dev only) */}
                            {process.env.NEXT_PUBLIC_PROD_FE !== 'true' && (
                                <button
                                    onClick={async () => {
                                        try {
                                            const testItem = {
                                                name: "Test Item",
                                                // Use static image from public directory
                                                picture_url: "/Min-NowDarkLogoCropped.jpg",
                                                item_type: "Technology",
                                                status: "Keep",
                                                item_received_date: new Date().toISOString(),
                                                last_used: new Date().toISOString()
                                            };
                                            console.log('Creating test item with data:', {
                                                ...testItem,
                                                item_received_date: new Date(testItem.item_received_date).toLocaleString(),
                                                last_used: new Date(testItem.last_used).toLocaleString()
                                            });

                                            const { data, error } = await createItem(testItem, authenticatedFetch);
                                            if (error) {
                                                console.error('Error creating test item:', error);
                                            } else {
                                                console.log('Test item created successfully:', {
                                                    response: data,
                                                    originalRequest: testItem
                                                });
                                                router.refresh();
                                            }
                                        } catch (error) {
                                            console.error('Error creating test item:', {
                                                error,
                                                message: error instanceof Error ? error.message : 'Unknown error',
                                                stack: error instanceof Error ? error.stack : undefined
                                            });
                                        }
                                    }}
                                    className="p-2 text-gray-900 dark:text-white hover:text-teal-500 dark:hover:text-teal-400 transition-colors"
                                    title="Create Test Item"
                                >
                                    {/* Test Item Icon */}
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                </button>
                            )}
                        </div>
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

                {/* Add Item Form Modal */}
                {showAddForm && (
                    <AddItemForm
                        onClose={() => setShowAddForm(false)}
                        onItemAdded={handleAddItem}
                    />
                )}

                {filteredItems.length === 0 ? (
                    <p className="text-gray-500">No items to keep at the moment.</p>
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
                        checkupType="Keep"
                        onClose={() => setShowCheckupManager(false)}
                    />
                )}
            </SignedIn>
        </div>
    )
} 