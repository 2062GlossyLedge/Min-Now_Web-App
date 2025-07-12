'use client'

import { useState, useEffect } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { CalendarIcon, Edit2, Save, X, Trash2, ChevronDown } from 'lucide-react'
import Image from 'next/image'

interface ItemCardProps {
    id: string
    name: string
    pictureUrl: string
    itemType: string
    status: string
    ownershipDuration: string
    lastUsedDuration: string
    receivedDate?: string
    onStatusChange?: (id: string, newStatus: string) => void
    onEdit?: (id: string, updates: { name?: string, receivedDate?: Date, itemType?: string, status?: string }) => void
    onDelete?: (id: string) => void
}

export default function ItemCard({
    id,
    name,
    pictureUrl,
    itemType,
    status,
    ownershipDuration,
    lastUsedDuration,
    receivedDate: initialReceivedDate,
    onStatusChange,
    onEdit,
    onDelete,
}: ItemCardProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editedName, setEditedName] = useState(name)
    const [editedItemType, setEditedItemType] = useState(itemType)
    const [editedStatus, setEditedStatus] = useState(status)
    const [receivedDate, setReceivedDate] = useState<Date | undefined>(
        initialReceivedDate ? new Date(initialReceivedDate) : undefined
    )
    const [isItemTypeDropdownOpen, setIsItemTypeDropdownOpen] = useState(false)

    // Update local state when props change
    useEffect(() => {
        setEditedName(name)
        setEditedItemType(itemType)
        setEditedStatus(status)
        setReceivedDate(initialReceivedDate ? new Date(initialReceivedDate) : undefined)
    }, [name, itemType, status, initialReceivedDate])

    // Function to check if the pictureUrl is an emoji
    const isEmoji = (str: string) => {
        return str.length > 1 && str.length <= 2;
    }

    // Function to check if the pictureUrl is a base64 image
    const isBase64Image = (str: string) => {
        return str.startsWith('data:image');
    }

    // Function to check if the pictureUrl is a valid image URL (http or /)
    const isImageUrl = (str: string) => {
        return typeof str === 'string' && (str.startsWith('http') || str.startsWith('/'));
    }

    const handleStatusChange = (newStatus: string) => {
        if (onStatusChange) {
            onStatusChange(id, newStatus)
        }
    }

    const handleSave = () => {
        if (onEdit) {
            onEdit(id, {
                name: editedName,
                receivedDate,
                itemType: editedItemType,
                status: editedStatus
            })
        }
        setIsEditing(false)
    }

    const handleCancel = () => {
        setEditedName(name)
        setEditedItemType(itemType)
        setEditedStatus(status)
        setReceivedDate(initialReceivedDate ? new Date(initialReceivedDate) : undefined)
        setIsEditing(false)
    }

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete(id);
        }
    }

    // Sample item types - you can customize this list
    const itemTypes = ['Clothing', 'Technology', 'Household Item', 'Vehicle', 'Other']

    return (
        <div
            onClick={() => !isEditing && setIsExpanded(!isExpanded)}
            className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-4 mb-4 cursor-pointer group"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
                        {isEmoji(pictureUrl) ? (
                            <span className="text-2xl group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors">
                                {pictureUrl}
                            </span>
                        ) : isImageUrl(pictureUrl) ? (
                            <div className="relative w-full h-full">
                                <Image
                                    src={pictureUrl}
                                    alt={name}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                        ) : (
                            <span className="text-2xl group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors">
                                {pictureUrl}
                            </span>
                        )}
                    </div>
                    <div>
                        {isEditing ? (
                            <input
                                type="text"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                className="text-lg font-semibold bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-teal-500 dark:focus:border-teal-400"
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors">{name}</h3>
                        )}
                        <p className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors">
                            {isEditing ? editedItemType : itemType}
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    {onEdit && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(!isEditing);
                                setIsExpanded(true);
                            }}
                            className="text-gray-500 dark:text-gray-400 hover:text-teal-500 dark:hover:text-teal-400 transition-colors"
                        >
                            {isEditing ? <X className="h-5 w-5" /> : <Edit2 className="h-5 w-5" />}
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={handleDelete}
                            className="text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        >
                            <Trash2 className="h-5 w-5" />
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


                    {/* Edit mode layout with two columns */}
                    {isEditing ? (
                        <div className="space-y-4">
                            {/* First row: Item Received Date and Status */}
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col space-y-2">
                                    <span className="text-sm text-gray-500 dark:text-gray-400">Item Received Date:</span>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="w-[240px] justify-start text-left font-normal"
                                                onClick={(e) => e.stopPropagation()}
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
                                                captionLayout="dropdown"
                                                showOutsideDays={true}
                                                className="rounded-md border"
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

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
                            </div>

                            {/* Second row: Item Type */}
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col space-y-2">
                                    <span className="text-sm text-gray-500 dark:text-gray-400">Item Type:</span>
                                    <Popover open={isItemTypeDropdownOpen} onOpenChange={setIsItemTypeDropdownOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="w-[240px] justify-between text-left font-normal"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {editedItemType}
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
                                                        {type}
                                                    </button>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
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
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400 group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors">Ownership Duration:</span>
                            <span className="text-gray-900 dark:text-gray-100 group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors">{ownershipDuration}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}