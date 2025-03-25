import { NextResponse } from 'next/server';
import pg from 'pg';

// Create a new pool
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL
});

async function getTokenIdFromTransaction(txHash) {
  try {
    // Parameters for the JSON-RPC request
    const params = {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionReceipt",
      params: [txHash]
    };

    // Make the request to Alchemy
    const response = await fetch(process.env.ALCHEMY_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    const data = await response.json();
    
    // Check if the transaction succeeded
    if (!data.result || data.result.status !== '0x1') {
      console.error('Transaction failed or not found', data);
      throw new Error('Transaction failed or not found');
    }

    // Find the Transfer event
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'; // Topic for Transfer(address,address,uint256)
    
    // Find the Transfer event log
    const transferLog = data.result.logs.find(log => 
      log.topics[0] === transferTopic && 
      log.topics.length === 4 // For ERC721 transfers
    );

    if (!transferLog) {
      console.error('Transfer event not found in transaction logs');
      throw new Error('Transfer event not found');
    }

    // The token ID is in the last topic (topics[3])
    const tokenIdHex = transferLog.topics[3];
    const tokenId = parseInt(tokenIdHex, 16);

    console.log(`Found token ID ${tokenId} from transaction ${txHash}`);
    return tokenId;
  } catch (error) {
    console.error('Error retrieving token ID from transaction:', error);
    throw error;
  }
}

export async function POST(request) {
  try {
    const { rowId, txHash, tokenId } = await request.json();

    // Validate required fields
    if (!rowId) {
      return NextResponse.json(
        { error: 'Missing required field: rowId' },
        { status: 400 }
      );
    }

    // If tokenId is provided, use it directly
    // Otherwise, if txHash is provided, retrieve the tokenId from the blockchain
    let finalTokenId = tokenId;
    
    if (!finalTokenId && txHash) {
      try {
        finalTokenId = await getTokenIdFromTransaction(txHash);
      } catch (error) {
        console.error('Error retrieving token ID from transaction:', error);
        return NextResponse.json(
          { error: 'Failed to retrieve token ID from transaction', details: error.message },
          { status: 500 }
        );
      }
    }

    if (!finalTokenId) {
      return NextResponse.json(
        { error: 'Missing token information: either tokenId or txHash is required' },
        { status: 400 }
      );
    }

    // Update the row with the token ID and transaction hash
    const query = `
      UPDATE user_favorite_llm
      SET token_id = $1, tx = $2
      WHERE id = $3
      RETURNING id, tx
    `;

    // Make sure we're setting the tx column
    console.log(`Updating row ${rowId} with tokenId ${finalTokenId} and txHash ${txHash}`);
    const result = await pool.query(query, [finalTokenId, txHash || null, rowId]);

    if (!result.rows.length) {
      return NextResponse.json(
        { error: 'Row not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true,
      tokenId: finalTokenId,
      txHash: txHash || null
    });
  } catch (error) {
    console.error('Error updating token:', error);
    return NextResponse.json(
      { error: 'Failed to update token', details: error.message },
      { status: 500 }
    );
  }
} 