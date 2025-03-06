import * as frame from '@farcaster/frame-sdk'

const CONTRACT_ADDRESS = '0x6552063731A0a8b6cffdb29390812e6663d87388'

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

  console.log('In a frame, fid:', finalUser.fid);

  window.userFid = finalUser.fid;

  // You can now use the window.userFid in any of your React code, e.g. using a useEffect that listens for it to be set

  // Call the ready function to remove your splash screen when in a frame
  await frame.sdk.actions.ready();
}

export async function mintNFT(rowId) {
  try {
    if (!rowId) {
      throw new Error('Row ID is required');
    }

    // Get the user's wallet address
    const accounts = await frame.sdk.wallet.ethProvider.request({
      method: 'eth_requestAccounts'
    });
    
    if (!accounts || !accounts[0]) {
      throw new Error('No wallet connected');
    }

    const userAddress = accounts[0];

    // Call currentTokenId on the contract
    const currentTokenIdSignature = '0x009a9b7b27'; // keccak256('currentTokenId()').substring(0, 10)

    const tokenIdData = await frame.sdk.wallet.ethProvider.request({
      method: 'eth_call',
      params: [{
        to: CONTRACT_ADDRESS,
        data: currentTokenIdSignature
      }, 'latest']
    });

    console.log('tokenIdData', tokenIdData);

    if (!tokenIdData) {
      console.error('Empty response from contract');
      return;
    }

    // Convert the hex response to a number
    const tokenId = parseInt(tokenIdData, 16);

    console.log(`We need to mint token id ${tokenId} to eth address ${userAddress} for favorite row ${rowId}`);

    // Now do the actual minting
    const mintSignature = '0x1249c58b'; // keccak256('mint()')

    const tx = await frame.sdk.wallet.ethProvider.request({
      method: 'eth_sendTransaction',
      params: [{
        from: userAddress,
        to: CONTRACT_ADDRESS,
        data: mintSignature
      }]
    });

    console.log('Mint transaction sent:', tx);
    
    return { tokenId, userAddress, rowId };
  } catch (error) {
    console.error('Error in mintNFT:', error);
    throw error;
  }
}