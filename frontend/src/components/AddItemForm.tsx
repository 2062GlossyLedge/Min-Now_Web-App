'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ImageIcon, SmileIcon, InfoIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
// CSRF-based API imports (commented out - using JWT approach)
// import { createItem } from '@/utils/api'
// import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'

// JWT-based API imports (new approach)
import { createItemJWT, fetchUserItemStatsJWT, validateImageFile, isIOS } from '@/utils/api'
import { useItemUpdate } from '@/contexts/ItemUpdateContext'
import { Item } from '@/types/item'
import Image from 'next/image'
import { UploadButton } from '@uploadthing/react'
import type { OurFileRouter } from '@/app/api/uploadthing/core'
import { twMerge } from 'tailwind-merge'
import "@uploadthing/react/styles.css";
import { useAuth, useUser } from '@clerk/nextjs'
import DatePickerComponent from '@/components/DatePickerComponent'
import { DatePickerState, calculateReceivedDate, isDateValid, initializeDatePickerState } from '@/utils/datePickerHelpers'
import { toast } from 'sonner'
import ItemReceivedDateSection from '@/components/ItemReceivedDateSection'
import OwnershipDurationGoalSection from '@/components/OwnershipDurationGoalSection'
import { usePostHog } from 'posthog-js/react'



interface AddItemFormProps {
    onClose: () => void
    onItemAdded: (newItem: Item) => void
}

