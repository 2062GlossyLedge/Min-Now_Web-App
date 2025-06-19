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
import { Item } from '@/types/item'
import Image from 'next/image'
import { UploadButton } from '@uploadthing/react'
import type { OurFileRouter } from '@/app/api/uploadthing/core'

interface AddItemFormProps {
    onClose: () => void
    onItemAdded: (newItem: Item) => void
}

export default function AddItemForm({ onClose, onItemAdded }: AddItemFormProps) {
    const router = useRouter()
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
                last_used: localDate.toISOString()
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

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Add New Item</h2>

                {/* Add Item ID input and fetch button */}
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
                            // Can't set input value to null or undefined as input element is uncontrollable. 
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
                                        console.log('UploadThing result:', res);
                                        // Try to use a valid image URL from the result
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
            </div>
        </div>
    )
} 