'use client'

import { useState, useEffect } from 'react'
import ItemCard from '../../components/ItemCard'
import AddItemForm from '../../components/AddItemForm'
import FilterBar from '../../components/FilterBar'
import CheckupManager from '../../components/CheckupManager'
import AuthMessage from '../../components/AuthMessage'
// CSRF-based API imports (commented out - using JWT approach)
// import { updateItem, deleteItem, fetchItemsByStatus, createItem, sendTestCheckupEmail, agentAddItem, createHandleEdit } from '@/utils/api'

// JWT-based API imports (new approach) 
import { updateItemJWT, deleteItemJWT, fetchItemsByStatusJWT, createItemJWT, sendTestCheckupEmailJWT, agentAddItemJWT, createHandleEditJWT, testClerkJWT } from '@/utils/api'
import { Item } from '@/types/item'
import { useCheckupStatus } from '@/hooks/useCheckupStatus'
import { SignedIn, SignedOut, useUser, useAuth } from '@clerk/nextjs'
// import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch' // Not needed for JWT approach
import { useRouter } from 'next/navigation'
import { useItemUpdate } from '@/contexts/ItemUpdateContext'

export default function KeepView() {
    const [items, setItems] = useState<Item[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showAddForm, setShowAddForm] = useState(false)
    const [showCheckupManager, setShowCheckupManager] = useState(false)
    const [selectedType, setSelectedType] = useState<string | null>(null)
    const isCheckupDue = useCheckupStatus('keep')
    const [showFilters, setShowFilters] = useState(false)
    // const { authenticatedFetch } = useAuthenticatedFetch() // CSRF approach - commented out
    const { isSignedIn, isLoaded } = useUser() // Get user authentication status
    const { getToken } = useAuth() // JWT approach - get token from Clerk
    const router = useRouter()
    const [emailStatus, setEmailStatus] = useState<string | null>(null)
    const { refreshTrigger, clearUpdatedItems } = useItemUpdate()
    const [deletingItemId, setDeletingItemId] = useState<string | null>(null) // Track which item is being deleted

    // Separate effect to handle authentication state changes
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            setLoading(false)
            setItems([])
            setError(null)
        }
    }, [isLoaded, isSignedIn])

    // useEffect(() => {
    //     const fetchItems = async () => {
    //         // Only fetch items if user is signed in and Clerk has loaded
    //         if (!isLoaded || !isSignedIn) {
    //             setLoading(false)
    //             return
    //         }

    //         setLoading(true)
    //         setError(null)
    //         try {
    //             const { data, error } = await fetchItemsByStatus('Keep', authenticatedFetch)
    //             if (error) {
    //                 console.error(error)
    //                 setError(error)
    //                 setItems([])
    //             } else {
    //                 setItems(data || [])
    //             }
    //         } catch (error) {
    //             console.error('Error fetching items:', error)
    //             setError('Failed to load items.')
    //             setItems([])
    //         } finally {
    //             setLoading(false)
    //         }
    //     }

    //     fetchItems()

    //     // Clear updated items after refresh
    //     if (refreshTrigger > 0) {
    //         clearUpdatedItems()
    //     }
    // }, [authenticatedFetch, refreshTrigger, isLoaded, isSignedIn]) // Add authentication dependencies

    // ALTERNATIVE JWT AUTHENTICATION APPROACH (COMMENTED OUT FOR TESTING)
    // This approach uses Clerk's getToken() directly without CSRF tokens
    // 
    // TO USE THE NEW JWT APPROACH:
    // 1. Comment out the current useEffect above that uses fetchItemsByStatus
    // 2. Uncomment the useEffect below that uses fetchItemsByStatusJWT  
    // 3. The new approach fetches from /django-api/items instead of /api/items
    // 4. It uses JWT tokens from Clerk directly instead of CSRF tokens
    // 5. No additional authenticated fetch wrapper is needed

    useEffect(() => {
        const fetchItemsWithJWT = async () => {
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

                // Fetch items using JWT
                const { data, error } = await fetchItemsByStatusJWT('Keep', getToken)
                if (error) {
                    console.error('JWT Fetch Error:', error)
                    setError(error)
                    setItems([])
                } else {
                    console.log('JWT Fetch Success:', data)
                    // Map API response to frontend format
                    const mappedItems = (data || []).map((item: any) => ({
                        ...item,
                        // Map snake_case API fields to camelCase frontend fields
                        itemType: item.item_type || item.itemType,
                        pictureUrl: item.picture_url || item.pictureUrl,
                        ownershipDuration: item.ownership_duration?.description || item.ownershipDuration || 'Not specified',
                        lastUsedDuration: item.last_used_duration?.description || item.lastUsedDuration || 'N/A',
                        receivedDate: item.item_received_date || item.receivedDate,
                        ownershipDurationGoalMonths: item.ownership_duration_goal_months || item.ownershipDurationGoalMonths || 12,
                        ownershipDurationGoalProgress: item.ownership_duration_goal_progress || item.ownershipDurationGoalProgress || 0,
                    }))
                    setItems(mappedItems)
                }
            } catch (error) {
                console.error('Error fetching items with JWT:', error)
                setError('Failed to load items with JWT.')
                setItems([])
            } finally {
                setLoading(false)
            }
        }

        fetchItemsWithJWT()

        // Clear updated items after refresh
        if (refreshTrigger > 0) {
            clearUpdatedItems()
        }
    }, [getToken, refreshTrigger, isLoaded, isSignedIn])


    const handleStatusChange = async (id: string, newStatus: string) => {
        try {
            // JWT approach - using updateItemJWT
            const { error } = await updateItemJWT(id, { status: newStatus }, getToken)
            
            // CSRF approach (commented out)
            // const { error } = await updateItem(id, { status: newStatus }, authenticatedFetch)
            
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

    // JWT approach - using createHandleEditJWT
    const handleEdit = createHandleEditJWT('Keep', setItems, getToken)
    
    // CSRF approach (commented out)
    // const handleEdit = createHandleEdit('Keep', setItems, authenticatedFetch)

    const handleDelete = async (id: string) => {
        setDeletingItemId(id) // Set which item is being deleted
        try {
            // JWT approach - using deleteItemJWT
            const { error } = await deleteItemJWT(id, getToken)
            
            // CSRF approach (commented out)
            // const { error } = await deleteItem(id, authenticatedFetch)
            
            if (error) {
                console.error('Error deleting item:', error)
                return
            }
            setItems(items.filter(item => item.id !== id))
        } catch (error) {
            console.error('Error deleting item:', error)
        } finally {
            setDeletingItemId(null) // Clear loading state
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
            // JWT approach - using sendTestCheckupEmailJWT
            const result = await sendTestCheckupEmailJWT(getToken)
            
            // CSRF approach (commented out)
            // const result = await sendTestCheckupEmail(authenticatedFetch)
            
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
            
            // JWT approach - using agentAddItemJWT
            const result = await agentAddItemJWT(prompt, getToken)
            
            // CSRF approach (commented out)
            // const result = await agentAddItem(prompt, authenticatedFetch)
            
            if (result.data) {
                setEmailStatus('Item added successfully via AI agent!')
                
                // Refresh items list with JWT approach
                const { data, error } = await fetchItemsByStatusJWT('Keep', getToken)
                
                // CSRF approach (commented out)
                // const { data, error } = await fetchItemsByStatus('Keep', authenticatedFetch)
                
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
                        {/* Keep Badges Button */}
                        <button
                            onClick={() => router.push('/keep-badges')}
                            className="p-2 text-gray-900 dark:text-white hover:text-teal-500 dark:hover:text-teal-400 transition-colors"
                            title="View Keep Badges"
                        >
                            {/* Badge Icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                        </button>
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

                                            // JWT approach - using createItemJWT
                                            const { data, error } = await createItemJWT(testItem, getToken);
                                            
                                            // CSRF approach (commented out)
                                            // const { data, error } = await createItem(testItem, authenticatedFetch);
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

                {/* Add Item Form Modal */}
                {showAddForm && (
                    <AddItemForm
                        onClose={() => setShowAddForm(false)}
                        onItemAdded={handleAddItem}
                    />
                )}

                {!loading && !error && filteredItems.length === 0 && (
                    <p className="text-gray-500">No items to keep at the moment.</p>
                )}

                {!loading && !error && filteredItems.length > 0 && (
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
                                lastUsedDuration={item.lastUsedDuration || 'N/A'}
                                receivedDate={item.item_received_date}
                                ownershipDurationGoalMonths={item.ownership_duration_goal_months || item.ownershipDurationGoalMonths || 12}
                                ownershipDurationGoalProgress={item.ownership_duration_goal_progress || item.ownershipDurationGoalProgress || 0}
                                onStatusChange={handleStatusChange}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                isDeleting={deletingItemId === item.id}
                                isAnyDeleting={deletingItemId !== null}
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