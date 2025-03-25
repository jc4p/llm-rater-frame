import { NextResponse } from 'next/server';
import pg from 'pg';
import { ethers } from 'ethers';

// Create a new pool
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL
});

// Contract address for the NFT
const CONTRACT_ADDRESS = '0x6552063731A0a8b6cffdb29390812e6663d87388';

// Base RPC URL
const BASE_RPC_URL = process.env.ALCHEMY_RPC_URL || 'https://mainnet.base.org';

// Simple ABI for the mint event (Transfer event)
const EVENT_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

// Function to poll for transaction receipt
async function pollForTransactionReceipt(provider, txHash, maxAttempts = 5, intervalMs = 2000) {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (receipt) {
      return receipt;
    }
    
    // Wait for next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    attempts++;
    console.log(`Polling for transaction receipt (attempt ${attempts}/${maxAttempts})`);
  }
  
  return null;
}

async function getTokenIdFromTransaction(txHash) {
  try {
    // Create a provider for Base mainnet
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    // Poll for the transaction receipt
    console.log(`Waiting for transaction receipt for ${txHash}...`);
    const receipt = await pollForTransactionReceipt(provider, txHash);
    
    if (!receipt) {
      console.log('Transaction not yet mined after polling');
      return null;
    }
    
    // Filter logs to find those from our contract address
    const contractLogs = receipt.logs.filter(log => 
      log.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase()
    );
    
    console.log(`Found ${contractLogs.length} logs from our contract`);
    
    // Create an interface to parse the logs
    const iface = new ethers.Interface(EVENT_ABI);
    
    // Look for the Transfer event from null address (mint)
    for (const log of contractLogs) {
      try {
        const parsedLog = iface.parseLog({
          topics: log.topics,
          data: log.data
        });
        
        // Check if it's a Transfer event from the zero address (which indicates a mint)
        if (
          parsedLog && 
          parsedLog.name === 'Transfer' && 
          parsedLog.args[0] === '0x0000000000000000000000000000000000000000'
        ) {
          const tokenId = parsedLog.args[2];
          console.log(`Found minted token ID: ${tokenId}`);
          return Number(tokenId);
        }
      } catch (error) {
        // This log isn't a Transfer event we can parse, continue to the next one
        continue;
      }
    }
    
    // If we couldn't find a Transfer event but have logs, try to get the token ID by position
    // Many NFT contracts emit the token ID as the third indexed parameter (fourth topic since topics[0] is the event signature)
    if (contractLogs.length > 0) {
      for (const log of contractLogs) {
        if (log.topics.length >= 4) {  // We need at least 4 topics (event signature + 3 indexed params)
          try {
            // The fourth topic (index 3) would be the token ID in the Transfer event
            const possibleTokenId = ethers.toBigInt(log.topics[3]);
            console.log(`Found possible token ID from topic: ${possibleTokenId}`);
            return Number(possibleTokenId);
          } catch (error) {
            console.error('Error parsing token ID from topic:', error);
          }
        }
      }
    }
    
    console.log('No Transfer event found in transaction logs');
    return null;
  } catch (error) {
    console.error('Error getting token ID from transaction:', error);
    return null;
  }
}

export async function POST(request) {
  try {
    const { rowId, txHash, tokenId, fid } = await request.json();

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
        // If we couldn't get a token ID yet, that's okay - we'll still store the tx hash
        // and the token ID will be retrieved later (or manually/by another process)
        if (finalTokenId === null) {
          console.log(`No token ID found yet for tx ${txHash}, storing just the tx hash for now`);
        }
      } catch (error) {
        console.error('Error retrieving token ID from transaction:', error);
        // Continue execution, we'll just store the tx hash without a token ID
      }
    }

    // Update the database
    let query, queryParams;
    
    if (finalTokenId) {
      // If we have a token ID, update both token_id and tx
      query = `
        UPDATE user_favorite_llm
        SET token_id = $1, tx = $2
        WHERE id = $3
        RETURNING id, tx, token_id
      `;
      queryParams = [finalTokenId, txHash, rowId];
      console.log(`Updating row ${rowId} with tokenId ${finalTokenId} and txHash ${txHash}`);
    } else if (txHash) {
      // If we only have a tx hash but no token ID yet, just store the tx hash
      query = `
        UPDATE user_favorite_llm
        SET tx = $1
        WHERE id = $2
        RETURNING id, tx, token_id
      `;
      queryParams = [txHash, rowId];
      console.log(`Updating row ${rowId} with just txHash ${txHash} (no token ID yet)`);
    } else {
      return NextResponse.json(
        { error: 'Missing token information: either tokenId or txHash is required' },
        { status: 400 }
      );
    }

    // Execute the update
    const result = await pool.query(query, queryParams);

    if (!result.rows.length) {
      return NextResponse.json(
        { error: 'Row not found' },
        { status: 404 }
      );
    }

    // Even if we don't have the token ID yet, proceed with image generation
    if (txHash && fid) {
      console.log(`Proceeding with the transaction hash ${txHash} and will update the token ID later`);
    }

    return NextResponse.json({ 
      success: true,
      tokenId: finalTokenId,
      txHash: txHash || null,
      rowData: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating token:', error);
    return NextResponse.json(
      { error: 'Failed to update token', details: error.message },
      { status: 500 }
    );
  }
} 