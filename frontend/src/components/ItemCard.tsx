'use client'

import { useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { CalendarIcon, Edit2, Save, X, Trash2 } from 'lucide-react'
import Image from 'next/image'

interface ItemCardProps {
    id: string
    name: string
    pictureUrl: string
    itemType: string
    status: string
    ownershipDuration: string
    lastUsedDuration: string
    onStatusChange?: (id: string, newStatus: string) => void
    onEdit?: (id: string, updates: { name?: string, receivedDate?: Date }) => void
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
    onStatusChange,
    onEdit,
    onDelete,
}: ItemCardProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editedName, setEditedName] = useState(name)
    const [receivedDate, setReceivedDate] = useState<Date | undefined>(undefined)

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
        if (onEdit && receivedDate) {
            onEdit(id, {
                name: editedName,
                receivedDate
            })
        }
        setIsEditing(false)
    }

    const handleCancel = () => {
        setEditedName(name)
        setReceivedDate(undefined)
        setIsEditing(false)
    }

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete(id);
        }
    }

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
                        <p className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors">{itemType}</p>
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
                    {/* {isEmoji(pictureUrl) ? (
                        <span className="text-2xl ...">{pictureUrl}</span>
                    ) : isImageUrl(pictureUrl) ? (
                        <div className="relative w-full h-full">
                            <Image src={pictureUrl} alt={name} fill className="object-cover" />
                        </div>
                    ) : (
                        <span className="text-2xl ...">{pictureUrl}</span>
                    )} */}
                    <div className="flex justify-between text-sm">
                        {isEditing ? (
                            <span className="text-gray-500 dark:text-gray-400 group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors">Item Received Date:</span>
                        ) : (
                            <span className="text-gray-500 dark:text-gray-400 group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors">Ownership Duration:</span>
                        )}
                        {isEditing ? (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-[240px] justify-start text-left font-normal"
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
                        ) : (
                            <span className="text-gray-900 dark:text-gray-100 group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors">{ownershipDuration}</span>
                        )}
                    </div>
                    {isEditing && (
                        <div className="mt-4 space-y-2">
                            <div className="flex justify-between items-center mt-4">
                                <div className="flex space-x-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleStatusChange('Keep');
                                        }}
                                        className={`px-3 py-1 rounded ${status === 'Keep'
                                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-teal-100 dark:hover:bg-teal-900 hover:text-teal-700 dark:hover:text-teal-300'
                                            }`}
                                    >
                                        Keep
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleStatusChange('Give');
                                        }}
                                        className={`px-3 py-1 rounded ${status === 'Give'
                                            ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-teal-100 dark:hover:bg-teal-900 hover:text-teal-700 dark:hover:text-teal-300'
                                            }`}
                                    >
                                        Give
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleStatusChange('Donate');
                                        }}
                                        className={`px-3 py-1 rounded ${status === 'Donate'
                                            ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-teal-100 dark:hover:bg-teal-900 hover:text-teal-700 dark:hover:text-teal-300'
                                            }`}
                                    >
                                        Donate
                                    </button>
                                </div>
                                <div className="flex space-x-4">
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
                        </div>
                    )}
                </div>
            )}
        </div>
    )
} 