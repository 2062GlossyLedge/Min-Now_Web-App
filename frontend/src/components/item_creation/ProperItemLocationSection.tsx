'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDownIcon, ChevronRightIcon, Loader2 } from 'lucide-react'
import { fetchLocationTree, createLocation, type LocationTreeNode } from '@/utils/api'

function flattenTree(nodes: LocationTreeNode[], out: { id: string; full_path: string; display_name: string }[] = []): { id: string; full_path: string; display_name: string }[] {
    for (const n of nodes) {
        out.push({ id: n.id, full_path: n.full_path, display_name: n.display_name })
        if (n.children?.length) flattenTree(n.children, out)
    }
    return out
}

function formatPathDisplay(path: string): string {
    return path.replace(/\//g, ' > ')
}

interface ProperItemLocationSectionProps {
    value: string | null
    onChange: (value: string | null) => void
    getToken: () => Promise<string | null>
}

export default function ProperItemLocationSection({ value, onChange, getToken }: ProperItemLocationSectionProps) {
    const [locationView, setLocationView] = useState<'dropdown' | 'tree'>('dropdown')
    const [treeOpen, setTreeOpen] = useState<Record<string, boolean>>({})
    const [parentPickerOpen, setParentPickerOpen] = useState<Record<string, boolean>>({})
    const [tree, setTree] = useState<LocationTreeNode[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [createDropdownOpen, setCreateDropdownOpen] = useState(false)
    const [createBreadcrumb, setCreateBreadcrumb] = useState<Array<{ id: string; display_name: string; full_path: string }>>([])
    const [createName, setCreateName] = useState('')
    const [createParentId, setCreateParentId] = useState<string | null>(null)
    const [createSubmitting, setCreateSubmitting] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)
    const createPanelRef = useRef<HTMLDivElement>(null)
    const locationSelectRef = useRef<HTMLDivElement>(null)
    const lastCreatedIdRef = useRef<string | null>(null)
    const [locationSelectOpen, setLocationSelectOpen] = useState(false)

    const loadTree = useCallback(async () => {
        setLoading(true)
        setError(null)
        const { data, error: err } = await fetchLocationTree(getToken)
        setLoading(false)
        if (err) {
            setError(err)
            setTree([])
            return
        }
        setTree(data ?? [])
    }, [getToken])

    useEffect(() => {
        loadTree()
    }, [loadTree])

    const flat = flattenTree(tree)
    const found = value ? flat.find((f) => f.id === value) : null
    const selectedPath = found ? found.full_path : null

    const toggleTreeBranch = (id: string) => {
        setTreeOpen((prev) => {
            const next = { ...prev }
            next[id] = !prev[id]
            return next
        })
    }

    const toggleParentPickerBranch = (id: string) => {
        setParentPickerOpen((prev) => {
            const next = { ...prev }
            next[id] = !prev[id]
            return next
        })
    }

    useEffect(() => {
        if (!createDropdownOpen) return
        const handleClickOutside = (e: MouseEvent) => {
            if (createPanelRef.current && !createPanelRef.current.contains(e.target as Node)) {
                setCreateDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [createDropdownOpen])

    useEffect(() => {
        if (!locationSelectOpen) return
        const handleClickOutside = (e: MouseEvent) => {
            if (locationSelectRef.current && !locationSelectRef.current.contains(e.target as Node)) {
                setLocationSelectOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [locationSelectOpen])

    const renderLocationTree = (nodes: LocationTreeNode[], onSelectAndClose?: () => void) => {
        return nodes.map((node) => {
            const hasChildren = node.children && node.children.length > 0
            const isOpen = treeOpen[node.id] ?? false
            const isSelected = value === node.id
            return (
                <div key={node.id} className="pl-4">
                    <button
                        type="button"
                        onClick={() => {
                            if (hasChildren) toggleTreeBranch(node.id)
                            onChange(node.id)
                            onSelectAndClose?.()
                        }}
                        className={`flex items-center gap-1 py-0.5 mb-0.5 w-full text-left rounded ${isSelected ? 'bg-gray-200 dark:bg-white/20' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                    >
                        {hasChildren ? (
                            <span className="px-0.5 flex-shrink-0">
                                {isOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                            </span>
                        ) : (
                            <span className="w-5 flex-shrink-0" />
                        )}
                        <span className="flex-1 text-sm py-1 px-2">{node.display_name}</span>
                    </button>
                    {hasChildren && isOpen && (
                        <div className="border-l border-gray-200 dark:border-gray-600 ml-2">
                            {renderLocationTree(node.children!, onSelectAndClose)}
                        </div>
                    )}
                </div>
            )
        })
    }

    const renderParentPickerTree = (nodes: LocationTreeNode[]) => {
        return nodes.map((node) => {
            const hasChildren = node.children && node.children.length > 0
            const isOpen = parentPickerOpen[node.id] ?? false
            const isSelected = createParentId === node.id
            return (
                <div key={node.id} className="pl-3">
                    <button
                        type="button"
                        onClick={() => {
                            if (hasChildren) toggleParentPickerBranch(node.id)
                            setCreateParentId(node.id)
                        }}
                        className={`flex items-center gap-1 py-1 mb-0.5 w-full text-left rounded text-sm ${isSelected ? 'bg-gray-200 dark:bg-white/20' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                    >
                        {hasChildren ? (
                            <span className="flex-shrink-0">
                                {isOpen ? <ChevronDownIcon className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
                            </span>
                        ) : (
                            <span className="w-[14px] flex-shrink-0" />
                        )}
                        <span className="flex-1 py-0.5 px-1.5">{node.display_name}</span>
                    </button>
                    {hasChildren && isOpen && (
                        <div className="border-l border-gray-200 dark:border-gray-600 ml-1.5">
                            {renderParentPickerTree(node.children!)}
                        </div>
                    )}
                </div>
            )
        })
    }

    const handleCreateSave = async () => {
        const name = createName.trim()
        if (!name) {
            setCreateError('Enter a name')
            return
        }
        const currentRoomId = createBreadcrumb.length > 0 ? createBreadcrumb[createBreadcrumb.length - 1].id : null
        const parentIdToSend = currentRoomId ?? createParentId ?? lastCreatedIdRef.current
        setCreateSubmitting(true)
        setCreateError(null)
        const { data, error: err } = await createLocation(
            { display_name: name, parent_id: parentIdToSend || undefined },
            getToken
        )
        setCreateSubmitting(false)
        if (err) {
            setCreateError(err)
            return
        }
        if (data) {
            lastCreatedIdRef.current = data.id
            setCreateParentId(data.id)
            setCreateBreadcrumb((prev) => [...prev, { id: data.id, display_name: data.display_name, full_path: data.full_path }])
            setCreateName('')
            setCreateError(null)
            await loadTree()
        }
    }

    const handleCreateFinish = () => {
        if (createBreadcrumb.length > 0) {
            onChange(createBreadcrumb[createBreadcrumb.length - 1].id)
        }
        setCreateDropdownOpen(false)
        setCreateBreadcrumb([])
        setCreateName('')
        setCreateParentId(null)
        setCreateError(null)
        lastCreatedIdRef.current = null
    }

    const openCreateDropdown = () => {
        setCreateDropdownOpen(true)
        setCreateBreadcrumb([])
        setCreateName('')
        setCreateParentId(null)
        setCreateError(null)
        lastCreatedIdRef.current = null
    }

    const selectedParentPath = createParentId ? flat.find((f) => f.id === createParentId)?.full_path : null

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Item location</label>
            <div className="flex flex-wrap items-center gap-2 mb-2">
                <button
                    type="button"
                    onClick={() => setLocationView('dropdown')}
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
                <button
                    type="button"
                    onClick={() => (createDropdownOpen ? setCreateDropdownOpen(false) : openCreateDropdown())}
                    className="inline-flex items-center gap-1.5 px-3 py-2 ml-auto rounded-md text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-teal-100 dark:hover:bg-teal-800 hover:text-teal-700 dark:hover:text-teal-300"
                >
                    Create New
                </button>
            </div>
            <div className="mb-2 relative" ref={createPanelRef}>
                {createDropdownOpen && (
                    <div className="absolute left-0 top-full mt-1 z-20 w-full min-w-[320px] max-w-md rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-3 px-3">
                        {createBreadcrumb.length > 0 && (
                            <div className="mb-3 pb-2 border-b border-gray-200 dark:border-gray-600">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">You&apos;re here: </span>
                                <span className="text-sm text-teal-700 dark:text-teal-300">
                                    {createBreadcrumb.map((b) => b.display_name).join(' › ')}
                                </span>
                            </div>
                        )}
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Location name</label>
                                <input
                                    type="text"
                                    value={createName}
                                    onChange={(e) => { setCreateName(e.target.value); setCreateError(null) }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            handleCreateSave()
                                        }
                                    }}
                                    placeholder="e.g. Living room"
                                    className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-teal-500"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Parent room (optional)</label>
                                <div className="rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 overflow-hidden">
                                    <div className="max-h-40 overflow-y-auto p-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setCreateParentId(null)}
                                            className={`w-full text-left text-sm py-1.5 px-2 rounded ${createParentId === null ? 'bg-gray-200 dark:bg-white/20' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                        >
                                            None (top level)
                                        </button>
                                        {renderParentPickerTree(tree)}
                                    </div>
                                    {selectedParentPath && (
                                        <div className="px-2 py-1.5 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 truncate">
                                            Selected: {selectedParentPath}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-orange-500 dark:text-orange-400 mb-2">Once Location is created, it cannot be deleted.</p>
                            {createError && <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>}
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    disabled={createSubmitting || !createName.trim()}
                                    onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        handleCreateSave()
                                    }}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    {createSubmitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                                            Saving…
                                        </>
                                    ) : (
                                        'Save'
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                            <button
                                type="button"
                                onClick={handleCreateFinish}
                                disabled={createBreadcrumb.length === 0}
                                className="w-full px-4 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:pointer-events-none"
                            >
                                Finish and use this room
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="mt-1 py-4 text-sm text-gray-500 dark:text-gray-400">Loading locations…</div>
            ) : error ? (
                <div className="mt-1 py-2 text-sm text-red-600 dark:text-red-400">{error}</div>
            ) : locationView === 'dropdown' ? (
                <div className="mt-1 relative" ref={locationSelectRef}>
                    <button
                        type="button"
                        onClick={() => setLocationSelectOpen((o) => !o)}
                        className="flex items-center justify-between w-full rounded-md border border-gray-300 dark:border-gray-600 shadow-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-3 text-left text-sm hover:border-teal-500 dark:hover:border-teal-600 focus:border-teal-500 focus:ring-teal-500"
                    >
                        <span className="truncate">{selectedPath ? formatPathDisplay(selectedPath) : 'No location'}</span>
                        <ChevronDownIcon className={`h-4 w-4 flex-shrink-0 ml-2 transition-transform ${locationSelectOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {locationSelectOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1 max-h-64 overflow-y-auto">
                            <button
                                type="button"
                                onClick={() => { onChange(null); setLocationSelectOpen(false) }}
                                className={`w-full text-left text-sm py-1.5 px-3 rounded mx-0.5 font-medium ${value === null ? 'bg-gray-200 dark:bg-white/20' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                            >
                                No location
                            </button>
                            {flat.map((f) => (
                                <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => { onChange(f.id); setLocationSelectOpen(false) }}
                                    className={`w-full text-left text-sm py-1.5 px-3 rounded mx-0.5 truncate ${value === f.id ? 'bg-gray-200 dark:bg-white/20' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                >
                                    {formatPathDisplay(f.full_path)}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="mt-1 rounded-md border border-gray-300 dark:border-gray-600 p-2 max-h-64 overflow-y-auto">
                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        className={`w-full text-left text-sm py-1.5 mb-0.5 px-2 rounded font-medium ${value === null ? 'bg-gray-200 dark:bg-white/20' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                    >
                        No location
                    </button>
                    {renderLocationTree(tree)}
                </div>
            )}

            {!loading && !error && (
                <div className="mt-3 rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2">
                    <span className="text-sm text-teal-700 dark:text-teal-300">Selected: </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{selectedPath ? formatPathDisplay(selectedPath) : 'No location'}</span>
                </div>
            )}
        </div>
    )
}
