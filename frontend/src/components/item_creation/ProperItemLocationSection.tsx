'use client'

import { useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react'

export type LocationNode = { name: string; children?: LocationNode[] }

export const DEFAULT_LOCATION = 'Home'

const LOCATION_TREE: LocationNode[] = [
    {
        name: '1st Floor',
        children: [
            {
                name: 'Living Room',
                children: [
                    { name: 'Coffee Table' },
                    { name: 'TV Stand' }
                ]
            },
            {
                name: 'Kitchen',
                children: [
                    { name: 'Upper Cabinets' },
                    { name: 'Lower Cabinets' },
                    { name: 'Pantry' }
                ]
            }
        ]
    },
    {
        name: '2nd Floor',
        children: [
            {
                name: 'Master Bedroom',
                children: [
                    {
                        name: 'Closet',
                        children: [
                            { name: 'Top Shelf' },
                            { name: 'Middle Shelf' },
                            { name: 'Bottom Shelf' }
                        ]
                    },
                    { name: 'Dresser' }
                ]
            },
            {
                name: 'Guest Bedroom',
                children: [
                    { name: 'Closet' },
                    { name: 'Nightstand' }
                ]
            }
        ]
    },
    {
        name: '3rd Floor',
        children: [
            {
                name: 'Master Bedroom',
                children: [
                    {
                        name: 'Closet',
                        children: [
                            { name: 'Top Shelf' },
                            { name: 'Middle Shelf' },
                            { name: 'Bottom Shelf' }
                        ]
                    }
                ]
            },
            {
                name: 'Office',
                children: [
                    { name: 'Desk' },
                    { name: 'Filing Cabinet' }
                ]
            }
        ]
    },
    {
        name: 'Garage',
        children: [
            { name: 'Tool Bench' },
            { name: 'Storage Shelves' }
        ]
    },
    {
        name: 'Basement',
        children: [
            { name: 'Storage Room' },
            { name: 'Laundry Room' }
        ]
    }
]

function getLocationKey(path: string[]) {
    return path.join(' > ')
}

interface ProperItemLocationSectionProps {
    value: string
    onChange: (value: string) => void
}

export default function ProperItemLocationSection({ value, onChange }: ProperItemLocationSectionProps) {
    const [locationView, setLocationView] = useState<'dropdown' | 'tree'>('dropdown')
    const [treeOpen, setTreeOpen] = useState<Record<string, boolean>>({})

    const toggleTreeBranch = (path: string[]) => {
        const key = getLocationKey(path)
        setTreeOpen(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const handleDropdownView = () => {
        setLocationView('dropdown')
        onChange(DEFAULT_LOCATION)
    }

    const renderLocationTree = (nodes: LocationNode[], path: string[] = []) => {
        return nodes.map((node) => {
            const nodePath = [...path, node.name]
            const key = getLocationKey(nodePath)
            const hasChildren = node.children && node.children.length > 0
            const isOpen = treeOpen[key] ?? false
            const isSelected = value === key
            return (
                <div key={key} className="pl-4">
                    <button
                        type="button"
                        onClick={() => {
                            if (hasChildren) toggleTreeBranch(nodePath)
                            onChange(key)
                        }}
                        className={`flex items-center gap-1 py-0.5 mb-0.5 w-full text-left rounded ${isSelected ? 'bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-100/50 dark:hover:bg-gray-700/40'}`}
                    >
                        {hasChildren ? (
                            <span className="px-0.5 flex-shrink-0">
                                {isOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                            </span>
                        ) : (
                            <span className="w-5 flex-shrink-0" />
                        )}
                        <span className="flex-1 text-sm py-1 px-2">{node.name}</span>
                    </button>
                    {hasChildren && isOpen && (
                        <div className="border-l border-gray-200 dark:border-gray-600 ml-2">
                            {renderLocationTree(node.children!, nodePath)}
                        </div>
                    )}
                </div>
            )
        })
    }

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Proper Item Location</label>
            <div className="flex items-center gap-2 mb-2">
                <button
                    type="button"
                    onClick={handleDropdownView}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${locationView === 'dropdown' ? 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                >
                    Dropdown View
                </button>
                <button
                    type="button"
                    onClick={() => setLocationView('tree')}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${locationView === 'tree' ? 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                >
                    Tree View
                </button>
            </div>
            {locationView === 'dropdown' ? (
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-teal-500 focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3"
                >
                    <option value={DEFAULT_LOCATION}>{DEFAULT_LOCATION}</option>
                </select>
            ) : (
                <div className="mt-1 rounded-md border border-gray-300 dark:border-gray-600 p-2 max-h-64 overflow-y-auto">
                    <button
                        type="button"
                        onClick={() => onChange(DEFAULT_LOCATION)}
                        className={`w-full text-left text-sm py-1.5 mb-0.5 px-2 rounded font-medium ${value === DEFAULT_LOCATION ? 'bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-100/50 dark:hover:bg-gray-700/40'}`}
                    >
                        {DEFAULT_LOCATION}
                    </button>
                    {renderLocationTree(LOCATION_TREE, [DEFAULT_LOCATION])}
                </div>
            )}
            <div className="mt-3 rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2">
                <span className="text-sm text-teal-700 dark:text-teal-300">Selected: </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{value}</span>
            </div>
        </div>
    )
}
