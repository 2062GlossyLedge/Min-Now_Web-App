'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ChevronDownIcon, ImageIcon, SmileIcon } from 'lucide-react'
// CSRF-based API imports (commented out - using JWT approach)
// import { createItem } from '@/utils/api'
// import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'

// JWT-based API imports (new approach)
import { createItemJWT, fetchUserItemStatsJWT } from '@/utils/api'
import { useItemUpdate } from '@/contexts/ItemUpdateContext'
import { Item } from '@/types/item'
import Image from 'next/image'
import { UploadButton } from '@uploadthing/react'
import type { OurFileRouter } from '@/app/api/uploadthing/core'
import { twMerge } from 'tailwind-merge'
import "@uploadthing/react/styles.css";
import { useAuth, useUser } from '@clerk/nextjs'



interface AddItemFormProps {
    onClose: () => void
    onItemAdded: (newItem: Item) => void
}

export default function AddItemForm({ onClose, onItemAdded }: AddItemFormProps) {
    const router = useRouter()
    const { triggerRefresh } = useItemUpdate()
    const [name, setName] = useState('')
    const [pictureEmoji, setPictureEmoji] = useState('')
    const [itemType, setItemType] = useState('Clothing & Accessories')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [receivedDate, setReceivedDate] = useState<Date | undefined>(new Date())
    const [useEmoji, setUseEmoji] = useState(true)
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    // const { authenticatedFetch } = useAuthenticatedFetch() // CSRF approach - commented out
    const { getToken } = useAuth() // JWT approach - get token from Clerk
    const { user } = useUser() // Get user data from Clerk to check admin status
    const [open, setOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'manual' | 'quick'>('manual')
    const [showQuickAddForm, setShowQuickAddForm] = useState(false)
    const [quickItemName, setQuickItemName] = useState('')
    const [quickItemMonth, setQuickItemMonth] = useState('')
    const [quickItemYear, setQuickItemYear] = useState('')
    const [quickItemsToAdd, setQuickItemsToAdd] = useState<{
        name: string,
        dateMode: string,
        month?: string,
        year?: string,
        startYear?: string,
        endYear?: string
    }[]>([])
    const [quickFormLoading, setQuickFormLoading] = useState(false)
    const [quickFormError, setQuickFormError] = useState<string | null>(null)
    const [quickDateSelectionMode, setQuickDateSelectionMode] = useState<'monthYear' | 'year' | 'yearRange'>('monthYear')
    const [quickStartYear, setQuickStartYear] = useState('')
    const [quickEndYear, setQuickEndYear] = useState('')
    const [quickPromptsDict, setQuickPromptsDict] = useState<Record<string, string>>({})
    const [ownershipGoalUnit, setOwnershipGoalUnit] = useState<'months' | 'years'>('months')
    const [ownershipGoalValue, setOwnershipGoalValue] = useState<number>(12)
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
    const calculateReceivedDate = (): Date | undefined => {
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

    // Helper function to check if date is valid based on selection mode
    const isDateValid = (): boolean => {
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
        return ownershipGoalUnit === 'years' ? ownershipGoalValue * 12 : ownershipGoalValue
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
        console.log(user?.publicMetadata)
        return (user as any)?.publicMetadata?.['is-admin'] === true
    }

    // Helper function to check if user can add more items
    const canAddMoreItems = (additionalCount = 1): boolean => {
        // Admin users bypass item limits
        if (isUserAdmin()) return true
        if (!itemStats) return true // Allow if stats not loaded yet
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

        const calculatedDate = calculateReceivedDate()
        if (!calculatedDate) {
            console.error('Received date is required')
            setManualAddError('Received date is required')
            setIsSubmitting(false)
            return
        }
        if (!useEmoji && !uploadedImageUrl) {
            setManualAddError('Please select an emoji or upload an image')
            setIsSubmitting(false)
            return
        }
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
            const dateString = getQuickDateString()
            // Compose prompt for agent_add_item
            const prompt = `Add a new item to keep: name '${quickItemName}', received ${dateString} `

            // Create new item object
            const newItem = {
                name: quickItemName,
                dateMode: quickDateSelectionMode,
                ...(quickDateSelectionMode === 'monthYear' && { month: quickItemMonth, year: quickItemYear }),
                ...(quickDateSelectionMode === 'year' && { year: quickItemYear }),
                ...(quickDateSelectionMode === 'yearRange' && { startYear: quickStartYear, endYear: quickEndYear })
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
        } catch (error) {
            setQuickFormError('Failed to add item via Quick Add')
        } finally {
            setQuickFormLoading(false)
        }
    }

    function LoadingSpinnerSVG() {
        return (
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                fill="white"
            >
                <path
                    d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"
                    opacity=".25"
                />
                <path
                    d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z"
                    className="spinner_ajPY"
                />
            </svg>
        );
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
    const years = Array.from({ length: 21 }, (_, i) => `${2024 - i} `)

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-6 w-full max-w-xs sm:max-w-md relative max-h-[95vh] overflow-y-auto">
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
                                    maxLength={50}
                                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    required
                                />
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {name ? name.length : 0}/50 characters
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
                                                onClientUploadComplete={(res: any) => {
                                                    setUploadedImageUrl(res?.[0]?.ufsUrl ?? res?.[0]?.fileUrl ?? null)
                                                    setIsUploading(false)

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
                                <div className="flex flex-col gap-3">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Item Received Date</label>

                                    {/* Date Selection Mode Options */}
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        <button
                                            type="button"
                                            onClick={() => setDateSelectionMode('full')}
                                            className={`px-3 py-1 text-sm rounded-md ${dateSelectionMode === 'full' ? 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300' : 'bg-gray-100 dark:bg-gray-700'}`}
                                        >
                                            Full Date
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDateSelectionMode('monthYear')}
                                            className={`px-3 py-1 text-sm rounded-md ${dateSelectionMode === 'monthYear' ? 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300' : 'bg-gray-100 dark:bg-gray-700'}`}
                                        >
                                            Month & Year
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDateSelectionMode('year')}
                                            className={`px-3 py-1 text-sm rounded-md ${dateSelectionMode === 'year' ? 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300' : 'bg-gray-100 dark:bg-gray-700'}`}
                                        >
                                            Year Only
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDateSelectionMode('yearRange')}
                                            className={`px-3 py-1 text-sm rounded-md ${dateSelectionMode === 'yearRange' ? 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300' : 'bg-gray-100 dark:bg-gray-700'}`}
                                        >
                                            Year Range
                                        </button>
                                    </div>

                                    {/* Full Date Picker */}
                                    {dateSelectionMode === 'full' && (
                                        <Popover open={open} onOpenChange={setOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    id="date"
                                                    className="w-48 justify-between font-normal"
                                                >
                                                    {receivedDate ? receivedDate.toLocaleDateString() : "Select date"}
                                                    <ChevronDownIcon />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={receivedDate}
                                                    captionLayout="dropdown"
                                                    onSelect={(date) => {
                                                        setReceivedDate(date)
                                                        setOpen(false)
                                                    }}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    )}

                                    {/* Month & Year Selection */}
                                    {dateSelectionMode === 'monthYear' && (
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Month</label>
                                                <select
                                                    value={selectedMonth}
                                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                                                    required
                                                >
                                                    <option value="">Select month</option>
                                                    {months.map(month => (
                                                        <option key={month} value={month}>{month}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Year</label>
                                                <select
                                                    value={selectedYear}
                                                    onChange={(e) => setSelectedYear(e.target.value)}
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                                                    required
                                                >
                                                    <option value="">Select year</option>
                                                    {years.map(year => (
                                                        <option key={year} value={year}>{year}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {/* Year Only Selection */}
                                    {dateSelectionMode === 'year' && (
                                        <div>
                                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Year (defaults to January 1st)</label>
                                            <select
                                                value={selectedYear}
                                                onChange={(e) => setSelectedYear(e.target.value)}
                                                className="w-48 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                                                required
                                            >
                                                <option value="">Select year</option>
                                                {years.map(year => (
                                                    <option key={year} value={year}>{year}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Year Range Selection */}
                                    {dateSelectionMode === 'yearRange' && (
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start Year</label>
                                                <select
                                                    value={startYear}
                                                    onChange={(e) => setStartYear(e.target.value)}
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                                                    required
                                                >
                                                    <option value="">Start year</option>
                                                    {years.map(year => (
                                                        <option key={year} value={year}>{year}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End Year</label>
                                                <select
                                                    value={endYear}
                                                    onChange={(e) => setEndYear(e.target.value)}
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                                                    required
                                                >
                                                    <option value="">End year</option>
                                                    {years.map(year => (
                                                        <option key={year} value={year}>{year}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {/* Display calculated date */}
                                    {dateSelectionMode !== 'full' && calculateReceivedDate() && (
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                            Selected date: {calculateReceivedDate()?.toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ownership Duration Goal</label>
                                <div className="mt-1 flex items-center space-x-3">
                                    <input
                                        type="number"
                                        value={ownershipGoalValue}
                                        onChange={(e) => setOwnershipGoalValue(Number(e.target.value))}
                                        min="1"
                                        max={ownershipGoalUnit === 'years' ? 10 : 120}
                                        className="block w-24 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                                    />
                                    <select
                                        value={ownershipGoalUnit}
                                        onChange={(e) => {
                                            const newUnit = e.target.value as 'months' | 'years'
                                            setOwnershipGoalUnit(newUnit)
                                            // Convert current value to new unit
                                            if (newUnit === 'years' && ownershipGoalUnit === 'months') {
                                                setOwnershipGoalValue(Math.max(1, Math.round(ownershipGoalValue / 12)))
                                            } else if (newUnit === 'months' && ownershipGoalUnit === 'years') {
                                                setOwnershipGoalValue(ownershipGoalValue * 12)
                                            }
                                        }}
                                        className="rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                                    >
                                        <option value="months">months</option>
                                        <option value="years">years</option>
                                    </select>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                        ({calculateOwnershipDurationMonths()} months total)
                                    </span>
                                </div>
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
                                    disabled={isSubmitting || !name || (useEmoji ? !pictureEmoji : !uploadedImageUrl) || !isDateValid() || !canAddMoreItems(1)}
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
                                onClick={() => setShowQuickAddForm(v => !v)}
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

                                    {/* Date Selection Mode Options */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Received Date</label>
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            <button
                                                type="button"
                                                onClick={() => setQuickDateSelectionMode('monthYear')}
                                                className={`px-3 py-1 text-sm rounded-md ${quickDateSelectionMode === 'monthYear' ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' : 'bg-gray-100 dark:bg-gray-700'}`}
                                            >
                                                Month & Year
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setQuickDateSelectionMode('year')}
                                                className={`px-3 py-1 text-sm rounded-md ${quickDateSelectionMode === 'year' ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' : 'bg-gray-100 dark:bg-gray-700'}`}
                                            >
                                                Year Only
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setQuickDateSelectionMode('yearRange')}
                                                className={`px-3 py-1 text-sm rounded-md ${quickDateSelectionMode === 'yearRange' ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' : 'bg-gray-100 dark:bg-gray-700'}`}
                                            >
                                                Year Range
                                            </button>
                                        </div>

                                        {/* Month & Year Selection */}
                                        {quickDateSelectionMode === 'monthYear' && (
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <select
                                                        value={quickItemMonth}
                                                        onChange={e => setQuickItemMonth(e.target.value)}
                                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                                        required
                                                    >
                                                        <option value="">Select month</option>
                                                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                                                    </select>
                                                </div>
                                                <div className="flex-1">
                                                    <select
                                                        value={quickItemYear}
                                                        onChange={e => setQuickItemYear(e.target.value)}
                                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                                        required
                                                    >
                                                        <option value="">Select year</option>
                                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        )}

                                        {/* Year Only Selection */}
                                        {quickDateSelectionMode === 'year' && (
                                            <div>
                                                <select
                                                    value={quickItemYear}
                                                    onChange={e => setQuickItemYear(e.target.value)}
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                                    required
                                                >
                                                    <option value="">Select year</option>
                                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                                </select>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Defaults to January 1st</p>
                                            </div>
                                        )}

                                        {/* Year Range Selection */}
                                        {quickDateSelectionMode === 'yearRange' && (
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <select
                                                        value={quickStartYear}
                                                        onChange={e => setQuickStartYear(e.target.value)}
                                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                                        required
                                                    >
                                                        <option value="">Start year</option>
                                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                                                    </select>
                                                </div>
                                                <div className="flex-1">
                                                    <select
                                                        value={quickEndYear}
                                                        onChange={e => setQuickEndYear(e.target.value)}
                                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                                        required
                                                    >
                                                        <option value="">End year</option>
                                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        )}

                                        {/* Display calculated date */}
                                        {isQuickDateValid() && (
                                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                Selected date: {getQuickDateString()}
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
                                        {quickFormLoading ? 'Adding...' : canAddToQuickList() ? 'Add to Items to Add' : 'Limit Reached'}
                                    </button>
                                </form>
                            )}
                            {/* Items to Add List */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-lg font-semibold">Items to add</h3>
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
                                            if (item.dateMode === 'monthYear') {
                                                dateDisplay = `${item.month} ${item.year} `
                                            } else if (item.dateMode === 'year') {
                                                dateDisplay = `January ${item.year} `
                                            } else if (item.dateMode === 'yearRange') {
                                                const start = parseInt(item.startYear || '0')
                                                const end = parseInt(item.endYear || '0')
                                                const middleYear = Math.floor((start + end) / 2)
                                                dateDisplay = `June ${middleYear} (${item.startYear} -${item.endYear} range)`
                                            }

                                            return (
                                                <div key={idx} className="bg-white dark:bg-gray-800 rounded shadow p-3 flex justify-between items-start">
                                                    <div className="flex-1">
                                                        {/* Card for each item */}
                                                        <div className="font-medium">{item.name}</div>
                                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                                            Received: {dateDisplay}
                                                        </div>
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
                                    Submit All Items
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
} 