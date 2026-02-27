'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { LocationTreeNode } from '@/types/location'
import { fetchLocationTree, createLocation, updateLocation, deleteLocation } from '@/utils/api'
import { toast } from 'sonner'
import { ChevronRight, Plus, Edit2, X, Check } from 'lucide-react'

export interface PendingLocationOperation {
    type: 'create' | 'update' | 'delete'
    payload: {
        displayName?: string
        parentId?: string | null
        locationId?: string
        newDisplayName?: string
    }
}

interface LocationTreePickerProps {
    selectedLocationId: string | null
    onLocationSelect: (locationId: string | null) => void
    variant?: 'standalone' | 'compact'
    stagingMode?: boolean
    onPendingOperationsChange?: (operations: PendingLocationOperation[]) => void
    initialPendingOperations?: PendingLocationOperation[]
    initialExpandedNodes?: Set<string> | string[]
    highlightedNodes?: Set<string>
}

export default function LocationTreePicker({
    selectedLocationId,
    onLocationSelect,
    variant = 'standalone',
    stagingMode = false,
    onPendingOperationsChange,
    initialPendingOperations = [],
    initialExpandedNodes,
    highlightedNodes
}: LocationTreePickerProps) {
    const { getToken } = useAuth()
    const [locations, setLocations] = useState<LocationTreeNode[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
        initialExpandedNodes instanceof Set
            ? initialExpandedNodes
            : new Set(initialExpandedNodes || [])
    )
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
    const [editingValue, setEditingValue] = useState('')
    const [creatingChildForId, setCreatingChildForId] = useState<string | null>(null)
    const [creatingRootLocation, setCreatingRootLocation] = useState(false)
    const [newLocationName, setNewLocationName] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [pendingOperations, setPendingOperations] = useState<PendingLocationOperation[]>(initialPendingOperations)

    const loadLocationTree = async () => {
        setLoading(true)
        try {
            const { data, error } = await fetchLocationTree(getToken)
            if (error) {
                console.error('Error fetching location tree:', error)
                toast.error('Failed to load locations')
                setLocations([])
            } else if (data) {
                setLocations(data)
                // If there are no locations, show the create root location form
                if (data.length === 0) {
                    setCreatingRootLocation(true)
                }
            }
        } catch (error) {
            console.error('Error loading location tree:', error)
            setLocations([])
        } finally {
            setLoading(false)
        }
    }

    // Fetch location tree on mount
    useEffect(() => {
        loadLocationTree()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Update expanded nodes when initialExpandedNodes changes
    useEffect(() => {
        if (initialExpandedNodes) {
            setExpandedNodes(
                initialExpandedNodes instanceof Set
                    ? initialExpandedNodes
                    : new Set(initialExpandedNodes)
            )
        }
    }, [initialExpandedNodes])

    // Initialize pending operations from parent on mount
    useEffect(() => {
        if (initialPendingOperations.length > 0) {
            setPendingOperations(initialPendingOperations)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Only run on mount

    // Notify parent of pending operations changes (skip initial empty state)
    useEffect(() => {
        if (stagingMode && onPendingOperationsChange) {
            // Don't notify parent on initial mount if we're just setting up with initialPendingOperations
            onPendingOperationsChange(pendingOperations)
        }
    }, [stagingMode, pendingOperations, onPendingOperationsChange])

    const handleToggleExpand = (nodeId: string) => {
        const newExpanded = new Set(expandedNodes)
        if (newExpanded.has(nodeId)) {
            newExpanded.delete(nodeId)
        } else {
            newExpanded.add(nodeId)
        }
        setExpandedNodes(newExpanded)
    }

    const handleCreateLocation = async (displayName: string, parentId: string | null) => {
        if (!displayName.trim()) {
            if (!stagingMode) {
                toast.error('Location name is required')
            }
            return
        }

        if (displayName.length > 100) {
            if (!stagingMode) {
                toast.error('Location name must be 100 characters or less')
            }
            return
        }

        // In staging mode, just add to pending operations
        if (stagingMode) {
            const newOperation: PendingLocationOperation = {
                type: 'create',
                payload: { displayName: displayName.trim(), parentId }
            }
            setPendingOperations(prev => [...prev, newOperation])

            // Clear form
            setNewLocationName('')
            setCreatingChildForId(null)
            setCreatingRootLocation(false)

            // Expand parent node if creating a child
            if (parentId) {
                setExpandedNodes(prev => new Set([...prev, parentId]))
            }
            return
        }

        setIsSubmitting(true)
        try {
            const { data, error } = await createLocation(displayName.trim(), parentId, getToken)
            if (error) {
                toast.error(`Failed to create location: ${error}`)
            } else if (data) {
                toast.success(`Location "${displayName}" created successfully`)
                // Refresh the tree
                await loadLocationTree()
                // Expand parent node if creating a child
                if (parentId) {
                    setExpandedNodes(prev => new Set([...prev, parentId]))
                }
                // Clear form
                setNewLocationName('')
                setCreatingChildForId(null)
                setCreatingRootLocation(false)
            }
        } catch (error) {
            console.error('Error creating location:', error)
            toast.error('Failed to create location')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleUpdateLocation = async (locationId: string, newDisplayName: string) => {
        if (!newDisplayName.trim()) {
            if (!stagingMode) {
                toast.error('Location name is required')
            }
            return
        }

        if (newDisplayName.length > 100) {
            if (!stagingMode) {
                toast.error('Location name must be 100 characters or less')
            }
            return
        }

        // In staging mode, just add to pending operations
        if (stagingMode) {
            const newOperation: PendingLocationOperation = {
                type: 'update',
                payload: { locationId, newDisplayName: newDisplayName.trim() }
            }
            setPendingOperations(prev => [...prev, newOperation])

            setEditingNodeId(null)
            setEditingValue('')
            return
        }

        setIsSubmitting(true)
        try {
            const { data, error } = await updateLocation(locationId, newDisplayName.trim(), getToken)
            if (error) {
                toast.error(`Failed to update location: ${error}`)
            } else if (data) {
                toast.success('Location updated successfully')
                // Refresh the tree
                await loadLocationTree()
                setEditingNodeId(null)
                setEditingValue('')
            }
        } catch (error) {
            console.error('Error updating location:', error)
            toast.error('Failed to update location')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteLocation = async (locationId: string, displayName: string) => {
        // In staging mode, just add to pending operations
        if (stagingMode) {
            const newOperation: PendingLocationOperation = {
                type: 'delete',
                payload: { locationId }
            }
            setPendingOperations(prev => [...prev, newOperation])
            return
        }

        setIsSubmitting(true)
        try {
            const { data, error } = await deleteLocation(locationId, getToken)
            if (error) {
                // Check if error mentions items or children
                if (error.includes('items') || error.includes('children')) {
                    toast.error('Cannot delete location with items or sub-locations')
                } else {
                    toast.error(`Failed to delete location: ${error}`)
                }
            } else if (data) {
                toast.success(`Location "${displayName}" deleted successfully`)
                // Refresh the tree
                await loadLocationTree()
            }
        } catch (error) {
            console.error('Error deleting location:', error)
            toast.error('Failed to delete location')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleStartEdit = (node: LocationTreeNode) => {
        setEditingNodeId(node.id)
        setEditingValue(node.display_name)
        setCreatingChildForId(null)
    }

    const handleCancelEdit = () => {
        setEditingNodeId(null)
        setEditingValue('')
    }

    const handleStartCreateChild = (nodeId: string) => {
        setCreatingChildForId(nodeId)
        setNewLocationName('')
        setEditingNodeId(null)
        // Expand the node to show where the child will appear
        setExpandedNodes(prev => new Set([...prev, nodeId]))
    }

    const handleCancelCreateChild = () => {
        setCreatingChildForId(null)
        setNewLocationName('')
    }

    // Helper function to find a node by ID recursively
    const findNodeById = (nodes: LocationTreeNode[], id: string): LocationTreeNode | null => {
        for (const node of nodes) {
            if (node.id === id) return node
            if (node.children) {
                const found = findNodeById(node.children, id)
                if (found) return found
            }
        }
        return null
    }

    // Apply pending operations to create a virtual tree for UI preview (only in staging mode)
    const getVirtualLocations = (): LocationTreeNode[] => {
        if (!stagingMode || pendingOperations.length === 0) {
            return locations
        }

        // Deep clone the locations tree
        const cloneTree = (nodes: LocationTreeNode[]): LocationTreeNode[] => {
            return nodes.map(node => ({
                ...node,
                children: node.children ? cloneTree(node.children) : []
            }))
        }

        const virtualTree = cloneTree(locations)
        const deletedIds = new Set<string>()
        const tempNodes: { [key: string]: LocationTreeNode } = {}

        // Process operations in order
        pendingOperations.forEach((op, index) => {
            if (op.type === 'create') {
                const { displayName, parentId } = op.payload
                // Create a temporary node
                const tempId = `temp-create-${index}`
                const parentNode = parentId ? findNodeById(virtualTree, parentId) : null
                const slugPart = displayName!.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                const newNode: LocationTreeNode = {
                    id: tempId,
                    slug: parentNode?.slug ? `${parentNode.slug}/${slugPart}` : slugPart,
                    display_name: displayName!,
                    full_path: parentNode
                        ? `${parentNode.full_path}/${displayName}`
                        : displayName!,
                    level: parentNode ? parentNode.level + 1 : 0,
                    parent_id: parentId || null,
                    children: []
                }
                tempNodes[tempId] = newNode

                // Add to parent or root
                if (parentId) {
                    const addToParent = (nodes: LocationTreeNode[]): boolean => {
                        for (const node of nodes) {
                            if (node.id === parentId) {
                                node.children = [...(node.children || []), newNode]
                                return true
                            }
                            if (node.children && addToParent(node.children)) {
                                return true
                            }
                        }
                        return false
                    }
                    addToParent(virtualTree)
                } else {
                    virtualTree.push(newNode)
                }
            } else if (op.type === 'update') {
                const { locationId, newDisplayName } = op.payload
                const updateNode = (nodes: LocationTreeNode[]): boolean => {
                    for (const node of nodes) {
                        if (node.id === locationId) {
                            node.display_name = newDisplayName!
                            // Update full_path and slug for this node and all children
                            const updatePaths = (n: LocationTreeNode, parentPath?: string, parentSlug?: string) => {
                                const slugPart = n.display_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                                n.full_path = parentPath
                                    ? `${parentPath}/${n.display_name}`
                                    : n.display_name
                                n.slug = parentSlug
                                    ? `${parentSlug}/${slugPart}`
                                    : slugPart
                                n.children?.forEach(child => updatePaths(child, n.full_path, n.slug))
                            }
                            const parent = node.parent_id ? findNodeById(virtualTree, node.parent_id) : null
                            updatePaths(node, parent?.full_path, parent?.slug)
                            return true
                        }
                        if (node.children && updateNode(node.children)) {
                            return true
                        }
                    }
                    return false
                }
                updateNode(virtualTree)
            } else if (op.type === 'delete') {
                const { locationId } = op.payload
                deletedIds.add(locationId!)
            }
        })

        // Filter out deleted nodes
        const filterDeleted = (nodes: LocationTreeNode[]): LocationTreeNode[] => {
            return nodes
                .filter(node => !deletedIds.has(node.id))
                .map(node => ({
                    ...node,
                    children: node.children ? filterDeleted(node.children) : []
                }))
        }

        return filterDeleted(virtualTree)
    }

    const virtualLocations = getVirtualLocations()

    // Get selected location node from virtual tree
    const selectedNode = selectedLocationId ? findNodeById(virtualLocations, selectedLocationId) : null

    const renderLocationNode = (node: LocationTreeNode, level: number = 0) => {
        const isExpanded = expandedNodes.has(node.id)
        const isSelected = selectedLocationId === node.id
        const isHighlighted = highlightedNodes?.has(node.id)
        const isEditing = editingNodeId === node.id
        const isCreatingChild = creatingChildForId === node.id
        const hasChildren = node.children && node.children.length > 0
        const isPending = node.id.startsWith('temp-') // Check if this is a temporary node

        // Check if this node has pending updates
        const hasUpdate = stagingMode && pendingOperations.some(
            op => op.type === 'update' && op.payload.locationId === node.id
        )

        return (
            <div key={node.id} className="select-none">
                <div
                    className={`flex items-center justify-between py-2 px-3 rounded-md transition-colors group ${isSelected
                        ? 'bg-teal-100 dark:bg-teal-900 text-teal-900 dark:text-teal-100'
                        : isHighlighted
                            ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        } ${isPending ? 'opacity-70 italic' : ''}`}
                    style={{ paddingLeft: `${level * 12 + 12}px` }}
                >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Chevron for expand/collapse */}
                        {hasChildren ? (
                            <button
                                type="button"
                                onClick={() => handleToggleExpand(node.id)}
                                className="flex-shrink-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                <ChevronRight
                                    className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''
                                        }`}
                                />
                            </button>
                        ) : (
                            <div className="w-4 h-4 flex-shrink-0"></div>
                        )}

                        {/* Location name or edit input */}
                        {isEditing ? (
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <input
                                    type="text"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleUpdateLocation(node.id, editingValue)
                                        } else if (e.key === 'Escape') {
                                            handleCancelEdit()
                                        }
                                    }}
                                    disabled={isSubmitting}
                                />
                                <button
                                    type="button"
                                    onClick={() => handleUpdateLocation(node.id, editingValue)}
                                    disabled={isSubmitting}
                                    className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 disabled:opacity-50"
                                >
                                    <Check className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    disabled={isSubmitting}
                                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => onLocationSelect(node.id)}
                                className="flex-1 text-left text-sm font-medium text-gray-900 dark:text-white truncate"
                            >
                                {node.display_name}
                                {isPending && (
                                    <span className="ml-2 text-xs text-teal-600 dark:text-teal-400">(pending)</span>
                                )}
                                {hasUpdate && (
                                    <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">(edited)</span>
                                )}
                            </button>
                        )}

                        {/* Item count badge */}
                        {/* {!isEditing && (
                            <span className="flex-shrink-0 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">
                                {node.children?.reduce((sum, child) => {
                                    const countChildren = (n: LocationTreeNode): number => {
                                        return (n.children?.reduce((s, c) => s + countChildren(c), 0) || 0)
                                    }
                                    return sum + countChildren(child)
                                }, 0) || 0} items
                            </span>
                        )} */}
                    </div>

                    {/* Action icons (show on hover) */}
                    {!isEditing && !isSubmitting && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleStartCreateChild(node.id)
                                }}
                                className="p-1 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded"
                                title="Add child location"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleStartEdit(node)
                                }}
                                className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                title="Edit location"
                            >
                                <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteLocation(node.id, node.display_name)
                                }}
                                disabled={hasChildren}
                                className={`p-1 rounded ${hasChildren
                                    ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50'
                                    : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
                                    }`}
                                title={hasChildren ? 'Cannot delete location with sub-locations' : 'Delete location'}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Create child input (show below parent) */}
                {isCreatingChild && (
                    <div
                        className="flex items-center gap-2 py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-md mt-1"
                        style={{ paddingLeft: `${(level + 1) * 12 + 12}px` }}
                    >
                        <div className="w-4 h-4 flex-shrink-0"></div>
                        <input
                            type="text"
                            value={newLocationName}
                            onChange={(e) => setNewLocationName(e.target.value)}
                            placeholder="New location name..."
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleCreateLocation(newLocationName, node.id)
                                } else if (e.key === 'Escape') {
                                    handleCancelCreateChild()
                                }
                            }}
                            disabled={isSubmitting}
                        />
                        <button
                            type="button"
                            onClick={() => handleCreateLocation(newLocationName, node.id)}
                            disabled={isSubmitting}
                            className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 disabled:opacity-50"
                        >
                            <Check className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={handleCancelCreateChild}
                            disabled={isSubmitting}
                            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* Render children */}
                {isExpanded && hasChildren && (
                    <div className="mt-1">
                        {node.children.map((child) => renderLocationNode(child, level + 1))}
                    </div>
                )}
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
            </div>
        )
    }

    return (
        <div className={`${variant === 'compact' ? 'max-h-80 overflow-y-auto' : ''}`}>
            {/* Empty state - create first root location */}
            {virtualLocations.length === 0 && creatingRootLocation ? (
                <div className="space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Create your first location to organize your items
                    </p>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={newLocationName}
                            onChange={(e) => setNewLocationName(e.target.value)}
                            placeholder="e.g., Home, Office, Storage..."
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleCreateLocation(newLocationName, null)
                                }
                            }}
                            disabled={isSubmitting}
                        />
                        <button
                            type="button"
                            onClick={() => handleCreateLocation(newLocationName, null)}
                            disabled={isSubmitting || !newLocationName.trim()}
                            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Create
                        </button>
                    </div>
                </div>
            ) : virtualLocations.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        No locations yet
                    </p>
                    <button
                        type="button"
                        onClick={() => setCreatingRootLocation(true)}
                        className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
                    >
                        Create your first location
                    </button>
                </div>
            ) : (
                <div className="space-y-1">
                    {/* Selected location path display */}
                    {selectedNode && (
                        <div className="mb-3 p-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg">
                            <div className="text-xs text-teal-700 dark:text-teal-300 font-medium mb-1">
                                Selected Location:
                            </div>
                            <div className="text-sm text-teal-900 dark:text-teal-100 font-medium">
                                {selectedNode.full_path.split('/').join(' › ')}
                            </div>
                            <div className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                                {selectedNode.slug}
                            </div>
                        </div>
                    )}

                    {/* Clear selection button */}
                    {selectedLocationId && (
                        <button
                            type="button"
                            onClick={() => onLocationSelect(null)}
                            className="w-full text-left text-sm text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 px-3 py-2"
                        >
                            Clear selection
                        </button>
                    )}

                    {/* Render tree */}
                    {virtualLocations.map((node) => renderLocationNode(node, 0))}

                    {/* Add root location button */}
                    <button
                        type="button"
                        onClick={() => {
                            setCreatingRootLocation(true)
                            setCreatingChildForId(null)
                            setEditingNodeId(null)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-md transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Add root location
                    </button>

                    {/* Create root location input */}
                    {creatingRootLocation && virtualLocations.length > 0 && (
                        <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                            <input
                                type="text"
                                value={newLocationName}
                                onChange={(e) => setNewLocationName(e.target.value)}
                                placeholder="New root location..."
                                className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleCreateLocation(newLocationName, null)
                                    } else if (e.key === 'Escape') {
                                        setCreatingRootLocation(false)
                                        setNewLocationName('')
                                    }
                                }}
                                disabled={isSubmitting}
                            />
                            <button
                                type="button"
                                onClick={() => handleCreateLocation(newLocationName, null)}
                                disabled={isSubmitting}
                                className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 disabled:opacity-50"
                            >
                                <Check className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setCreatingRootLocation(false)
                                    setNewLocationName('')
                                }}
                                disabled={isSubmitting}
                                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
