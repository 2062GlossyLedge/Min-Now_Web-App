import { LocationTreeNode } from '@/types/location'
import { ItemSearchResult } from '@/types/item'

/**
 * Recursively find all ancestor IDs from root to the target location
 * Returns array of IDs in order from root to target (inclusive)
 */
export function findAncestorIds(
    locationId: string,
    tree: LocationTreeNode[],
    path: string[] = []
): string[] | null {
    for (const node of tree) {
        if (node.id === locationId) {
            return [...path, node.id]
        }

        if (node.children && node.children.length > 0) {
            const found = findAncestorIds(locationId, node.children, [...path, node.id])
            if (found) {
                return found
            }
        }
    }

    return null
}

/**
 * Build a set of all ancestor IDs for multiple locations
 * Useful for expanding tree to show multiple search results
 */
export function buildExpandedSet(
    locationIds: string[],
    tree: LocationTreeNode[]
): Set<string> {
    const expandedSet = new Set<string>()

    for (const locationId of locationIds) {
        const ancestors = findAncestorIds(locationId, tree)
        if (ancestors) {
            ancestors.forEach(id => expandedSet.add(id))
        }
    }

    return expandedSet
}

/**
 * Group items by their location ID
 * Returns a Map where keys are location IDs and values are arrays of items
 */
export function groupItemsByLocation(
    items: ItemSearchResult[]
): Map<string, ItemSearchResult[]> {
    const grouped = new Map<string, ItemSearchResult[]>()

    for (const item of items) {
        // Skip items without a location
        if (!item.currentLocationId) {
            continue
        }

        const locationId = item.currentLocationId
        if (!grouped.has(locationId)) {
            grouped.set(locationId, [])
        }

        grouped.get(locationId)!.push(item)
    }

    return grouped
}

/**
 * Find a location node by ID in the tree
 */
export function findNodeById(
    tree: LocationTreeNode[],
    id: string
): LocationTreeNode | null {
    for (const node of tree) {
        if (node.id === id) {
            return node
        }

        if (node.children && node.children.length > 0) {
            const found = findNodeById(node.children, id)
            if (found) {
                return found
            }
        }
    }

    return null
}
