'use client'

import { ItemSearchResult } from '@/types/item'
import { MapPin } from 'lucide-react'
import Image from 'next/image'

interface LocationItemCardProps {
    locationPath: string
    items: ItemSearchResult[]
}

export default function LocationItemCard({ locationPath, items }: LocationItemCardProps) {
    // Function to check if the pictureUrl is a valid image URL (http or /)
    const isImageUrl = (str: string) => {
        return typeof str === 'string' && (str.startsWith('http') || str.startsWith('/'));
    }

    const renderItemPicture = (item: ItemSearchResult) => {
        // Check if it's an image URL
        if (item.pictureUrl && isImageUrl(item.pictureUrl)) {
            // It's an image URL
            return (
                <div className="w-8 h-8 relative bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                    <Image
                        src={item.pictureUrl}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="32px"
                    />
                </div>
            )
        }

        // Otherwise treat it as emoji/text (supports single or multiple emojis)
        return (
            <div className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded text-xl">
                {item.pictureUrl || '📷'}
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-4 mb-3 border border-gray-200 dark:border-gray-800">
            {/* Location header */}
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                <MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                    {locationPath}
                </span>
                <span className="text-xs bg-teal-100 dark:bg-teal-900 text-teal-900 dark:text-teal-100 px-2 py-0.5 rounded ml-auto flex-shrink-0">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
            </div>

            {/* Items list */}
            <div className="space-y-2">
                {items.map(item => (
                    <div
                        key={item.id}
                        className="flex items-center gap-3 pl-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        {renderItemPicture(item)}
                        <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-900 dark:text-white truncate block">
                                {item.name}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
