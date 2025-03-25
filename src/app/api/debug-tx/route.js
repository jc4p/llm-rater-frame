import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

// Contract address for the NFT
const CONTRACT_ADDRESS = '0x3f54188e5b815b60da5b9354137f3e2c04435322';

// Base RPC URL
const BASE_RPC_URL = process.env.ALCHEMY_RPC_URL || 'https://mainnet.base.org';

// Simple ABI for the Transfer event
const EVENT_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

// More complete ABI including the mint function
const FULL_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "function mint() external",
  "function totalSupply() external view returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)"
];

export async function GET(request) {
  try {
    // Get txHash from query param
    const { searchParams } = new URL(request.url);
    let txHash = searchParams.get('txHash');

    if (!txHash) {
      return NextResponse.json(
        { error: 'Missing required parameter: txHash' },
        { status: 400 }
      );
    }
    
    // Ensure the txHash is properly formatted
    // It should be 0x followed by 64 hex characters
    if (txHash.length > 66) {
      txHash = txHash.substring(0, 66);
      console.log(`Truncated long txHash to: ${txHash}`);
    } else if (txHash.length < 66 && txHash.startsWith('0x')) {
      return NextResponse.json(
        { error: 'Invalid transaction hash length', details: `Hash should be 66 characters (0x + 64 hex chars), got ${txHash.length}` },
        { status: 400 }
      );
    }
    
    // Log the txHash we're using
    console.log(`Processing transaction hash: ${txHash}`);

    const debugInfo = {};
    
    // Create a provider for Base mainnet
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    debugInfo.provider = 'Connected to Base network';
    
    // Get transaction receipt with progressively longer timeouts
    let receipt = null;
    const attempts = [
      { attempt: 1, waitMs: 0 },      // Immediate try
      { attempt: 2, waitMs: 2000 },   // After 2s
      { attempt: 3, waitMs: 3000 },   // After 3s
      { attempt: 4, waitMs: 5000 },   // After 5s
      { attempt: 5, waitMs: 10000 }   // After 10s
    ];
    
    debugInfo.pollAttempts = [];
    
    for (const { attempt, waitMs } of attempts) {
      if (waitMs > 0) {
        debugInfo.pollAttempts.push(`Waiting ${waitMs}ms before attempt ${attempt}`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
      
      receipt = await provider.getTransactionReceipt(txHash);
      
      if (receipt) {
        debugInfo.pollAttempts.push(`Got receipt on attempt ${attempt}`);
        break;
      } else {
        debugInfo.pollAttempts.push(`No receipt on attempt ${attempt}`);
      }
    }
    
    if (!receipt) {
      return NextResponse.json({
        success: false,
        message: 'Transaction not found after multiple attempts',
        debugInfo
      });
    }
    
    // Add basic receipt info to debug
    debugInfo.transactionHash = receipt.hash;
    debugInfo.blockNumber = receipt.blockNumber;
    debugInfo.status = receipt.status === 1 ? 'Success' : 'Failed';
    debugInfo.contractAddress = CONTRACT_ADDRESS.toLowerCase();
    
    // Get all logs from this transaction
    debugInfo.allLogs = receipt.logs.map((log, index) => ({
      index,
      address: log.address,
      isFromContract: log.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase(),
      topics: log.topics,
      data: log.data,
      topicsDecoded: log.topics.map(topic => {
        try {
          // Try to decode as address
          if (topic.length === 66) { // Topics are 32 bytes (64 chars + '0x')
            // If it's a potential address (20 bytes), try to format it
            const potentialAddress = '0x' + topic.slice(26);
            if (ethers.isAddress(potentialAddress)) {
              return `Possible address: ${potentialAddress}`;
            }
          }
          
          // Try to decode as number
          const bigNum = ethers.toBigInt(topic);
          return `BigInt: ${bigNum.toString()}`;
        } catch (e) {
          return `Could not decode: ${topic}`;
        }
      })
    }));
    
    // Filter logs from our contract
    const contractLogs = receipt.logs.filter(log => 
      log.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase()
    );
    
    debugInfo.contractLogsCount = contractLogs.length;
    
    // Try to parse Transfer events
    try {
      // Create a contract interface for parsing the logs
      const iface = new ethers.Interface(EVENT_ABI);
      
      debugInfo.transferEvents = [];
      
      // Try to parse all logs from the contract
      for (const log of contractLogs) {
        try {
          // First try regular parsing
          const parsedLog = iface.parseLog({
            topics: log.topics,
            data: log.data
          });
          
          if (parsedLog && parsedLog.name === 'Transfer') {
            debugInfo.transferEvents.push({
              from: parsedLog.args[0],
              to: parsedLog.args[1],
              tokenId: parsedLog.args[2].toString(),
              isMint: parsedLog.args[0] === '0x0000000000000000000000000000000000000000',
              logIndex: log.index
            });
          }
        } catch (err) {
          // If regular parsing fails, try manual inspection for a Transfer signature and potential token ID
          if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
            // This is the Transfer event signature, try to extract tokenId
            let tokenId;
            if (log.topics.length >= 4) { // We expect 4 topics for an ERC721 Transfer
              tokenId = ethers.toBigInt(log.topics[3]).toString();
            } else if (log.data) {
              // For non-indexed tokenId, it would be in the data field
              tokenId = 'In data: ' + log.data;
            }
            
            debugInfo.transferEvents.push({
              manuallyParsed: true,
              topics: log.topics,
              potentialTokenId: tokenId,
              logIndex: log.index
            });
          }
        }
      }
      
      // Try using a contract instance to get more information
      try {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, FULL_ABI, provider);
        
        // Try to get the total supply - this could help us determine the latest minted token
        const totalSupply = await contract.totalSupply();
        debugInfo.totalSupply = totalSupply.toString();
        
        // Try to check the last few token IDs to see which are valid
        const potentialTokenIds = [];
        const intTotalSupply = parseInt(totalSupply.toString());
        
        // Check ownership of the latest few tokens
        for (let i = Math.max(1, intTotalSupply - 5); i <= intTotalSupply + 2; i++) {
          try {
            const owner = await contract.ownerOf(i);
            potentialTokenIds.push({
              tokenId: i,
              owner: owner,
              valid: true
            });
          } catch (err) {
            potentialTokenIds.push({
              tokenId: i,
              valid: false,
              error: err.message
            });
          }
        }
        
        debugInfo.potentialTokenIds = potentialTokenIds;
      } catch (contractErr) {
        debugInfo.contractError = 'Error accessing contract methods: ' + contractErr.message;
      }
    } catch (e) {
      debugInfo.parseError = e.message;
    }
    
    // Attempt to find the best token ID
    let bestTokenId = null;
    
    // 1. First check for a Transfer from 0x0 (mint)
    const mintEvents = debugInfo.transferEvents?.filter(e => e.isMint) || [];
    if (mintEvents.length > 0) {
      bestTokenId = mintEvents[0].tokenId;
      debugInfo.tokenIdSource = 'Found from Transfer mint event';
    } 
    // 2. Otherwise if we found potential token IDs, use the highest valid one
    else if (debugInfo.potentialTokenIds && debugInfo.potentialTokenIds.some(t => t.valid)) {
      const validTokens = debugInfo.potentialTokenIds.filter(t => t.valid);
      bestTokenId = Math.max(...validTokens.map(t => t.tokenId));
      debugInfo.tokenIdSource = 'Inferred from highest valid token ID';
    }
    // 3. If we found any Transfer event, use the highest token ID
    else if (debugInfo.transferEvents && debugInfo.transferEvents.length > 0) {
      const tokenIdsFromEvents = debugInfo.transferEvents
        .filter(e => e.tokenId && !isNaN(parseInt(e.tokenId)))
        .map(e => parseInt(e.tokenId));
      
      if (tokenIdsFromEvents.length > 0) {
        bestTokenId = Math.max(...tokenIdsFromEvents);
        debugInfo.tokenIdSource = 'Using highest token ID from any Transfer event';
      }
    }
    
    return NextResponse.json({
      success: true,
      transaction: txHash,
      tokenId: bestTokenId,
      debugInfo: debugInfo
    });
  } catch (error) {
    console.error('Error inspecting transaction:', error);
    return NextResponse.json(
      { error: 'Failed to inspect transaction', details: error.message },
      { status: 500 }
    );
  }
}