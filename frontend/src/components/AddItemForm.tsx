'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { createItem } from '@/utils/api'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'

interface AddItemFormProps {
    onClose: () => void
}

export default function AddItemForm({ onClose }: AddItemFormProps) {
    const router = useRouter()
    const [name, setName] = useState('')
    const [pictureEmoji, setPictureEmoji] = useState('')
    const [itemType, setItemType] = useState('Clothing')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [receivedDate, setReceivedDate] = useState<Date | undefined>(undefined)
    const { authenticatedFetch } = useAuthenticatedFetch()

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

        try {
            // Create a new date object in local timezone and set time to start of day
            const localDate = new Date(receivedDate)
            localDate.setHours(0, 0, 0, 0)

            console.log('Original selected date:', receivedDate)
            console.log('Local timezone offset (minutes):', receivedDate.getTimezoneOffset())
            console.log('Adjusted local date:', localDate)
            console.log('ISO string being sent:', localDate.toISOString())

            const { data, error } = await createItem({
                name,
                picture_url: pictureEmoji,
                item_type: itemType,
                status: 'Keep',
                item_received_date: localDate.toISOString(),
                last_used: localDate.toISOString() // Set last_used to same date
            }, authenticatedFetch)

            if (error) {
                throw new Error(error)
            }

            console.log('Backend response:', data)
            router.refresh()
            onClose()
        } catch (error) {
            console.error('Error adding item:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Add New Item</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Item Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Item Emoji</label>
                        <input
                            type="text"
                            value={pictureEmoji}
                            onChange={(e) => setPictureEmoji(e.target.value.slice(0, 1))}
                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            required
                        />
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
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Item Received Date</label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-full justify-start text-left font-normal mt-1 focus:border-teal-500 focus:ring-teal-500"
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {receivedDate ? format(receivedDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-800" align="start">
                                <Calendar
                                    mode="single"
                                    selected={receivedDate}
                                    onSelect={setReceivedDate}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
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
                            disabled={isSubmitting || !name || !pictureEmoji || !receivedDate}
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