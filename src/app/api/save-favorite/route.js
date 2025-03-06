import { NextResponse } from 'next/server';
import pg from 'pg';

const VALID_LLMS = ['claude-3.5', 'gemini-2.0', 'gpt-4.5'];

// Create a new pool
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL
});

export async function POST(request) {
  try {
    const { fid, favorite_llm } = await request.json();

    // Validate required fields
    if (!fid || !favorite_llm) {
      return NextResponse.json(
        { error: 'Missing required fields: fid and favorite_llm' },
        { status: 400 }
      );
    }

    // Validate favorite_llm is one of the allowed values
    if (!VALID_LLMS.includes(favorite_llm)) {
      return NextResponse.json(
        { error: 'Invalid favorite_llm. Must be one of: ' + VALID_LLMS.join(', ') },
        { status: 400 }
      );
    }

    // Insert or update the user's favorite and return the row id
    const query = `
      INSERT INTO user_favorite_llm (fid, favorite_llm)
      VALUES ($1, $2)
      RETURNING id
    `;

    const result = await pool.query(query, [fid, favorite_llm]);
    const rowId = result.rows[0]?.id;

    if (!rowId) {
      throw new Error('Failed to get row ID after insert/update');
    }

    return NextResponse.json({ success: true, rowId });
  } catch (error) {
    console.error('Error saving favorite:', error);
    return NextResponse.json(
      { error: 'Failed to save favorite', details: error.message },
      { status: 500 }
    );
  }
} 