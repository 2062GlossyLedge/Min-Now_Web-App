'use client'

import { useState } from 'react'

interface FilterBarProps {
    selectedType: string | null
    onTypeChange: (type: string | null) => void
}

export default function FilterBar({ selectedType, onTypeChange }: FilterBarProps) {
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
                            {itemTypeDisplayNames[type]}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
} 