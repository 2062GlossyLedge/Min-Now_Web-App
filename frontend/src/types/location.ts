export interface LocationTreeNode {
    id: string
    slug: string
    display_name: string
    full_path: string
    level: number
    parent_id: string | null
    children: LocationTreeNode[]
}

export interface LocationSearchResult {
    id: string
    slug: string
    display_name: string
    full_path: string
    level: number
    item_count: number
    item_names: string[]
}

export interface Location {
    id: string
    slug: string
    display_name: string
    full_path: string
    parent_id: string | null
    level: number
    item_count: number
    created_at: string
    updated_at: string
}
