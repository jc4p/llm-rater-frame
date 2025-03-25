import { NextResponse } from 'next/server';
import pg from 'pg';
import { ethers } from 'ethers';

// Create a new pool
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL
});

// Contract address for the NFT
const CONTRACT_ADDRESS = '0x3f54188e5b815b60da5b9354137f3e2c04435322';

// Base RPC URL
const BASE_RPC_URL = process.env.ALCHEMY_RPC_URL || 'https://mainnet.base.org';

// Simple ABI for the mint event (Transfer event)
const EVENT_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

// Function to poll for transaction receipt
async function pollForTransactionReceipt(provider, txHash, maxAttempts = 10, intervalMs = 3000) {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (receipt) {
      return receipt;
    }
    
    // Wait for next poll - increase wait time with each attempt
    const dynamicWaitTime = intervalMs * Math.pow(1.2, attempts);
    console.log(`Waiting ${Math.round(dynamicWaitTime)}ms before next attempt`);
    await new Promise(resolve => setTimeout(resolve, dynamicWaitTime));
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
    
    console.log(`Found receipt: blockNumber=${receipt.blockNumber}, status=${receipt.status}`);
    
    // Filter logs to find those from our contract address
    const contractLogs = receipt.logs.filter(log => 
      log.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase()
    );
    
    console.log(`Found ${contractLogs.length} logs from our contract`);
    
    // APPROACH 1: Try to parse Transfer event using ethers
    try {
      const iface = new ethers.Interface(EVENT_ABI);
      let transferFound = false;
      
      // Look for the Transfer event from null address (mint)
      for (const log of contractLogs) {
        try {
          // Check for Transfer event signature
          if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
            transferFound = true;
            console.log('Found log with Transfer signature:', log.topics);
            
            // Try to parse the log
            const parsedLog = iface.parseLog({
              topics: log.topics,
              data: log.data
            });
            
            // Check if it's a mint (from zero address)
            if (parsedLog && parsedLog.name === 'Transfer') {
              console.log(`Parsed Transfer event: from=${parsedLog.args[0]}, to=${parsedLog.args[1]}, tokenId=${parsedLog.args[2]}`);
              
              if (parsedLog.args[0] === '0x0000000000000000000000000000000000000000') {
                const tokenId = parsedLog.args[2];
                console.log(`Found minted token ID: ${tokenId}`);
                return Number(tokenId);
              }
            }
          }
        } catch (error) {
          console.log('Error parsing log:', error.message);
          // Continue to the next log
        }
      }
      
      if (transferFound) {
        console.log('Found Transfer events but none were mints');
      }
    } catch (error) {
      console.log('Error in Transfer event parsing approach:', error.message);
    }
    
    // APPROACH 2: Try manual topic extraction
    console.log('Trying topic extraction approach...');
    if (contractLogs.length > 0) {
      for (const log of contractLogs) {
        // Check for Transfer event signature
        if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
          console.log('Log topics:', log.topics);
          
          // Check for mint (from zero address)
          if (log.topics.length >= 3) {
            const fromTopic = log.topics[1];
            // Zero address padded to 32 bytes
            const zeroAddress = '0x0000000000000000000000000000000000000000000000000000000000000000';
            
            if (fromTopic.includes('0000000000000000000000000000000000000000')) {
              console.log('This appears to be a mint (transfer from zero address)');
              
              if (log.topics.length >= 4) {
                try {
                  // The topic at index 3 should be the token ID
                  const tokenIdHex = log.topics[3];
                  const tokenId = ethers.toBigInt(tokenIdHex);
                  console.log(`Extracted token ID from topic: ${tokenId}`);
                  return Number(tokenId);
                } catch (error) {
                  console.log('Error converting topic to token ID:', error.message);
                }
              }
            }
          }
        }
      }
    }
    
    // APPROACH 3: Try to make an educated guess based on total supply
    try {
      console.log('Trying total supply approach...');
      // Basic ABI for totalSupply
      const basicAbi = ["function totalSupply() view returns (uint256)"];
      const contract = new ethers.Contract(CONTRACT_ADDRESS, basicAbi, provider);
      
      // Get current total supply
      const totalSupply = await contract.totalSupply();
      console.log(`Current total supply: ${totalSupply}`);
      
      // Check if the transaction is recent (within last few blocks)
      const currentBlock = await provider.getBlockNumber();
      const transactionBlock = receipt.blockNumber;
      const blockDifference = currentBlock - transactionBlock;
      
      if (blockDifference < 10) {
        // If this is a recent transaction, the token ID might be the current total supply
        console.log(`This is a recent transaction (${blockDifference} blocks ago). The token ID might be the current total supply.`);
        return Number(totalSupply);
      }
    } catch (error) {
      console.log('Error in total supply approach:', error.message);
    }
    
    console.log('No methods succeeded in finding token ID');
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