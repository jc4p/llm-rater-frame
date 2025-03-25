import { NextResponse } from 'next/server';
import { gemini } from '@/lib/gemini';
import { openai } from '@/lib/openai';
import { anthropic } from '@/lib/anthropic';
import { getUserCasts } from '@/lib/neynar-api';

// Configure with longer timeout using an environment variable
// Vercel will use VERCEL_FUNCTION_TIMEOUT environment variable for the timeout value
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * Generate AI-powered hints about a Farcaster user based on their profile and recent casts.
 * 
 * @param {object} request - The incoming request object
 * @returns {NextResponse} - JSON response with hints or error
 */
export async function GET(request) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    const limit = parseInt(searchParams.get('limit') || '150', 10);
    const model = searchParams.get('model') || 'gemini'; // Default to gemini
    
    // Validate fid parameter
    if (!fid) {
      return NextResponse.json(
        { error: 'Missing required parameter: fid' },
        { status: 400 }
      );
    }
    
    // Validate limit parameter
    if (isNaN(limit) || limit < 1 || limit > 600) {
      return NextResponse.json(
        { error: 'Limit must be a number between 1 and 600' },
        { status: 400 }
      );
    }

    // Validate model parameter
    if (!['gemini', 'openai', 'anthropic'].includes(model)) {
      return NextResponse.json(
        { error: 'Invalid model parameter. Must be either "gemini", "openai", or "anthropic"' },
        { status: 400 }
      );
    }
    
    // Fetch user's casts from Neynar API
    const castData = await getUserCasts(fid, limit);
    
    if (!castData || !castData.casts || !castData.casts.length) {
      return NextResponse.json(
        { error: 'No casts found for the specified user' },
        { status: 404 }
      );
    }
    
    // Extract basic profile information from the casts
    const firstCast = castData.casts[0];
    const profile = {
      fid: parseInt(fid),
      username: firstCast.author.username,
      displayName: firstCast.author.display_name,
      pfp: firstCast.author.pfp_url,
      bio: firstCast.author.profile?.bio || '',
      followerCount: firstCast.author.follower_count,
      followingCount: firstCast.author.following_count
    };
    
    // Generate hints using the requested model
    let hints;
    let isRetrying = false;
    
    switch (model) {
      case 'gemini':
        hints = await gemini.generateHints(castData.casts, profile);
        break;
      case 'openai':
        hints = await openai.generateHints(castData.casts, profile);
        // Check if OpenAI is retrying
        if (hints._isRetrying) {
          isRetrying = true;
          delete hints._isRetrying; // Remove the special flag before sending to client
        }
        break;
      case 'anthropic':
        hints = await anthropic.generateHints(castData.casts, profile);
        break;
    }
    
    // Return hints as JSON response
    return NextResponse.json({ 
      profile, 
      hints, 
      isRetrying: isRetrying 
    });
    
  } catch (error) {
    console.error('Error generating hints:', error);
    return NextResponse.json(
      { error: 'Failed to generate hints', details: error.message },
      { status: 500 }
    );
  }
} 