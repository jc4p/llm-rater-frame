import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

// Define this as edge route
export const runtime = 'edge';

export async function GET(request, { params }) {
  const tokenId = params.tokenId;
  
  try {
    // Query the database for user's favorite LLM
    const { rows } = await sql`
      SELECT * FROM user_favorite_llm WHERE token_id = ${tokenId}
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No favorite LLM found for this token' },
        { status: 404 }
      );
    }

    const dbData = rows[0];
    
    // Default image if none is found in the database
    const imageUrl = dbData.image_url || 'https://images.kasra.codes/favorite-llm/image-url-default.png';
    
    // Get the display name for the AI model
    const aiDisplayNames = {
      'claude-3.5': 'Claude',
      'gemini-2.0': 'Gemini',
      'gpt-4.5': 'ChatGPT',
      'o3-mini': 'ChatGPT'
    };
    
    const aiName = aiDisplayNames[dbData.favorite_llm] || dbData.favorite_llm;
    
    // Transform into ERC-721 metadata format with better naming and description
    return NextResponse.json({
      name: `${aiName} Best Friend #${tokenId}`,
      description: `This NFT proves that ${aiName} knows you better than any other AI. It analyzed your Farcaster posts and discovered your personality traits, interests, and digital persona.`,
      image: imageUrl,
      background_color: "D2E8DF",
      attributes: [
        {
          trait_type: "AI Best Friend",
          value: aiName
        },
        {
          trait_type: "LLM Model",
          value: dbData.favorite_llm || "Unknown"
        },
        {
          trait_type: "Analysis Date",
          display_type: "date",
          value: Math.floor(new Date(dbData.created_at).getTime() / 1000)
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