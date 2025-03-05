import { NextResponse } from 'next/server';
import { getUserCasts } from '@/lib/neynar-api';

export const dynamic = 'force-dynamic'; // Ensure route is not cached

/**
 * GET handler for the /api/casts route
 * Fetches top-level casts for a specific user FID from Neynar API
 * 
 * @param {Request} request - The request object
 * @returns {NextResponse} - JSON response with casts data
 */
export async function GET(request) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    const limitParam = searchParams.get('limit');
    
    // Validate FID
    if (!fid) {
      return NextResponse.json(
        { error: 'User FID is required' },
        { status: 400 }
      );
    }

    // Parse and validate limit
    let limit = 600; // Default to 600 casts (4 pages of 150)
    if (limitParam) {
      limit = parseInt(limitParam, 10);
      if (isNaN(limit) || limit < 1 || limit > 600) {
        return NextResponse.json(
          { error: 'Limit must be a number between 1 and 600' },
          { status: 400 }
        );
      }
    }

    // Fetch casts from Neynar API
    const casts = await getUserCasts(parseInt(fid, 10), limit);
    
    // Return the casts
    return NextResponse.json({ casts });
    
  } catch (error) {
    console.error('Error in casts API route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch casts' },
      { status: 500 }
    );
  }
} 