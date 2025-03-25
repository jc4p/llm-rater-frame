import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

// Define this as edge route
export const runtime = 'edge';

export async function GET(request, { params }) {
  const tokenId = params.tokenId;
  
  try {
    // Special case for token #0 which was minted but doesn't exist in DB
    // We'll use token #1's data but with ID 0
    if (tokenId === '0') {
      console.log('Handling special case for token #0 - using token #1 data as fallback');
      
      // Query for token #1 as a fallback, making sure it's a number
      const fallbackTokenId = 1;
      const { rows } = await sql`
        SELECT * FROM user_favorite_llm WHERE token_id = ${fallbackTokenId}
      `;
      
      // If we don't have token #1 either, use a hardcoded fallback
      if (rows.length === 0) {
        return NextResponse.json({
          name: `Claude Best Friend #0`,
          description: `This NFT proves that Claude knows you better than any other AI. It analyzed your Farcaster posts and discovered your personality traits, interests, and digital persona.`,
          image: 'https://images.kasra.codes/favorite-llm/image-url-default.png',
          background_color: "D2E8DF",
          attributes: [
            {
              trait_type: "AI Best Friend",
              value: "Claude"
            },
            {
              trait_type: "LLM Model",
              value: "claude-3.5"
            },
            {
              trait_type: "Analysis Date",
              display_type: "date",
              value: Math.floor(Date.now() / 1000)
            }
          ]
        });
      }
      
      // Use token #1's data but change the token ID to 0
      const dbData = rows[0];
      const imageUrl = dbData.image_url || 'https://images.kasra.codes/favorite-llm/image-url-default.png';
      
      const aiDisplayNames = {
        'claude-3.5': 'Claude',
        'gemini-2.0': 'Gemini',
        'gpt-4.5': 'ChatGPT',
        'o3-mini': 'ChatGPT'
      };
      
      const aiName = aiDisplayNames[dbData.favorite_llm] || dbData.favorite_llm;
      
      // Return token #1's data but with ID 0
      return NextResponse.json({
        name: `${aiName} Best Friend #0`,
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
    }
    
    // Normal case - query the database for the specific token ID
    // Make sure tokenId is treated as a number in the query
    const numericTokenId = parseInt(tokenId, 10);
    const { rows } = await sql`
      SELECT * FROM user_favorite_llm WHERE token_id = ${numericTokenId}
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
    
    // Provide a generic fallback instead of an error for better user experience
    const requestedId = params.tokenId || '0';
    
    return NextResponse.json({
      name: `AI Best Friend #${requestedId}`,
      description: `This NFT proves that AI knows you better than anyone else. It analyzed your Farcaster posts and discovered your personality traits, interests, and digital persona.`,
      image: 'https://images.kasra.codes/favorite-llm/image-url-default.png',
      background_color: "D2E8DF",
      attributes: [
        {
          trait_type: "AI Best Friend",
          value: "Claude"
        },
        {
          trait_type: "LLM Model",
          value: "claude-3.5"
        },
        {
          trait_type: "Creation Date",
          display_type: "date",
          value: Math.floor(Date.now() / 1000)
        }
      ]
    });
  }
} 