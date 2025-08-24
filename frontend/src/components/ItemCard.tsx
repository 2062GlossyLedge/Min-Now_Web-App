'use client'

import { useState, useEffect } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Edit2, Trash2, ChevronDown, ImageIcon, SmileIcon } from 'lucide-react'
import Image from 'next/image'
import { UploadButton } from '@uploadthing/react'
import "@uploadthing/react/styles.css";
import { twMerge } from 'tailwind-merge'
import DatePickerComponent from '@/components/DatePickerComponent'
import { DatePickerState, calculateReceivedDate, initializeDatePickerState } from '@/utils/datePickerHelpers'

import type { OurFileRouter } from '@/app/api/uploadthing/core'

/**
 * ItemCard Component with Image/Emoji Editing Capability
 * 
 * Features:
 * - Display item information in a card format
 * - Expandable/collapsible view
 * - Edit mode with inline editing for all item properties
 * - Image/Emoji editing with toggle between emoji input and file upload
 * - Real-time preview of edited image/emoji in card header
 * - Support for uploaded images via UploadThing
 * - Progress bar for ownership duration goals
 * - Status buttons (Keep, Give, Donate)
 * - Delete functionality with loading states
 * 
 * Image editing modes:
 * - Emoji mode: Text input for emoji characters with emoji picker tip
 * - Image mode: File upload with preview and upload progress
 * - Live preview in card header during editing
 */

interface ItemCardProps {
    id: string
    name: string
    pictureUrl: string
    itemType: string
    status: string
    ownershipDuration: string
    lastUsedDuration: string
    receivedDate?: string
    ownershipDurationGoalMonths?: number
    ownershipDurationGoalProgress?: number
    onStatusChange?: (id: string, newStatus: string) => void
    onEdit?: (id: string, updates: { name?: string, receivedDate?: Date, itemType?: string, status?: string, ownershipDurationGoalMonths?: number, pictureUrl?: string }) => void
    onDelete?: (id: string) => void
    isDeleting?: boolean // Whether this specific item is being deleted
    isAnyDeleting?: boolean // Whether any item in the list is being deleted
}