export default function AddItemForm({ onClose, onItemAdded }: AddItemFormProps) {
    // const router = useRouter()
    const { triggerRefresh } = useItemUpdate()
    const [name, setName] = useState('')
    const [pictureEmoji, setPictureEmoji] = useState('')
    const [itemType, setItemType] = useState('Clothing & Accessories')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [useEmoji, setUseEmoji] = useState(true)
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    // const { authenticatedFetch } = useAuthenticatedFetch() // CSRF approach - commented out
    const { getToken } = useAuth() // JWT approach - get token from Clerk
    const { user } = useUser() // Get user data from Clerk to check admin status
    const [activeTab, setActiveTab] = useState<'manual' | 'quick'>('manual')
    const [showQuickAddForm, setShowQuickAddForm] = useState(false)
    const [quickItemName, setQuickItemName] = useState('')
    const [quickItemMonth, setQuickItemMonth] = useState('')
    const [quickItemYear, setQuickItemYear] = useState('')
    const [quickItemsToAdd, setQuickItemsToAdd] = useState<{
        name: string,
        trackingMode: 'received' | 'today',
        dateMode?: string,
        month?: string,
        year?: string,
        startYear?: string,
        endYear?: string,
        ownershipGoalMonths?: number
    }[]>([])
    const [quickFormLoading, setQuickFormLoading] = useState(false)
    const [quickFormError, setQuickFormError] = useState<string | null>(null)
    const [quickDateSelectionMode, setQuickDateSelectionMode] = useState<'monthYear' | 'year' | 'yearRange'>('monthYear')
    const [quickStartYear, setQuickStartYear] = useState('')
    const [quickEndYear, setQuickEndYear] = useState('')
    const [quickPromptsDict, setQuickPromptsDict] = useState<Record<string, string>>({})
    const [quickOwnershipGoalUnit, setQuickOwnershipGoalUnit] = useState<'months' | 'years'>('years')
    const [quickOwnershipGoalValue, setQuickOwnershipGoalValue] = useState<string>('1')
    const [quickShowOwnershipGoal, setQuickShowOwnershipGoal] = useState(false)
    const [quickShowDateTracking, setQuickShowDateTracking] = useState(false)
    const [ownershipGoalUnit, setOwnershipGoalUnit] = useState<'months' | 'years'>('years')
    const [ownershipGoalValue, setOwnershipGoalValue] = useState<string>('1')
    const [trackingMode, setTrackingMode] = useState<'received' | 'today'>('today')
    const [quickTrackingMode, setQuickTrackingMode] = useState<'received' | 'today'>('today')

    // Main date picker state for manual add
    const [datePickerState, setDatePickerState] = useState<DatePickerState>(() => ({
        ...initializeDatePickerState(new Date()),
        dateSelectionMode: 'full',
        selectedMonth: '',
        selectedYear: '',
        startYear: '',
        endYear: ''
    }))
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)

    // Legacy state variables for compatibility (will be removed)
    const [receivedDate, setReceivedDate] = useState<Date | undefined>(new Date())
    const [dateSelectionMode, setDateSelectionMode] = useState<'full' | 'monthYear' | 'year' | 'yearRange'>('full')
    const [selectedMonth, setSelectedMonth] = useState<string>('')
    const [selectedYear, setSelectedYear] = useState<string>('')
    const [startYear, setStartYear] = useState<string>('')
    const [endYear, setEndYear] = useState<string>('')
    const [manualAddError, setManualAddError] = useState<string | null>(null)
    const [quickBatchError, setQuickBatchError] = useState<string | null>(null)
    const [numOfKeysPressed, setNumOfKeysPressed] = useState<number>(1)

    // Item limit state
    const [itemStats, setItemStats] = useState<{
        current_count: number;
        max_items: number;
        remaining_slots: number;
        can_add_items: boolean;
    } | null>(null)
    const [itemStatsLoading, setItemStatsLoading] = useState(true)

    // Disable body scroll when modal is open
    useEffect(() => {
        // Add overflow hidden to body when component mounts
        document.body.style.overflow = 'hidden'

        // Cleanup function to restore scroll when component unmounts
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [])

    const itemTypes = [
        'Clothing & Accessories',
        'Technology',
        'Furniture & Appliances',
        'Books & Media',
        'Vehicles',
        'Personal Care Items',
        'Decor & Art',
        'Tools & Equipment',
        'Toys & Games',
        'Outdoor Gear',
        'Fitness Equipment',
        'Pet Supplies',
        'Subscriptions & Licenses',
        'Miscellaneous',
        'Other'
    ]

    // Map display names to database values to match backend ItemType choices
    const itemTypeToDbValue = (displayName: string): string => {
        const mapping: Record<string, string> = {
            'Clothing & Accessories': 'Clothing_Accessories',
            'Technology': 'Technology',
            'Furniture & Appliances': 'Furniture_Appliances',
            'Books & Media': 'Books_Media',
            'Vehicles': 'Vehicles',
            'Personal Care Items': 'Personal_Care_Items',
            'Decor & Art': 'Decor_Art',
            'Tools & Equipment': 'Tools_Equipment',
            'Toys & Games': 'Toys_Games',
            'Outdoor Gear': 'Outdoor_Gear',
            'Fitness Equipment': 'Fitness_Equipment',
            'Pet Supplies': 'Pet_Supplies',
            'Subscriptions & Licenses': 'Subscriptions_Licenses',
            'Miscellaneous': 'Miscellaneous',
            'Other': 'Other'
        }
        return mapping[displayName] || displayName
    }

    // Helper function to calculate received date based on selection mode
    const calculateReceivedDateFromLegacyState = (): Date | undefined => {
        switch (dateSelectionMode) {
            case 'full':
                return receivedDate
            case 'monthYear':
                if (selectedMonth && selectedYear) {
                    const monthIndex = months.indexOf(selectedMonth)
                    return new Date(parseInt(selectedYear), monthIndex, 1)
                }
                return undefined
            case 'year':
                if (selectedYear) {
                    return new Date(parseInt(selectedYear), 0, 1) // January 1st of the selected year
                }
                return undefined
            case 'yearRange':
                if (startYear && endYear) {
                    const start = parseInt(startYear)
                    const end = parseInt(endYear)
                    const middleYear = Math.floor((start + end) / 2)
                    return new Date(middleYear, 5, 15) // June 15th of the middle year
                }
                return undefined
            default:
                return receivedDate
        }
    }

    // Handle date picker state changes for manual add
    const handleDatePickerStateChange = (updates: Partial<DatePickerState>) => {
        const newState = { ...datePickerState, ...updates }
        setDatePickerState(newState)

        // Calculate and update the received date based on the current selection mode
        const calculatedDate = calculateReceivedDate(newState)
        setReceivedDate(calculatedDate)
    }

    // Helper function to check if date is valid based on selection mode
    const isDateValidLegacy = (): boolean => {
        switch (dateSelectionMode) {
            case 'full':
                return !!receivedDate
            case 'monthYear':
                return !!(selectedMonth && selectedYear)
            case 'year':
                return !!selectedYear
            case 'yearRange':
                return !!(startYear && endYear)
            default:
                return false
        }
    }

    // Helper function to check if quick add date is valid
    const isQuickDateValid = (): boolean => {
        if (quickTrackingMode === 'today') {
            return true // Always valid when tracking starts today
        }
        switch (quickDateSelectionMode) {
            case 'monthYear':
                return !!(quickItemMonth && quickItemYear)
            case 'year':
                return !!quickItemYear
            case 'yearRange':
                return !!(quickStartYear && quickEndYear)
            default:
                return false
        }
    }

    // Helper function to generate date string for quick add prompt
    const getQuickDateString = (): string => {
        if (quickTrackingMode === 'today') {
            return `today (${new Date().toLocaleDateString()})`
        }
        switch (quickDateSelectionMode) {
            case 'monthYear':
                return `${quickItemMonth} ${quickItemYear}`
            case 'year':
                return `January ${quickItemYear}`
            case 'yearRange':
                const start = parseInt(quickStartYear)
                const end = parseInt(quickEndYear)
                const middleYear = Math.floor((start + end) / 2)
                return `June ${middleYear}`
            default:
                return ''
        }
    }

    // Helper function to calculate total ownership duration in months
    const calculateOwnershipDurationMonths = (): number => {
        const numericValue = parseInt(ownershipGoalValue || '1', 10)
        const effectiveValue = Math.max(1, numericValue) // Ensure minimum of 1
        return ownershipGoalUnit === 'years' ? effectiveValue * 12 : effectiveValue
    }

    // Helper functions for quick add ownership goal
    const calculateQuickOwnershipDurationMonths = (): number => {
        const numericValue = parseInt(quickOwnershipGoalValue || '1', 10)
        const effectiveValue = Math.max(1, numericValue) // Ensure minimum of 1
        return quickOwnershipGoalUnit === 'years' ? effectiveValue * 12 : effectiveValue
    }

    // Fetch user item stats on component mount
    useEffect(() => {
        const fetchItemStats = async () => {
            setItemStatsLoading(true)
            try {
                const { data, error } = await fetchUserItemStatsJWT(getToken)
                if (error) {
                    console.error('Error fetching item stats:', error)
                } else if (data) {
                    setItemStats(data)
                }
            } catch (error) {
                console.error('Error fetching item stats:', error)
            } finally {
                setItemStatsLoading(false)
            }
        }

        fetchItemStats()
    }, [getToken])

    // Helper function to check if user is admin
    const isUserAdmin = (): boolean => {
        //console.log(user?.publicMetadata)
        return (user as any)?.publicMetadata?.['is-admin'] === true
    }

    // Helper function to check if user can add more items
    const canAddMoreItems = (additionalCount = 1): boolean => {
        // Admin users bypass item limits

        if (!itemStats) return true // Allow if stats not loaded yet
        if (additionalCount <= 0) {
            posthog?.capture('manual_add_limit', {
                item_count: itemStats.current_count,
                max_items: itemStats.max_items
            })
            return false
        }
        return itemStats.remaining_slots >= additionalCount
    }

    // Helper function to get remaining slots message with dynamic updates
    const getRemainingMessage = (): string => {
        // Admin users don't have limits
        if (isUserAdmin()) {
            return 'Admin user: No item limits enforced'
        }

        if (!itemStats) return ''

        // Calculate current items including those in the quick add list
        const itemsInQuickAdd = quickItemsToAdd.length
        const totalItemsAfterAdding = itemStats.current_count + itemsInQuickAdd
        const remainingSlots = itemStats.max_items - totalItemsAfterAdding

        if (remainingSlots <= 0) {
            return `You have reached the limit of ${itemStats.max_items} items. Delete items to add more. Wait for future updates to increase this limit.`
        }
        return `${totalItemsAfterAdding}/${itemStats.max_items} items added. ${remainingSlots} ${remainingSlots > 1 ? 'items' : 'item'} remaining`
    }

    // Helper function to check if user can add more items to the quick add list
    const canAddToQuickList = (): boolean => {
        // Admin users bypass item limits
        if (isUserAdmin()) return true
        if (!itemStats) return true // Allow if stats not loaded yet
        const itemsInQuickAdd = quickItemsToAdd.length
        const totalItemsAfterAdding = itemStats.current_count + itemsInQuickAdd + 1

        if (totalItemsAfterAdding === itemStats.max_items) {
            posthog?.capture('reached_item_limit', {
                item_count: totalItemsAfterAdding,
                max_items: itemStats.max_items
            })
        }
        return totalItemsAfterAdding <= itemStats.max_items
    }

    // Helper function to remove item from quick add list
    const removeQuickItem = (indexToRemove: number) => {
        setQuickItemsToAdd(prev => prev.filter((_, idx) => idx !== indexToRemove))
        setQuickPromptsDict(prev => {
            const newDict = { ...prev }
            delete newDict[indexToRemove]
            // Re-index the remaining items
            const reindexedDict: Record<string, string> = {}
            Object.entries(newDict).forEach(([key, value], newIndex) => {
                if (parseInt(key) > indexToRemove) {
                    reindexedDict[newIndex.toString()] = value
                } else {
                    reindexedDict[key] = value
                }
            })
            return reindexedDict
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setManualAddError(null) // Clear any previous errors
        setNumOfKeysPressed(0);

        // Check item limit before proceeding
        if (!canAddMoreItems(1)) {
            setManualAddError(getRemainingMessage())
            setIsSubmitting(false)
            return
        }

        let calculatedDate: Date
        if (trackingMode === 'today') {
            // Use today's date when tracking starts today or when date tracking is collapsed (default)
            calculatedDate = new Date()
        } else {
            // Use the date picker value when using received date
            const dateFromPicker = calculateReceivedDate(datePickerState)
            if (!dateFromPicker) {
                console.error('Received date is required')
                setManualAddError('Received date is required')
                setIsSubmitting(false)
                return
            }
            calculatedDate = dateFromPicker
        }
        if (!useEmoji && !uploadedImageUrl) {
            setManualAddError('Please select an emoji or upload an image')
            setIsSubmitting(false)
            return
        }

        // Show loading toast
        const loadingToastId = toast.loading('Adding item...', {
            description: 'Creating your new item',
        })

        try {
            const localDate = new Date(calculatedDate)
            localDate.setHours(0, 0, 0, 0)

            let pictureUrl = pictureEmoji
            if (!useEmoji && uploadedImageUrl) {
                pictureUrl = uploadedImageUrl
            }

            // const { data, error } = await createItem({ // CSRF approach - commented out
            const { data, error } = await createItemJWT({
                name,
                picture_url: pictureUrl,
                item_type: itemTypeToDbValue(itemType), // Convert display name to database value
                status: 'Keep',
                item_received_date: localDate.toISOString(),
                last_used: localDate.toISOString(),
                ownership_duration_goal_months: calculateOwnershipDurationMonths()
            }, getToken) // JWT approach - using getToken from Clerk

            if (error) {
                throw new Error(error)
            }

            if (data) {
                // Capture PostHog event for manual add
                posthog?.capture('item_added_manual', {
                    item_name: name,
                    item_type: itemTypeToDbValue(itemType),
                    tracking_mode: trackingMode,
                    date_selection_mode: trackingMode === 'received' ? datePickerState.dateSelectionMode : undefined,
                    ownership_goal_months: calculateOwnershipDurationMonths(),
                    picture_type: useEmoji ? 'emoji' : 'image',
                    user_id: user?.id
                })

                // Dismiss loading toast and show success toast
                toast.dismiss(loadingToastId)
                toast.success('Item added successfully!', {
                    description: `${name} has been added to your Keep items`,
                })

                // Refresh item stats after successful creation
                const { data: newStats } = await fetchUserItemStatsJWT(getToken)
                if (newStats) {
                    setItemStats(newStats)
                }
                onItemAdded(data)
                onClose()
            }
        } catch (error) {
            console.error('Error adding item:', error)
            // Dismiss loading toast and show error toast
            toast.dismiss(loadingToastId)
            toast.error('Failed to add item', {
                description: error instanceof Error ? error.message : 'An unexpected error occurred',
            })
            setManualAddError(error instanceof Error ? error.message : 'Failed to add item')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleQuickAddItem = async (e: React.FormEvent) => {
        e.preventDefault()
        setQuickFormError(null)
        if (!quickItemName || !isQuickDateValid()) {
            setQuickFormError('All fields are required.')
            return
        }

        // Check if user can add more items to the quick add list
        if (!canAddToQuickList()) {
            setQuickFormError('Cannot add more items. You have reached the limit.')
            return
        }

        setQuickFormLoading(true)
        try {
            const today = new Date()
            const dateString = getQuickDateString()

            // Compose prompt for agent_add_item with ownership goal if set
            let prompt = quickTrackingMode === 'today'
                ? `Add a new item to keep: name '${quickItemName}', start tracking today: ${today.toLocaleDateString()}`
                : `Add a new item to keep: name '${quickItemName}', received ${dateString}`
            // Append ownership goal if default was changed
            if (quickShowOwnershipGoal) {
                const ownershipGoalMonths = calculateQuickOwnershipDurationMonths()
                prompt += `, ownership goal: ${ownershipGoalMonths} months`
            }

            // Create new item object
            const newItem = {
                name: quickItemName,
                trackingMode: quickTrackingMode,
                // Only include date-related properties when tracking mode is 'received'
                ...(quickTrackingMode === 'received' && {
                    dateMode: quickDateSelectionMode,
                    ...(quickDateSelectionMode === 'monthYear' && { month: quickItemMonth, year: quickItemYear }),
                    ...(quickDateSelectionMode === 'year' && { year: quickItemYear }),
                    ...(quickDateSelectionMode === 'yearRange' && { startYear: quickStartYear, endYear: quickEndYear })
                }),
                ...(quickShowOwnershipGoal && { ownershipGoalMonths: calculateQuickOwnershipDurationMonths() })
            }

            // Add to quickItemsToAdd and quickPromptsDict (do not send to backend yet)
            setQuickItemsToAdd(prev => {
                const newArr = [...prev, newItem]
                setQuickPromptsDict(dict => ({ ...dict, [newArr.length - 1]: prompt }))
                return newArr
            })
            setShowQuickAddForm(false)
            setQuickItemName('')
            setQuickItemMonth('')
            setQuickItemYear('')
            setQuickStartYear('')
            setQuickEndYear('')
            // Reset tracking mode to default (today)
            setQuickTrackingMode('today')
            // Reset quick ownership goal states
            setQuickOwnershipGoalValue('1')
            setQuickOwnershipGoalUnit('years')
            setQuickShowOwnershipGoal(false)
            setQuickShowDateTracking(false)
        } catch (error) {
            setQuickFormError('Failed to add item via Quick Add')
        } finally {
            setQuickFormLoading(false)
        }
    }


    const handleSubmitAllQuickItems = async () => {
        if (Object.keys(quickPromptsDict).length === 0) {
            onClose()
            return
        }

        setQuickBatchError(null) // Clear any previous errors

        try {
            // const { agentAddItemsBatchWithHandlers } = await import('@/utils/api') // CSRF approach - commented out
            const { agentAddItemsBatchJWTWithHandlers } = await import('@/utils/api') // JWT approach
            await agentAddItemsBatchJWTWithHandlers(
                quickPromptsDict,
                getToken, // JWT approach - using getToken from Clerk
                {
                    onSuccess: async () => {
                        // Capture PostHog event for quick add batch
                        posthog?.capture('items_added_quick_batch', {
                            batch_size: quickItemsToAdd.length,
                            items: quickItemsToAdd.map(item => ({
                                name: item.name,
                                tracking_mode: item.trackingMode,
                                date_mode: item.dateMode,
                                ownership_goal_months: item.ownershipGoalMonths
                            })),
                            user_id: user?.id
                        })

                        // Refresh item stats after successful batch creation
                        const { data: newStats } = await fetchUserItemStatsJWT(getToken)
                        if (newStats) {
                            setItemStats(newStats)
                        }
                        triggerRefresh()
                        quickItemsToAdd.forEach((item) => {
                            onItemAdded({
                                name: item.name,
                                itemType: '',
                                pictureUrl: '',
                                status: 'Keep',
                                ownershipDuration: '',
                                lastUsedDuration: '',
                                id: Math.random().toString(), // temp id
                            } as any)
                        })
                        onClose()
                    },
                    onError: (error: string) => {
                        setQuickBatchError(error)
                    }
                }
            )
        } catch (error) {
            console.error('Error in quick add batch:', error)
            setQuickBatchError(error instanceof Error ? error.message : 'Failed to add items')
        }
    }

    // Month and year options
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ]
    const currentYear = new Date().getFullYear()
    const years = Array.from({ length: 201 }, (_, i) => `${currentYear - i}`)

    const posthog = usePostHog()
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-full max-w-sm max-h-[90vh] overflow-y-auto">
                <div className="flex mb-4">
                    <button
                        className={`px-4 py-2 rounded-tl-lg border-b-2 font-semibold focus:outline-none ${activeTab === 'manual' ? 'border-teal-500 text-teal-600 dark:text-teal-300' : 'border-transparent text-gray-500 dark:text-gray-400'}`}
                        onClick={() => {
                            setActiveTab('manual')
                            setManualAddError(null)
                            setQuickBatchError(null)
                        }}
                        type="button"
                    >
                        Manual Add
                    </button>
                    <button
                        className={`px-4 py-2 rounded-tr-lg border-b-2 font-semibold focus:outline-none ${activeTab === 'quick' ? 'border-purple-500 text-purple-600 dark:text-purple-300' : 'border-transparent text-gray-500 dark:text-gray-400'}`}
                        onClick={() => {
                            setActiveTab('quick')
                            setManualAddError(null)
                            setQuickBatchError(null)
                        }}
                        type="button"
                    >
                        Quick Add
                    </button>
                </div>

                {activeTab === 'manual' && (
                    <>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Add New Item</h2>

                        {/* Item Limit Status */}
                        {(!itemStatsLoading && itemStats) || isUserAdmin() ? (
                            <div className={`mb-4 p-3 rounded-lg border ${isUserAdmin() ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'}`}>
                                <p className={`text-sm ${isUserAdmin() ? 'text-green-800 dark:text-green-200' : 'text-blue-800 dark:text-blue-200'}`}>
                                    {getRemainingMessage()}
                                </p>
                            </div>
                        ) : null}

                        {/* Manual Add Error Display */}
                        {manualAddError && (
                            <p className="text-center text-red-500 dark:text-red-400 mb-4">Error</p>
                        )}
                        {process.env.NEXT_PUBLIC_DEBUG === 'true' && manualAddError && (
                            <p className="text-center text-red-500 dark:text-red-400 mb-4">Error: {manualAddError}</p>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Item Name</label>
                                <input
                                    type="text"
                                    value={name || ""}
                                    onChange={(e) => setName(e.target.value)}
                                    maxLength={25}
                                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    required
                                />
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {name ? name.length : 0}/25 characters
                                </p>
                            </div>
                            <div>
                                <div className="flex items-center space-x-4 mb-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setUseEmoji(true)
                                            setUploadedImageUrl(null)
                                        }}
                                        className={`flex items-center space-x-2 px-3 py-2 rounded-md ${useEmoji ? 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300' : 'bg-gray-100 dark:bg-gray-700'}`}
                                    >
                                        <SmileIcon className="h-5 w-5" />
                                        <span>Emoji</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setUseEmoji(false)
                                            setPictureEmoji('')
                                        }}
                                        className={`flex items-center space-x-2 px-3 py-2 rounded-md ${!useEmoji ? 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300' : 'bg-gray-100 dark:bg-gray-700'}`}
                                    >
                                        <ImageIcon className="h-5 w-5" />
                                        <span>Image</span>
                                    </button>
                                </div>
                                {useEmoji ? (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Item Emoji</label>
                                        <input
                                            type="text"
                                            value={pictureEmoji || ""}
                                            onChange={(e) => {
                                                const input = e.target.value;
                                                // Limit input to 50 characters
                                                if (input.length <= 50) {
                                                    setPictureEmoji(input);
                                                }
                                            }}
                                            maxLength={50}
                                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                            required={useEmoji}
                                            placeholder="Enter emoji(s)"
                                        />
                                        {/* <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            {pictureEmoji ? pictureEmoji.length : 0}/50 characters
                                        </p> */}
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Item Image</label>
                                        <div className="relative flex justify-start">
                                            <UploadButton<OurFileRouter, "imageUploader">
                                                className="mt-4 flex flex-row justify-start gap-3"
                                                endpoint="imageUploader"
                                                config={{ cn: twMerge }}
                                                onBeforeUploadBegin={(files) => {
                                                    // Validate each file before upload begins
                                                    for (const file of files) {
                                                        const validation = validateImageFile(file);
                                                        if (!validation.isValid) {
                                                            alert(`Upload failed: ${validation.errorMessage}`);
                                                            return []; // Return empty array to prevent upload
                                                        }
                                                    }
                                                    return files; // Return files to proceed with upload
                                                }}
                                                onClientUploadComplete={(res: any) => {
                                                    setUploadedImageUrl(res?.[0]?.ufsUrl ?? res?.[0]?.fileUrl ?? null)
                                                    setIsUploading(false)

                                                    // Log event to PostHog
                                                    posthog?.capture('image_uploaded', {
                                                        source: 'AddItemForm',
                                                        method: 'uploadthing',
                                                        fileType: res?.[0]?.fileType || 'unknown',
                                                        fileSize: res?.[0]?.fileSize || 0,
                                                    })

                                                }}
                                                onUploadError={(error: Error) => {
                                                    setIsUploading(false)
                                                    alert('Upload failed: ' + error.message)
                                                }}
                                                onUploadBegin={() => {
                                                    setIsUploading(true)
                                                }}
                                            />
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                            Supported formats: JPEG, PNG, GIF, WebP{isIOS() ? ', HEIC' : ''} (max 4MB)
                                        </p>
                                        {uploadedImageUrl && (
                                            <div className="mt-2 relative w-24 h-24">
                                                <Image
                                                    src={uploadedImageUrl}
                                                    alt="Preview"
                                                    fill
                                                    className="object-cover rounded-md"
                                                    sizes='240px'
                                                />
                                            </div>
                                        )}
                                        {isUploading && (
                                            <div className="mt-2 text-sm text-teal-600">Uploading...</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Item Type</label>
                                <select
                                    value={itemType}
                                    onChange={(e) => setItemType(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                                >
                                    {itemTypes.map((type) => (
                                        <option key={type} value={type} className="py-2">
                                            {type}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                {/* Date Tracking Content */}
                                <ItemReceivedDateSection
                                    trackingMode={trackingMode}
                                    onTrackingModeChange={setTrackingMode}
                                    dateSelectionMode="monthYear"
                                    onDateSelectionModeChange={() => { }}
                                    datePickerState={datePickerState}
                                    onDatePickerStateChange={handleDatePickerStateChange}
                                    isDatePickerOpen={isDatePickerOpen}
                                    onDatePickerOpenChange={setIsDatePickerOpen}
                                    receivedDate={receivedDate}
                                    onReceivedDateChange={setReceivedDate}
                                    variant="manual"
                                />
                            </div>
                            <div>
                                {/* Ownership Duration Goal Section */}
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Ownership Duration Goal
                                    </span>
                                    <div className="group relative">
                                        <InfoIcon className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-help" />
                                        <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none w-48 text-center z-50">
                                            How long you want to keep this item before it breaks, or you give/sell it away
                                            <div className="absolute left-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-l-gray-900 dark:border-l-gray-700"></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Ownership Goal Content */}
                                <OwnershipDurationGoalSection
                                    ownershipGoalValue={parseInt(ownershipGoalValue || '1', 10)}
                                    onOwnershipGoalValueChange={(value) => setOwnershipGoalValue(value.toString())}
                                    ownershipGoalUnit={ownershipGoalUnit}
                                    onOwnershipGoalUnitChange={setOwnershipGoalUnit}
                                    trackingMode={trackingMode}
                                    receivedDate={receivedDate}
                                    variant="manual"
                                    calculateOwnershipDurationMonths={calculateOwnershipDurationMonths}
                                />
                            </div>
                            <div className="flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !name || (useEmoji ? !pictureEmoji : !uploadedImageUrl) || (trackingMode === 'received' && !isDateValid(datePickerState)) || !canAddMoreItems(1)}
                                    className="px-4 py-2 text-sm font-medium text-white bg-teal-600 border border-transparent rounded-md hover:bg-teal-700 disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Adding...' : !canAddMoreItems(1) ? 'Limit Reached' : 'Add Item'}
                                </button>
                            </div>
                        </form>
                    </>
                )}

                {activeTab === 'quick' && (
                    <>
                        {/* Item Limit Status */}
                        {(!itemStatsLoading && itemStats) || isUserAdmin() ? (
                            <div className={`mb-4 p-3 rounded-lg border ${isUserAdmin() ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'}`}>
                                <p className={`text-sm ${isUserAdmin() ? 'text-green-800 dark:text-green-200' : 'text-blue-800 dark:text-blue-200'}`}>
                                    {getRemainingMessage()}
                                </p>
                            </div>
                        ) : null}

                        {/* Quick Add Error Display */}
                        {quickBatchError && (
                            <p className="text-center text-red-500 dark:text-red-400 mb-4">Error</p>
                        )}
                        {process.env.NEXT_PUBLIC_DEBUG === 'true' && quickBatchError && (
                            <p className="text-center text-red-500 dark:text-red-400 mb-4">Error: {quickBatchError}</p>
                        )}

                        {/* Quick Add Card */}
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg shadow p-4 mb-4">
                            {/* Quick Add Item Button */}
                            <button
                                className="mb-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition disabled:opacity-50"
                                onClick={() => {
                                    if (!showQuickAddForm) {
                                        // Reset to defaults when opening the form
                                        setQuickTrackingMode('today')

                                    }
                                    setShowQuickAddForm(v => !v)
                                }}
                                disabled={!showQuickAddForm && !canAddToQuickList()}
                                type="button"
                            >
                                {showQuickAddForm ? 'Cancel' : canAddToQuickList() ? 'Quick Add Item' : 'Limit Reached'}
                            </button>
                            {/* Quick Add Item Form */}
                            {showQuickAddForm && (
                                <form className="space-y-2 mb-4" onSubmit={handleQuickAddItem}>
                                    {/* Item Name Input */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Item Name</label>
                                        <input
                                            type="text"
                                            value={quickItemName}
                                            onChange={e => setQuickItemName(e.target.value)}
                                            maxLength={25}
                                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                            required
                                        />
                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            {quickItemName ? quickItemName.length : 0}/25 characters
                                        </p>
                                    </div>

                                    {/* Collapsible Item Received Date Header for Quick Add */}
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => setQuickShowDateTracking(!quickShowDateTracking)}
                                            className="flex items-center gap-2 mb-2 w-full text-left hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded-md transition-colors"
                                        >
                                            {quickShowDateTracking ? (
                                                <ChevronUpIcon className="h-4 w-4 text-gray-500" />
                                            ) : (
                                                <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                                            )}
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Item Received Date
                                            </span>
                                            <div className="group relative">
                                                <InfoIcon className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-help" />
                                                <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none w-48 text-center z-50">
                                                    Defaults to today. You can select the date when you received the item instead of using today's date
                                                    <div className="absolute left-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-l-gray-900 dark:border-l-gray-700"></div>
                                                </div>
                                            </div>
                                        </button>

                                        {/* Collapsible Date Tracking Content */}
                                        {quickShowDateTracking && (
                                            <div className="space-y-3 pl-6 mb-4">
                                                <ItemReceivedDateSection
                                                    trackingMode={quickTrackingMode}
                                                    onTrackingModeChange={setQuickTrackingMode}
                                                    dateSelectionMode={quickDateSelectionMode}
                                                    onDateSelectionModeChange={setQuickDateSelectionMode}
                                                    itemMonth={quickItemMonth}
                                                    onItemMonthChange={setQuickItemMonth}
                                                    itemYear={quickItemYear}
                                                    onItemYearChange={setQuickItemYear}
                                                    startYear={quickStartYear}
                                                    onStartYearChange={setQuickStartYear}
                                                    endYear={quickEndYear}
                                                    onEndYearChange={setQuickEndYear}
                                                    isDateValid={isQuickDateValid}
                                                    getDateString={getQuickDateString}
                                                    variant="quick"
                                                    months={months}
                                                    years={years}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Collapsible Ownership Duration Goal Header for Quick Add */}
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => setQuickShowOwnershipGoal(!quickShowOwnershipGoal)}
                                            className="flex items-center gap-2 mb-2 w-full text-left hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded-md transition-colors"
                                        >
                                            {quickShowOwnershipGoal ? (
                                                <ChevronUpIcon className="h-4 w-4 text-gray-500" />
                                            ) : (
                                                <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                                            )}
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Ownership Duration Goal
                                            </span>
                                            <div className="group relative">
                                                <InfoIcon className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-help" />
                                                <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none w-48 text-center z-50">
                                                    Defaults to 1 year. How long you want to keep this item before it breaks, or you give/sell it away
                                                    <div className="absolute left-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-l-gray-900 dark:border-l-gray-700"></div>
                                                </div>
                                            </div>
                                        </button>

                                        {/* Collapsible Ownership Goal Content */}
                                        {quickShowOwnershipGoal && (
                                            <div className="space-y-3 pl-6 mb-4">
                                                <OwnershipDurationGoalSection
                                                    ownershipGoalValue={parseInt(quickOwnershipGoalValue || '1', 10)}
                                                    onOwnershipGoalValueChange={(value) => setQuickOwnershipGoalValue(value.toString())}
                                                    ownershipGoalUnit={quickOwnershipGoalUnit}
                                                    onOwnershipGoalUnitChange={setQuickOwnershipGoalUnit}
                                                    trackingMode={quickTrackingMode}
                                                    variant="quick"
                                                    calculateOwnershipDurationMonths={calculateQuickOwnershipDurationMonths}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Error Message */}
                                    {quickFormError && <div className="text-red-600 text-sm">{quickFormError}</div>}
                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        className="w-full py-2 px-4 rounded bg-purple-600 text-white hover:bg-purple-700 transition disabled:opacity-50"
                                        disabled={quickFormLoading || !canAddToQuickList()}
                                    >
                                        {quickFormLoading ? 'Adding...' : canAddToQuickList() ? 'Add Item to Batch' : 'Limit Reached'}
                                    </button>
                                </form>
                            )}
                            {/* Item Batch List */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-lg font-semibold">Item Batch</h3>
                                    {itemStats && (
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                            {isUserAdmin() ?
                                                `${itemStats.current_count + quickItemsToAdd.length} items (Admin: No limit)` :
                                                `${itemStats.current_count + quickItemsToAdd.length}/${itemStats.max_items} items`
                                            }
                                        </span>
                                    )}
                                </div>
                                {quickItemsToAdd.length === 0 ? (
                                    <div className="text-gray-500 text-sm">
                                        {itemStats && !canAddToQuickList() ?
                                            `No items added yet.You have reached the limit of ${itemStats.max_items} items.` :
                                            'No items added yet.'
                                        }
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {quickItemsToAdd.map((item, idx) => {
                                            let dateDisplay = ''
                                            if (item.trackingMode === 'today') {
                                                dateDisplay = `Today (${new Date().toLocaleDateString()})`
                                            } else if (item.trackingMode === 'received') {
                                                if (item.dateMode === 'monthYear') {
                                                    dateDisplay = `${item.month} ${item.year}`
                                                } else if (item.dateMode === 'year') {
                                                    dateDisplay = `January ${item.year}`
                                                } else if (item.dateMode === 'yearRange') {
                                                    const start = parseInt(item.startYear || '0')
                                                    const end = parseInt(item.endYear || '0')
                                                    const middleYear = Math.floor((start + end) / 2)
                                                    dateDisplay = `June ${middleYear} (${item.startYear}-${item.endYear} range)`
                                                }
                                            }

                                            return (
                                                <div key={idx} className="bg-white dark:bg-gray-800 rounded shadow p-3 flex justify-between items-start">
                                                    <div className="flex-1">
                                                        {/* Card for each item */}
                                                        <div className="font-medium">{item.name}</div>
                                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                                            {item.trackingMode === 'today' ? 'Tracking starts:' : 'Received:'} {dateDisplay}
                                                        </div>
                                                        {item.ownershipGoalMonths && (
                                                            <div className="text-xs text-purple-600 dark:text-purple-400">
                                                                Goal: {item.ownershipGoalMonths} months ({item.ownershipGoalMonths >= 12 ? `${Math.floor(item.ownershipGoalMonths / 12)} year${Math.floor(item.ownershipGoalMonths / 12) > 1 ? 's' : ''}${item.ownershipGoalMonths % 12 > 0 ? ` ${item.ownershipGoalMonths % 12} month${item.ownershipGoalMonths % 12 > 1 ? 's' : ''}` : ''}` : `${item.ownershipGoalMonths} month${item.ownershipGoalMonths > 1 ? 's' : ''}`})
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => removeQuickItem(idx)}
                                                        className="ml-2 px-2 py-1 text-xs bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-600 dark:text-red-400 rounded"
                                                        type="button"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                            {/* Action Buttons */}
                            <div className="mt-4 flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    className={`px-4 py-2 text-sm font-medium rounded-md ${quickItemsToAdd.length > 0 ? 'bg-teal-600 hover:bg-teal-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                                    disabled={quickItemsToAdd.length === 0}
                                    onClick={handleSubmitAllQuickItems}
                                    type="button"
                                >
                                    {'Submit Item Batch'}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
} 