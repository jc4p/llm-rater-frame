import * as frame from '@farcaster/frame-sdk'

const CONTRACT_ADDRESS = '0x3f54188e5b815b60da5b9354137f3e2c04435322'

export async function initializeFrame() {
  const user = await frame.sdk.context.user

  // Handle the case where user has a user property (known issue)
  let finalUser = user;
  if (finalUser && finalUser.user) {
    finalUser = finalUser.user;
  }

  if (!finalUser || !finalUser.fid) {
    console.log('Not in a frame');
    // most likely not in a frame
    return
  }

  window.userFid = finalUser.fid;
  window.frameInitialized = false;

  // You can now use the window.userFid in any of your React code
  // But don't call ready() yet - we'll do that after analysis starts
}

// This will be called after analysis starts
export async function frameReady() {
  // Only call ready once
  if (!window.frameInitialized) {
    window.frameInitialized = true;
    await frame.sdk.actions.ready();
  }
}

export async function mintNFT(rowId) {
  try {
    if (!rowId) {
      throw new Error('Row ID is required');
    }

    // First, check if we're on the correct chain (Base mainnet)
    const chainId = await frame.sdk.wallet.ethProvider.request({
      method: 'eth_chainId'
    });
    
    const chainIdDecimal = typeof chainId === 'number' ? chainId : parseInt(chainId, 16);
    
    // Base mainnet is 8453 (0x2105)
    if (chainIdDecimal !== 8453) {
      console.log(`Switching to Base mainnet. Current network: ${chainIdDecimal}`);
      await frame.sdk.wallet.ethProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }] // Base mainnet chainId
      });
    }

    // Get the user's wallet address
    const accounts = await frame.sdk.wallet.ethProvider.request({
      method: 'eth_requestAccounts'
    });
    
    if (!accounts || !accounts[0]) {
      throw new Error('No wallet connected');
    }

    const userAddress = accounts[0];
    
    // Create the mint function signature
    const mintFunctionSignature = '0x1249c58b'; // keccak256('mint()')
    
    // Send the mint transaction
    const txHash = await frame.sdk.wallet.ethProvider.request({
      method: 'eth_sendTransaction',
      params: [{
        from: userAddress,
        to: CONTRACT_ADDRESS,
        data: mintFunctionSignature
      }]
    });

    console.log('Mint transaction sent:', txHash);
    
    // Return the transaction hash and user's FID for further processing
    return { 
      txHash, 
      userAddress, 
      rowId,
      fid: window.userFid
    };
  } catch (error) {
    console.error('Error in mintNFT:', error);
    throw error;
  }
}

/**
 * Generate a share image and return its URL
 * @param {Object} params - Parameters for image generation
 * @param {string} params.pfpUrl - URL of the user's profile picture
 * @param {string} params.llmType - Type of LLM (claude, gemini, gpt)
 * @returns {Promise<string>} - URL of the generated image
 */
export async function generateShareImage({ pfpUrl, llmType }) {
  try {
    if (!window.userFid) {
      throw new Error('User FID not available. Are you in a frame?');
    }
    
    if (!pfpUrl) {
      throw new Error('Profile picture URL is required');
    }
    
    // Map LLM names to template names
    const llmTypeMap = {
      'claude-3.5': 'claude',
      'gemini-2.0': 'gemini',
      'gpt-4.5': 'gpt',
      'claude': 'claude',
      'gemini': 'gemini',
      'gpt': 'gpt'
    };
    
    const template = llmTypeMap[llmType] || 'claude';
    
    // Reduced logging
    
    // Call the API to generate and store the image
    const response = await fetch('/api/generate-share-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pfpUrl,
        fid: window.userFid,
        llmType: template
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Share image generation failed');
      throw new Error(errorData.error || 'Failed to generate share image');
    }
    
    const data = await response.json();
    return data.imageUrl;
  } catch (error) {
    console.error('Error generating share image:', error);
    throw error;
  }
}

/**
 * Generate an NFT image and store it in the database
 * @param {Object} params - Parameters for image generation
 * @param {string} params.pfpUrl - URL of the user's profile picture
 * @param {string} params.rowId - ID of the user_favorite_llm row
 * @param {string} params.llmType - Type of LLM (claude, gemini, gpt)
 * @param {number} [params.tokenId] - Token ID (optional)
 * @returns {Promise<string>} - URL of the generated image
 */
export async function generateNFTImage({ pfpUrl, rowId, llmType, tokenId }) {
  try {
    if (!window.userFid) {
      throw new Error('User FID not available. Are you in a frame?');
    }
    
    if (!pfpUrl || !rowId) {
      throw new Error('Profile picture URL and row ID are required');
    }
    
    // Map LLM names to template names
    const llmTypeMap = {
      'claude-3.5': 'claude',
      'gemini-2.0': 'gemini',
      'gpt-4.5': 'gpt',
      'claude': 'claude',
      'gemini': 'gemini',
      'gpt': 'gpt'
    };
    
    const template = llmTypeMap[llmType] || 'claude';
    
    // Reduced logging
    
    // Call the API to generate and store the image
    const response = await fetch('/api/generate-nft-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pfpUrl,
        fid: window.userFid,
        rowId,
        llmType: template,
        tokenId
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('NFT image generation failed');
      throw new Error(errorData.error || 'Failed to generate NFT image');
    }
    
    const data = await response.json();
    return data.imageUrl;
  } catch (error) {
    console.error('Error generating NFT image:', error);
    throw error;
  }
}

/**
 * Share content via Warpcast
 * @param {string} text - Text to share
 * @param {string} shareUrl - URL to share (can be the app URL with image parameter)
 * @returns {Promise<void>}
 */
export async function shareOnWarpcast(text, shareUrl) {
  try {
    const targetText = text || 'Check out my AI Best Friend!';
    
    // Create the URL with the text and URL embed
    let finalUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(targetText)}`;
    
    // Add URL to embed if provided
    if (shareUrl) {
      finalUrl += `&embeds[]=${encodeURIComponent(shareUrl)}`;
    }
    
    // Open the URL
    await frame.sdk.actions.openUrl(finalUrl);
  } catch (error) {
    console.error('Error sharing on Warpcast:', error);
    throw error;
  }
}