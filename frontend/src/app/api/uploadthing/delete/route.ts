import "server-only"

import { NextRequest, NextResponse } from 'next/server'
import { utapi } from '@/server/uploadthing'
import { auth } from '@clerk/nextjs/server'

export async function POST(request: NextRequest) {
    try {
        // Check if user is authenticated
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { fileKey } = body

        if (!fileKey) {
            return NextResponse.json({ error: 'File key is required' }, { status: 400 })
        }

        // Delete the file from uploadthing
        await utapi.deleteFiles(fileKey)

        return NextResponse.json({ success: true, message: 'File deleted successfully' })
    } catch (error) {
        console.error('Error deleting file from uploadthing:', error)
        return NextResponse.json(
            { error: 'Failed to delete file from uploadthing' },
            { status: 500 }
        )
    }
}
