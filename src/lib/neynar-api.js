import fetch from 'node-fetch';

const NEYNAR_API_BASE_URL = 'https://api.neynar.com/v2/farcaster';
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

if (!NEYNAR_API_KEY) {
  console.warn('NEYNAR_API_KEY is not set in environment variables');
}

/**
 * Server-side function to fetch user casts from Neynar API with pagination
 * This should only be called from the server-side, never from client code.
 * 
 * @param {number} fid - The FID of the user to fetch casts for
 * @param {number} limit - The maximum number of casts to fetch (defaults to 300)
 * @returns {Promise<Object>} - Object containing array of casts
 */
export async function getUserCasts(fid, limit = 300) {
  if (!fid) {
    throw new Error('FID is required');
  }

  // Each call can fetch max 150 casts at a time
  const maxPerCall = 150;
  const callsNeeded = Math.ceil(limit / maxPerCall);
  
  let allCasts = [];
  let cursor = null;
  
  for (let i = 0; i < callsNeeded; i++) {
    // If we already have enough casts, stop making more API calls
    if (allCasts.length >= limit) break;
    
    // Calculate how many more casts we need
    const remainingNeeded = limit - allCasts.length;
    const currentCallLimit = Math.min(remainingNeeded, maxPerCall);
    
    const params = new URLSearchParams({
      fid: fid.toString(),
      limit: currentCallLimit.toString(),
      include_replies: 'false', // Only fetch top-level casts
    });
    
    if (cursor) params.append('cursor', cursor);
    
    const url = `${NEYNAR_API_BASE_URL}/feed/user/casts?${params.toString()}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-api-key': NEYNAR_API_KEY
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Neynar API error (${response.status}): ${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data.casts || !Array.isArray(data.casts)) {
        throw new Error('Unexpected response format from Neynar API');
      }
      
      allCasts = [...allCasts, ...data.casts];
      
      // Get cursor for next page
      cursor = data.next?.cursor || null;
      
      // If there's no cursor, we've reached the end of results
      if (!cursor) break;
      
    } catch (error) {
      console.error('Error fetching casts from Neynar:', error);
      throw error;
    }
  }
  
  // Return in the expected format with a casts array
  return { 
    casts: allCasts.slice(0, limit),
    count: Math.min(allCasts.length, limit)
  };
} 