import * as frame from '@farcaster/frame-sdk'

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