export default function ItemCard({
    id,
    name,
    pictureUrl,
    itemType,
    status,
    ownershipDuration,
    receivedDate: initialReceivedDate,
    ownershipDurationGoalMonths = 12,
    ownershipDurationGoalProgress = 0,
    onEdit,
    onDelete,
    isDeleting = false,
    isAnyDeleting = false,
}: ItemCardProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editedName, setEditedName] = useState(name)
    const [editedItemType, setEditedItemType] = useState(itemType)
    const [editedStatus, setEditedStatus] = useState(status)

    // Initialize ownership duration goal unit and value correctly from the start
    const [ownershipGoalUnit, setOwnershipGoalUnit] = useState<'months' | 'years'>(() => {
        return (ownershipDurationGoalMonths >= 12 && ownershipDurationGoalMonths % 12 === 0) ? 'years' : 'months'
    })
    const [ownershipGoalValue, setOwnershipGoalValue] = useState<number>(() => {
        if (ownershipDurationGoalMonths >= 12 && ownershipDurationGoalMonths % 12 === 0) {
            return ownershipDurationGoalMonths / 12
        } else {
            return ownershipDurationGoalMonths
        }
    })

    const [receivedDate, setReceivedDate] = useState<Date | undefined>(
        initialReceivedDate ? new Date(initialReceivedDate) : undefined
    )
    const [isItemTypeDropdownOpen, setIsItemTypeDropdownOpen] = useState(false)

    // Date picker state
    const [datePickerState, setDatePickerState] = useState<DatePickerState>(() => ({
        ...initializeDatePickerState(initialReceivedDate ? new Date(initialReceivedDate) : undefined),
        dateSelectionMode: 'full',
        selectedMonth: '',
        selectedYear: '',
        startYear: '',
        endYear: ''
    }))
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)

    // Image editing states
    const [useEmoji, setUseEmoji] = useState(true)
    const [editedPictureEmoji, setEditedPictureEmoji] = useState('')
    const [editedUploadedImageUrl, setEditedUploadedImageUrl] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)

    // Current picture URL state (tracks the most recent saved picture)
    // This allows immediate display of changes after saving, before parent component updates
    const [currentPictureUrl, setCurrentPictureUrl] = useState(pictureUrl)

    // Update local state when props change
    useEffect(() => {
        setEditedName(name)
        setEditedItemType(itemType)
        setEditedStatus(status)
        const newReceivedDate = initialReceivedDate ? new Date(initialReceivedDate) : undefined
        setReceivedDate(newReceivedDate)
        setCurrentPictureUrl(pictureUrl)

        // Update date picker state when receivedDate changes
        setDatePickerState(prev => ({
            ...prev,
            ...initializeDatePickerState(newReceivedDate),
            receivedDate: newReceivedDate
        }))

        // Update ownership duration goal unit and value when props change
        if (ownershipDurationGoalMonths >= 12 && ownershipDurationGoalMonths % 12 === 0) {
            setOwnershipGoalUnit('years')
            setOwnershipGoalValue(ownershipDurationGoalMonths / 12)
        } else {
            setOwnershipGoalUnit('months')
            setOwnershipGoalValue(ownershipDurationGoalMonths)
        }

        // Initialize image editing states based on pictureUrl from props
        if (isImageUrl(pictureUrl)) {
            setUseEmoji(false)
            setEditedUploadedImageUrl(pictureUrl)
            setEditedPictureEmoji('')
        } else {
            setUseEmoji(true)
            setEditedPictureEmoji(pictureUrl)
            setEditedUploadedImageUrl(null)
        }
    }, [name, itemType, status, ownershipDurationGoalMonths, initialReceivedDate, pictureUrl])

    // Helper function to calculate total ownership duration in months
    const calculateOwnershipDurationMonths = (): number => {
        return ownershipGoalUnit === 'years' ? ownershipGoalValue * 12 : ownershipGoalValue
    }

    // Helper function to format ownership goal value input (max 3 digits, remove leading zeros when >= 2 digits)
    const formatOwnershipGoalValue = (value: string): number => {
        // Remove non-numeric characters and limit to 3 digits
        const numericValue = value.replace(/\D/g, '').slice(0, 3)

        // Convert to number and remove leading zeros for values >= 10
        const parsedValue = parseInt(numericValue || '0', 10)

        // Ensure minimum value of 1
        return Math.max(1, parsedValue)
    }

    // Handle date picker state changes
    const handleDatePickerStateChange = (updates: Partial<DatePickerState>) => {
        const newState = { ...datePickerState, ...updates }
        setDatePickerState(newState)

        // Calculate and update the actual received date based on the current selection mode
        const calculatedDate = calculateReceivedDate(newState)
        setReceivedDate(calculatedDate)
    }    // Function to check if the pictureUrl is an emoji
    const isEmoji = (str: string) => {
        return str.length > 1 && str.length <= 2;
    }

    // Function to check if the pictureUrl is a valid image URL (http or /)
    const isImageUrl = (str: string) => {
        return typeof str === 'string' && (str.startsWith('http') || str.startsWith('/'));
    }

    const handleSave = () => {
        if (onEdit) {
            // Determine the picture URL based on selected mode
            let finalPictureUrl = currentPictureUrl; // fallback to current saved state
            if (useEmoji && editedPictureEmoji) {
                finalPictureUrl = editedPictureEmoji;
            } else if (!useEmoji && editedUploadedImageUrl) {
                finalPictureUrl = editedUploadedImageUrl;
            }

            // Update local state immediately to reflect changes
            setCurrentPictureUrl(finalPictureUrl);

            // Calculate ownership duration in months based on unit selection
            const calculatedOwnershipDurationMonths = calculateOwnershipDurationMonths();

            onEdit(id, {
                name: editedName,
                receivedDate,
                itemType: editedItemType,
                status: editedStatus,
                ownershipDurationGoalMonths: calculatedOwnershipDurationMonths,
                pictureUrl: finalPictureUrl
            })
        }
        setIsEditing(false)
    }

    const handleCancel = () => {
        setEditedName(name)
        setEditedItemType(itemType)
        setEditedStatus(status)
        const originalDate = initialReceivedDate ? new Date(initialReceivedDate) : undefined
        setReceivedDate(originalDate)

        // Reset date picker state
        setDatePickerState({
            ...initializeDatePickerState(originalDate),
            dateSelectionMode: 'full',
            selectedMonth: '',
            selectedYear: '',
            startYear: '',
            endYear: ''
        })

        // Reset ownership duration goal unit and value
        if (ownershipDurationGoalMonths >= 12 && ownershipDurationGoalMonths % 12 === 0) {
            setOwnershipGoalUnit('years')
            setOwnershipGoalValue(ownershipDurationGoalMonths / 12)
        } else {
            setOwnershipGoalUnit('months')
            setOwnershipGoalValue(ownershipDurationGoalMonths)
        }

        // Reset image editing states to current picture URL
        if (isImageUrl(currentPictureUrl)) {
            setUseEmoji(false)
            setEditedUploadedImageUrl(currentPictureUrl)
            setEditedPictureEmoji('')
        } else {
            setUseEmoji(true)
            setEditedPictureEmoji(currentPictureUrl)
            setEditedUploadedImageUrl(null)
        }

        setIsEditing(false)
    }

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete(id);
        }
    }

    // Match exactly with backend ItemType choices - using database values (underscored)
    const itemTypes = [
        'Clothing_Accessories',
        'Technology',
        'Furniture_Appliances',
        'Books_Media',
        'Vehicles',
        'Personal_Care_Items',
        'Decor_Art',
        'Tools_Equipment',
        'Toys_Games',
        'Outdoor_Gear',
        'Fitness_Equipment',
        'Pet_Supplies',
        'Subscriptions_Licenses',
        'Miscellaneous',
        'Other'
    ] as const

    // Map database values to display names
    const itemTypeDisplayNames: Record<string, string> = {
        'Clothing_Accessories': 'Clothing & Accessories',
        'Technology': 'Technology',
        'Furniture_Appliances': 'Furniture & Appliances',
        'Kitchenware': 'Kitchenware',
        'Books_Media': 'Books & Media',
        'Vehicles': 'Vehicles',
        'Personal_Care_Items': 'Personal Care Items',
        'Decor_Art': 'Decor & Art',
        'Tools_Equipment': 'Tools & Equipment',
        'Toys_Games': 'Toys & Games',
        'Outdoor_Gear': 'Outdoor Gear',
        'Fitness_Equipment': 'Fitness Equipment',
        'Pet_Supplies': 'Pet Supplies',
        'Subscriptions_Licenses': 'Subscriptions & Licenses',
        'Miscellaneous': 'Miscellaneous',
        'Other': 'Other'
    }

    return (
        <div
            onClick={() => !isEditing && setIsExpanded(!isExpanded)}
            className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-4 mb-4 cursor-pointer group"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
                        {/* Show edited image/emoji when in edit mode, otherwise show current pictureUrl */}
                        {isEditing ? (
                            useEmoji ? (
                                editedPictureEmoji ? (
                                    <span className="text-2xl group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors">
                                        {editedPictureEmoji}
                                    </span>
                                ) : (
                                    <span className="text-lg text-gray-400 dark:text-gray-500">📷</span>
                                )
                            ) : (
                                editedUploadedImageUrl ? (
                                    <div className="relative w-full h-full">
                                        <Image
                                            src={editedUploadedImageUrl}
                                            alt={editedName}
                                            fill
                                            className="object-cover"
                                            sizes="64px"
                                        />
                                    </div>
                                ) : (
                                    <span className="text-lg text-gray-400 dark:text-gray-500">📷</span>
                                )
                            )
                        ) : (
                            isEmoji(currentPictureUrl) ? (
                                <span className="text-2xl group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors">
                                    {currentPictureUrl}
                                </span>
                            ) : isImageUrl(currentPictureUrl) ? (
                                <div className="relative w-full h-full">
                                    <Image
                                        src={currentPictureUrl}
                                        alt={name}
                                        fill
                                        className="object-cover"
                                        sizes="64px"
                                    />
                                </div>
                            ) : (
                                <span className="text-2xl group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors">
                                    {currentPictureUrl}
                                </span>
                            )
                        )}
                    </div>
                    <div>
                        {isEditing ? (
                            <div>
                                <input
                                    type="text"
                                    value={editedName}
                                    onChange={(e) => setEditedName(e.target.value)}
                                    maxLength={25}
                                    className="text-lg font-semibold bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-teal-500 dark:focus:border-teal-400"
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {editedName ? editedName.length : 0}/25 characters
                                </p>
                            </div>
                        ) : (
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors">{name}</h3>
                        )}
                        <p className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors">
                            {isEditing ? (itemTypeDisplayNames[editedItemType] || editedItemType) : (itemTypeDisplayNames[itemType] || itemType)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    {onEdit && !isEditing && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(!isEditing);
                                setIsExpanded(true);

                                // Initialize editing states with current saved picture state
                                if (isImageUrl(currentPictureUrl)) {
                                    setUseEmoji(false);
                                    setEditedUploadedImageUrl(currentPictureUrl);
                                    setEditedPictureEmoji('');
                                } else {
                                    setUseEmoji(true);
                                    setEditedPictureEmoji(currentPictureUrl);
                                    setEditedUploadedImageUrl(null);
                                }
                            }}
                            className="text-gray-500 dark:text-gray-400 hover:text-teal-500 dark:hover:text-teal-400 transition-colors"
                        >
                            <Edit2 className="h-5 w-5" />
                        </button>
                    )}
                    {onDelete && !isEditing && (
                        <button
                            onClick={handleDelete}
                            disabled={isAnyDeleting}
                            className={`${isAnyDeleting
                                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                : 'text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400'
                                } transition-colors relative`}
                            title={isAnyDeleting ? 'Please wait...' : 'Delete item'}
                        >
                            {isDeleting ? (
                                /* Loading spinner for this specific item */
                                <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-red-500 rounded-full"></div>
                            ) : (
                                <Trash2 className="h-5 w-5" />
                            )}
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }}
                        className="text-gray-500 dark:text-gray-400 hover:text-teal-500 dark:hover:text-teal-400 transition-colors"
                    >
                        {/* hide collapse button in edit mode */}
                        {isEditing ? (
                            <span></span>
                        ) : (
                            isExpanded ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            )
                        )}
                    </button>
                </div>
            </div>

            {(isExpanded || isEditing) && (
                <div className="mt-4 space-y-2">


                    {/* Edit mode layout - single column */}
                    {isEditing ? (
                        <div className="space-y-4">
                            {/* Item Received Date */}
                            <div className="flex flex-col space-y-2">
                                <span className="text-sm text-gray-500 dark:text-gray-400">Item Received Date:</span>
                                <DatePickerComponent
                                    state={datePickerState}
                                    onStateChange={handleDatePickerStateChange}
                                    onDateChange={setReceivedDate}
                                    isPopoverOpen={isDatePickerOpen}
                                    onPopoverOpenChange={setIsDatePickerOpen}
                                    buttonClassName="w-[240px] justify-start text-left font-normal"
                                />
                            </div>

                            {/* Item Status */}
                            <div className="flex flex-col space-y-2">
                                <span className="text-sm text-gray-500 dark:text-gray-400">Item Status:</span>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditedStatus('Keep');
                                        }}
                                        className={`px-3 py-1 rounded text-sm ${editedStatus === 'Keep'
                                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-teal-100 dark:hover:bg-teal-900 hover:text-teal-700 dark:hover:text-teal-300'
                                            }`}
                                    >
                                        Keep
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditedStatus('Give');
                                        }}
                                        className={`px-3 py-1 rounded text-sm ${editedStatus === 'Give'
                                            ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-teal-100 dark:hover:bg-teal-900 hover:text-teal-700 dark:hover:text-teal-300'
                                            }`}
                                    >
                                        Give
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditedStatus('Donate');
                                        }}
                                        className={`px-3 py-1 rounded text-sm ${editedStatus === 'Donate'
                                            ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-teal-100 dark:hover:bg-teal-900 hover:text-teal-700 dark:hover:text-teal-300'
                                            }`}
                                    >
                                        Donate
                                    </button>
                                </div>
                            </div>

                            {/* Item Image/Emoji */}
                            <div className="flex flex-col space-y-2">
                                <span className="text-sm text-gray-500 dark:text-gray-400">Item Image:</span>
                                <div className="flex items-center space-x-4 mb-2">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setUseEmoji(true);
                                            setEditedUploadedImageUrl(null);
                                        }}
                                        className={`flex items-center space-x-2 px-3 py-2 rounded-md ${useEmoji ? 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300' : 'bg-gray-100 dark:bg-gray-700'}`}
                                    >
                                        <SmileIcon className="h-5 w-5" />
                                        <span>Emoji</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setUseEmoji(false);
                                            setEditedPictureEmoji('');
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
                                            value={editedPictureEmoji || ""}
                                            onChange={(e) => {
                                                const input = e.target.value;
                                                // Limit input to 50 characters
                                                if (input.length <= 50) {
                                                    setEditedPictureEmoji(input);
                                                }
                                            }}
                                            maxLength={50}
                                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                            required={useEmoji}
                                            placeholder="Enter emoji(s)"
                                        />
                                        {/* <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            {editedPictureEmoji ? editedPictureEmoji.length : 0}/50 characters
                                        </p> */}
                                    </div>
                                ) : (
                                    <div>
                                        <UploadButton<OurFileRouter, "imageUploader">
                                            // issues applying ut styles, using default styles from C:\Min-Now_Web-App-1\frontend\node_modules\@uploadthing\react\dist\button-client-BLNyMUF0.js. see https://docs.uploadthing.com/concepts/theming#theming-with-tailwind-css
                                            className="w-fit"
                                            config={{ cn: twMerge }}
                                            endpoint="imageUploader"
                                            onClientUploadComplete={(res: any) => {
                                                setEditedUploadedImageUrl(res?.[0]?.url ?? res?.[0]?.fileUrl ?? null)
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
                                        {editedUploadedImageUrl && (
                                            <div className="mt-2 relative w-16 h-16">
                                                <Image
                                                    src={editedUploadedImageUrl}
                                                    alt="Preview"
                                                    fill
                                                    className="object-cover rounded-md"
                                                    sizes="64px"
                                                />
                                            </div>
                                        )}
                                        {isUploading && (
                                            <div className="mt-2 text-sm text-teal-600">Uploading...</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Item Type */}
                            <div className="flex flex-col space-y-2">
                                <span className="text-sm text-gray-500 dark:text-gray-400">Item Type:</span>
                                <Popover open={isItemTypeDropdownOpen} onOpenChange={setIsItemTypeDropdownOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-[240px] justify-between text-left font-normal"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {itemTypeDisplayNames[editedItemType] || editedItemType}
                                            <ChevronDown className="h-4 w-4 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[240px] p-0 bg-white dark:bg-gray-800" align="start">
                                        <div className="max-h-[200px] overflow-y-auto">
                                            {itemTypes.map((type) => (
                                                <button
                                                    key={type}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditedItemType(type);
                                                        setIsItemTypeDropdownOpen(false);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none"
                                                >
                                                    {itemTypeDisplayNames[type] || type}
                                                </button>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Ownership Duration Goal */}
                            <div className="flex flex-col space-y-2">
                                <span className="text-sm text-gray-500 dark:text-gray-400">Ownership Duration Goal:</span>
                                <div className="flex items-center space-x-3">
                                    <input
                                        type="number"
                                        value={ownershipGoalValue}
                                        onChange={(e) => setOwnershipGoalValue(formatOwnershipGoalValue(e.target.value))}
                                        min="1"
                                        max={ownershipGoalUnit === 'years' ? 999 : 999}
                                        className="block w-24 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <select
                                        value={ownershipGoalUnit}
                                        onChange={(e) => {
                                            const newUnit = e.target.value as 'months' | 'years'
                                            setOwnershipGoalUnit(newUnit)
                                            // Convert current value to new unit with 3-digit limit
                                            if (newUnit === 'years' && ownershipGoalUnit === 'months') {
                                                const convertedValue = Math.max(1, Math.round(ownershipGoalValue / 12))
                                                setOwnershipGoalValue(Math.min(999, convertedValue))
                                            } else if (newUnit === 'months' && ownershipGoalUnit === 'years') {
                                                const convertedValue = ownershipGoalValue * 12
                                                setOwnershipGoalValue(Math.min(999, convertedValue))
                                            }
                                        }}
                                        className="rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <option value="months">months</option>
                                        <option value="years">years</option>
                                    </select>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex justify-end space-x-4 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={handleCancel}
                                    className="text-gray-700 dark:text-gray-300 px-4 py-2"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    className="bg-teal-600 text-white hover:bg-teal-700 px-4 py-2"
                                >
                                    Save
                                </Button>
                            </div>
                        </div>
                    ) : (
                        /* Non-edit mode display */
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 dark:text-gray-400 group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors">Ownership Duration:</span>
                                <span className="text-gray-900 dark:text-gray-100 group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors">{ownershipDuration}</span>
                            </div>

                            {/* Progress bar for ownership duration goal - only show in Keep status */}
                            {status === 'Keep' && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500 dark:text-gray-400">
                                            Goal: {Math.floor(ownershipDurationGoalMonths / 12)}y {ownershipDurationGoalMonths % 12}m
                                        </span>
                                        <span className="text-gray-500 dark:text-gray-400">
                                            {Math.round(ownershipDurationGoalProgress * 100)}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                        <div
                                            className="bg-teal-500 h-2 rounded-full transition-all duration-300 ease-in-out"
                                            style={{ width: `${Math.min(ownershipDurationGoalProgress * 100, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}