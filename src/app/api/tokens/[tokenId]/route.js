import { NextResponse } from 'next/server';
import pg from 'pg';

// Create a PostgreSQL connection pool
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL
});

const IMAGE_URL_LOOKUP = {
  'claude-3.5': 'https://images.kasra.codes/claude-3.5.png',
  'gemini-2.0': 'https://images.kasra.codes/gemini-2.0.png',
  'gpt-4.5': 'https://images.kasra.codes/gpt-4.5.png',
}

export async function GET(request, { params }) {
  const data = await params;
  const tokenId = data.tokenId;
  
  try {
    // Query the database for user's favorite LLM
    const result = await pool.query(
      'SELECT * FROM user_favorite_llm WHERE token_id = $1',
      [tokenId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'No favorite LLM found for this token' },
        { status: 404 }
      );
    }

    const dbData = result.rows[0];
    
    // Transform into ERC-721 metadata format
    return NextResponse.json({
      name: `AI Personality Mirror #${tokenId}`,
      description: "This NFT represents a user's AI personality analysis results, showing which AI model best understands their online presence.",
      image: IMAGE_URL_LOOKUP[dbData.favorite_llm] || 'https://images.kasra.codes/claude-3.5.png',
      external_url: `https://llm-rater.kasra.codes/tokens/${tokenId}`,
      background_color: "D2E8DF", // Using our app's accent color
      attributes: [
        {
          trait_type: "Chosen AI",
          value: dbData.favorite_llm || "Unknown"
        },
        {
          trait_type: "Analysis Date",
          display_type: "date",
          value: dbData.created_at?.getTime() / 1000 || null
        }
      ]
    });
    
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token metadata' },
      { status: 500 }
    );
  }
} 