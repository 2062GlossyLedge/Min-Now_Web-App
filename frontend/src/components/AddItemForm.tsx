'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { format, setDate } from 'date-fns'
import { CalendarIcon, ChevronDownIcon, ImageIcon, SmileIcon, SearchIcon } from 'lucide-react'
import { createItem, fetchItemById } from '@/utils/api'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import { useItemUpdate } from '@/contexts/ItemUpdateContext'
import { Item } from '@/types/item'
import Image from 'next/image'
import { UploadButton } from '@uploadthing/react'
import type { OurFileRouter } from '@/app/api/uploadthing/core'
import { toast } from 'sonner'

interface AddItemFormProps {
    onClose: () => void
    onItemAdded: (newItem: Item) => void
}

export default function AddItemForm({ onClose, onItemAdded }: AddItemFormProps) {
    const router = useRouter()
    const { triggerRefresh } = useItemUpdate()
    const [name, setName] = useState('')
    const [pictureEmoji, setPictureEmoji] = useState('')
    const [itemType, setItemType] = useState('Clothing')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [receivedDate, setReceivedDate] = useState<Date | undefined>(undefined)
    const [useEmoji, setUseEmoji] = useState(true)
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const { authenticatedFetch } = useAuthenticatedFetch()
    const [open, setOpen] = useState(false)
    const [itemId, setItemId] = useState('')
    const [isFetching, setIsFetching] = useState(false)
    const [activeTab, setActiveTab] = useState<'manual' | 'quick'>('manual')
    const [quickPrompt, setQuickPrompt] = useState('')
    const [quickLoading, setQuickLoading] = useState(false)
    const [quickError, setQuickError] = useState<string | null>(null)
    const [showQuickAddForm, setShowQuickAddForm] = useState(false)
    const [quickItemName, setQuickItemName] = useState('')
    const [quickItemMonth, setQuickItemMonth] = useState('')
    const [quickItemYear, setQuickItemYear] = useState('')
    const [quickItemsToAdd, setQuickItemsToAdd] = useState<{ name: string, month: string, year: string }[]>([])
    const [quickFormLoading, setQuickFormLoading] = useState(false)
    const [quickFormError, setQuickFormError] = useState<string | null>(null)
    const [quickPromptsDict, setQuickPromptsDict] = useState<Record<string, string>>({})
    const [ownershipDurationGoalMonths, setOwnershipDurationGoalMonths] = useState<number>(12) // Default 1 year)

    const itemTypes = [
        'Clothing',
        'Technology',
        'Household Item',
        'Vehicle',
        'Other'
    ]

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        if (!receivedDate) {
            console.error('Received date is required')
            setIsSubmitting(false)
            return
        }
        if (!useEmoji && !uploadedImageUrl) {
            setIsSubmitting(false)
            return
        }
        try {
            const localDate = new Date(receivedDate)
            localDate.setHours(0, 0, 0, 0)

            let pictureUrl = pictureEmoji
            if (!useEmoji && uploadedImageUrl) {
                pictureUrl = uploadedImageUrl
            }

            const { data, error } = await createItem({
                name,
                picture_url: pictureUrl,
                item_type: itemType,
                status: 'Keep',
                item_received_date: localDate.toISOString(),
                last_used: localDate.toISOString(),
                ownership_duration_goal_months: ownershipDurationGoalMonths
            }, authenticatedFetch)

            if (error) {
                throw new Error(error)
            }

            if (data) {
                onItemAdded(data)
                onClose()
            }
        } catch (error) {
            console.error('Error adding item:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleFetchItem = async () => {
        if (!itemId) return

        setIsFetching(true)
        try {
            const { data, error } = await fetchItemById(itemId, authenticatedFetch)
            if (error) {
                console.error('Error fetching item:', error)
                return
            }

            if (data) {
                setName(data.name)
                setItemType(data.itemType)
                setReceivedDate(new Date(data.item_received_date || data.last_used || new Date()))

                // Handle picture/emoji
                if (data.pictureUrl.startsWith('data:') || data.pictureUrl.startsWith('http')) {
                    setUseEmoji(false)
                    setUploadedImageUrl(data.pictureUrl)
                } else {
                    setUseEmoji(true)
                    setPictureEmoji(data.pictureUrl)
                }
            }
        } catch (error) {
            console.error('Error fetching item:', error)
        } finally {
            setIsFetching(false)
        }
    }

    const handleQuickAddItem = async (e: React.FormEvent) => {
        e.preventDefault()
        setQuickFormError(null)
        if (!quickItemName || !quickItemMonth || !quickItemYear) {
            setQuickFormError('All fields are required.')
            return
        }
        setQuickFormLoading(true)
        try {
            // Compose prompt for agent_add_item
            const prompt = `Add a new item to keep: name '${quickItemName}', received ${quickItemMonth} ${quickItemYear}`
            // Add to quickItemsToAdd and quickPromptsDict (do not send to backend yet)
            setQuickItemsToAdd(prev => {
                const newArr = [...prev, { name: quickItemName, month: quickItemMonth, year: quickItemYear }]
                setQuickPromptsDict(dict => ({ ...dict, [newArr.length - 1]: prompt }))
                return newArr
            })
            setShowQuickAddForm(false)
            setQuickItemName('')
            setQuickItemMonth('')
            setQuickItemYear('')
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
        const { agentAddItemsBatchWithHandlers } = await import('@/utils/api')
        await agentAddItemsBatchWithHandlers(
            quickPromptsDict,
            authenticatedFetch,
            {
                onSuccess: () => {
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
                // Optionally, you can add onSubmitting/onError handlers if you want to do more
            }
        )
    }

    // Month and year options
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ]
    const years = Array.from({ length: 21 }, (_, i) => `${2024 - i}`)

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md relative">
                <div className="flex mb-4">
                    <button
                        className={`px-4 py-2 rounded-tl-lg border-b-2 font-semibold focus:outline-none ${activeTab === 'manual' ? 'border-teal-500 text-teal-600 dark:text-teal-300' : 'border-transparent text-gray-500 dark:text-gray-400'}`}
                        onClick={() => setActiveTab('manual')}
                        type="button"
                    >
                        Manual Add
                    </button>
                    <button
                        className={`px-4 py-2 rounded-tr-lg border-b-2 font-semibold focus:outline-none ${activeTab === 'quick' ? 'border-purple-500 text-purple-600 dark:text-purple-300' : 'border-transparent text-gray-500 dark:text-gray-400'}`}
                        onClick={() => setActiveTab('quick')}
                        type="button"
                    >
                        Quick Add
                    </button>
                </div>

                {activeTab === 'manual' && (
                    <>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Add New Item</h2>
                        <div className="mb-4 flex gap-2">
                            <input
                                type="text"
                                value={itemId}
                                onChange={(e) => setItemId(e.target.value)}
                                placeholder="Enter item ID to fetch"
                                className="flex-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                            <Button
                                onClick={handleFetchItem}
                                disabled={!itemId || isFetching}
                                className="bg-teal-600 hover:bg-teal-700 text-white"
                            >
                                {isFetching ? 'Fetching...' : <SearchIcon className="h-4 w-4" />}
                            </Button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Item Name</label>
                                <input
                                    type="text"
                                    value={name || ""}
                                    onChange={(e) => setName(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    required
                                />
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
                                                const lastChar = input.slice(-1);
                                                if (lastChar.length > 1) {
                                                    setPictureEmoji(lastChar);
                                                } else {
                                                    setPictureEmoji(input);
                                                }
                                            }}
                                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                            required={useEmoji}
                                            placeholder="Enter an emoji"
                                        />
                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            Tip: You can use Windows key + . (period) to open the emoji picker
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Item Image</label>
                                        <UploadButton<OurFileRouter, "imageUploader">
                                            endpoint="imageUploader"
                                            onClientUploadComplete={(res: any) => {
                                                setUploadedImageUrl(res?.[0]?.url ?? res?.[0]?.fileUrl ?? null)
                                                setIsUploading(false)
                                            }}
                                            onUploadError={(error: Error) => {
                                                setIsUploading(false)
                                                alert('Upload failed: ' + error.message)
                                            }}
                                            onUploadBegin={() => {
                                                setIsUploading(true)
                                            }}
                                            appearance={{
                                                button: 'mt-1 block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 dark:file:bg-teal-900 dark:file:text-teal-300 hover:file:bg-teal-100 dark:hover:file:bg-teal-800',
                                            }}
                                        />
                                        {uploadedImageUrl && (
                                            <div className="mt-2 relative w-24 h-24">
                                                <Image
                                                    src={uploadedImageUrl}
                                                    alt="Preview"
                                                    fill
                                                    className="object-cover rounded-md"
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
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ownership Duration Goal</label>
                                <div className="mt-1 flex items-center space-x-3">
                                    <input
                                        type="number"
                                        value={ownershipDurationGoalMonths}
                                        onChange={(e) => setOwnershipDurationGoalMonths(Number(e.target.value))}
                                        min="1"
                                        max="120"
                                        className="block w-24 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                                    />
                                    <span className="text-sm text-gray-500 dark:text-gray-400">months</span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                        ({Math.floor(ownershipDurationGoalMonths / 12)}y {ownershipDurationGoalMonths % 12}m)
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
                                    disabled={isSubmitting || !name || (useEmoji ? !pictureEmoji : !uploadedImageUrl) || !receivedDate}
                                    className="px-4 py-2 text-sm font-medium text-white bg-teal-600 border border-transparent rounded-md hover:bg-teal-700 disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Adding...' : 'Add Item'}
                                </button>
                            </div>
                        </form>
                    </>
                )}

                {activeTab === 'quick' && (
                    <>
                        {/* Quick Add Card */}
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg shadow p-4 mb-4">
                            {/* Quick Add Item Button */}
                            <button
                                className="mb-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition disabled:opacity-50"
                                onClick={() => setShowQuickAddForm(v => !v)}
                                type="button"
                            >
                                {showQuickAddForm ? 'Cancel' : 'Quick Add Item'}
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
                                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                            required
                                        />
                                    </div>
                                    {/* Month Select */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Received Month</label>
                                        <select
                                            value={quickItemMonth}
                                            onChange={e => setQuickItemMonth(e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                            required
                                        >
                                            <option value="">Select month</option>
                                            {months.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                    {/* Year Select */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Received Year</label>
                                        <select
                                            value={quickItemYear}
                                            onChange={e => setQuickItemYear(e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                            required
                                        >
                                            <option value="">Select year</option>
                                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                    {/* Error Message */}
                                    {quickFormError && <div className="text-red-600 text-sm">{quickFormError}</div>}
                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        className="w-full py-2 px-4 rounded bg-purple-600 text-white hover:bg-purple-700 transition disabled:opacity-50"
                                        disabled={quickFormLoading}
                                    >
                                        {quickFormLoading ? 'Adding...' : 'Add to Items to Add'}
                                    </button>
                                </form>
                            )}
                            {/* Items to Add List */}
                            <div>
                                <h3 className="text-lg font-semibold mb-2">Items to add</h3>
                                {quickItemsToAdd.length === 0 ? (
                                    <div className="text-gray-500 text-sm">No items added yet.</div>
                                ) : (
                                    <div className="space-y-2">
                                        {quickItemsToAdd.map((item, idx) => (
                                            <div key={idx} className="bg-white dark:bg-gray-800 rounded shadow p-3 flex flex-col">
                                                {/* Card for each item */}
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-sm text-gray-600 dark:text-gray-400">Received: {item.month} {item.year}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {/* Submit All Items Button */}
                            <button
                                className={`mt-4 w-full py-2 px-4 rounded ${quickItemsToAdd.length > 0 ? 'bg-teal-600 hover:bg-teal-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                                disabled={quickItemsToAdd.length === 0}
                                onClick={handleSubmitAllQuickItems}
                                type="button"
                            >
                                Submit All Items
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
} 