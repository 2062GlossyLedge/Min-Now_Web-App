'use client'

import { useState } from 'react'

interface FilterBarProps {
    selectedType: string | null
    onTypeChange: (type: string | null) => void
}

export default function FilterBar({ selectedType, onTypeChange }: FilterBarProps) {
    // Match exactly with backend ItemType choices
    const itemTypes = [
        'Clothing',
        'Technology',
        'Household Item',
        'Vehicle',
        'Other'
    ] as const

    const handleFilterClick = (type: string) => {
        // If the selected type is the same as the clicked type, clear the selection
        if (selectedType === type) {
            onTypeChange(null)
        } else {
            onTypeChange(type)
        }
    }

    return (
        <div className="mb-8">
            <div className="overflow-x-auto whitespace-nowrap py-2">
                <div className="flex space-x-2 px-4">
                    {itemTypes.map((type) => (
                        <button
                            key={type}
                            onClick={() => handleFilterClick(type)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors
                                ${selectedType === type
                                    ? 'bg-teal-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-teal-100 dark:hover:bg-teal-900 hover:text-teal-700 dark:hover:text-teal-300'
                                }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
} 