'use client';

import { useState, useEffect } from 'react';
import { mintNFT, generateNFTImage, generateShareImage, shareOnWarpcast, frameReady } from '@/lib/frame';

export default function UserHints({ initialFavorite }) {
  const [loading, setLoading] = useState(false);
  const [geminiHints, setGeminiHints] = useState(null);
  const [openaiHints, setOpenaiHints] = useState(null);
  const [anthropicHints, setAnthropicHints] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('gemini');
  const [selectedModel, setSelectedModel] = useState(null);
  // Mint modal removed - now handled directly from main UI
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [favoriteRowId, setFavoriteRowId] = useState(initialFavorite?.id || null);
  const [userFavorite, setUserFavorite] = useState(initialFavorite || null);
  const [nftPreviewUrl, setNftPreviewUrl] = useState(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  // New state for tracking mint transaction status
  const [mintingStatus, setMintingStatus] = useState(null); // null | 'submitting' | 'pending' | 'confirmed' | 'failed'
  const [mintTxHash, setMintTxHash] = useState(null); // Store transaction hash for rechecking

  // Set initial selected model based on initialFavorite
  useEffect(() => {
    if (initialFavorite) {
      console.log('Initializing with initialFavorite:', initialFavorite);
      // Make sure we set the favorite row ID
      setFavoriteRowId(initialFavorite.id);
      setUserFavorite(initialFavorite);
      
      const modelMap = {
        'claude-3.5': 'anthropic',
        'gemini-2.0': 'gemini',
        'gpt-4.5': 'openai',
        'o3-mini': 'openai'
      };
      const model = modelMap[initialFavorite.favorite_llm];
      if (model) {
        setSelectedModel(model);
        setActiveTab(model);
        
        // If this is a previously minted token, set the NFT preview URL
        if (initialFavorite.token_id !== null && initialFavorite.image_url) {
          setNftPreviewUrl(initialFavorite.image_url);
        }
        
        // Fetch the analysis for the selected model
        fetchHints(model);
      }
    }
  }, [initialFavorite]);

  // Track which models have already been fetched to prevent duplicate fetches
  const [fetchedModels, setFetchedModels] = useState(new Set());
  // Track which models are currently being fetched to prevent duplicate requests
  const [fetchingModels, setFetchingModels] = useState(new Set());
  
  async function fetchHints(model) {
    try {
      // Check if we've already fetched this model
      if (fetchedModels.has(model)) {
        console.log(`Skipping fetch for ${model} - already fetched`);
        return;
      }
      
      // Check if we're already fetching this model
      if (fetchingModels.has(model)) {
        console.log(`Skipping fetch for ${model} - already in progress`);
        return;
      }
      
      // Mark this model as being fetched
      setFetchingModels(prev => new Set([...prev, model]));
      
      setLoading(true);
      setError(null);
      
      // Only access window object if we're on the client side
      if (typeof window === 'undefined') {
        console.log('Window not defined yet, skipping fetch');
        // Remove from fetching models
        setFetchingModels(prev => {
          const updated = new Set([...prev]);
          updated.delete(model);
          return updated;
        });
        return;
      }
      
      console.log(`Fetching ${model} hints for FID ${window.userFid}`);
      const response = await fetch(`/api/hints?fid=${window.userFid}&limit=300&model=${model}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate hints');
      }
      
      setProfile(data.profile);
      switch (model) {
        case 'gemini':
          setGeminiHints(data.hints);
          break;
        case 'openai':
          setOpenaiHints(data.hints);
          break;
        case 'anthropic':
          setAnthropicHints(data.hints);
          break;
      }
      
      // Mark this model as fetched and remove from fetching
      setFetchedModels(prev => new Set([...prev, model]));
      setFetchingModels(prev => {
        const updated = new Set([...prev]);
        updated.delete(model);
        return updated;
      });
      console.log(`Successfully fetched ${model} hints`);
    } catch (error) {
      console.error('Error generating hints:', error);
      setError(error.message || 'Failed to generate hints');
      
      // Remove from fetching models on error
      setFetchingModels(prev => {
        const updated = new Set([...prev]);
        updated.delete(model);
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateHints() {
    // Reset tracking of which models have been fetched or are being fetched
    setFetchedModels(new Set());
    setFetchingModels(new Set());
    
    // Reset all models' hints when generating new ones
    setGeminiHints(null);
    setOpenaiHints(null);
    setAnthropicHints(null);
    
    // We don't need to call frameReady here anymore, since HomeComponent already calls it
    // This prevents duplicate calls that might cause issues
    
    // Start loading all AIs in parallel
    fetchHints('gemini');
    fetchHints('openai');
    fetchHints('anthropic');
    
    console.log('Started analysis for all models');
  }
  
  // Auto-fetch hints when the component mounts if we don't have a profile yet
  useEffect(() => {
    // Safely check for window.userFid to avoid SSR issues
    if (typeof window !== 'undefined' && !profile && !loading && window.userFid) {
      handleGenerateHints();
    }
  }, [profile, loading]);

  // Make sure we start the analysis if we have the FID but no favorite
  useEffect(() => {
    // Safely check for window.userFid to avoid SSR issues
    if (typeof window !== 'undefined' && window.userFid && !initialFavorite && !profile && !loading && !geminiHints && !openaiHints && !anthropicHints) {
      console.log('Starting analysis for new user with no favorite');
      // Set a slight delay to ensure the frameReady call has happened
      setTimeout(() => {
        handleGenerateHints();
      }, 500);
    }
  }, [initialFavorite]);
  
  // Create a separate effect to check for userFid availability
  useEffect(() => {
    // This effect will run on client-side only
    if (typeof window === 'undefined') return;
    
    // If we already have userFid, check if we need to start analysis
    if (window.userFid && !initialFavorite && !profile && !loading && !geminiHints && !openaiHints && !anthropicHints) {
      console.log('userFid available, starting analysis for new user');
      setTimeout(() => {
        handleGenerateHints();
      }, 500);
    }
    
    // Otherwise, set up an interval to check for userFid
    const interval = setInterval(() => {
      if (window.userFid && !initialFavorite && !profile && !loading && !geminiHints && !openaiHints && !anthropicHints) {
        console.log('userFid became available, starting analysis for new user');
        handleGenerateHints();
        clearInterval(interval);
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, []);
  
  // Effect to poll for transaction status when in pending state
  useEffect(() => {
    if (mintingStatus !== 'pending' || !mintTxHash || !favoriteRowId) {
      return; // Only run when we have a pending transaction
    }
    
    console.log('Setting up polling for pending transaction:', mintTxHash);
    
    const checkTransactionStatus = async () => {
      try {
        // Try to get the latest transaction status
        const response = await fetch(`/api/debug-tx?txHash=${mintTxHash}`);
        if (!response.ok) {
          console.error('Failed to check transaction status');
          return;
        }
        
        const data = await response.json();
        console.log('Transaction status check result:', data);
        
        // If we found a token ID, update our state
        if (data.tokenId) {
          console.log(`Transaction confirmed with token ID: ${data.tokenId}`);
          
          // Update the local state
          setUserFavorite(prev => ({
            ...prev,
            token_id: data.tokenId,
            tx: mintTxHash
          }));
          
          // Update minting status
          setMintingStatus('confirmed');
          
          // Generate NFT image with the token ID if needed
          if (!userFavorite?.image_url && profile?.pfp) {
            const llmTypeMap = {
              'anthropic': 'claude',
              'gemini': 'gemini',
              'openai': 'gpt'
            };
            
            const llmType = llmTypeMap[selectedModel] || 'claude';
            
            try {
              const imageUrl = await generateNFTImage({
                pfpUrl: profile.pfp,
                rowId: favoriteRowId,
                llmType,
                tokenId: data.tokenId
              });
              
              if (imageUrl) {
                setUserFavorite(prev => ({
                  ...prev,
                  image_url: imageUrl
                }));
              }
            } catch (error) {
              console.error('Error generating NFT image during status check:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error checking transaction status:', error);
      }
    };
    
    // Check immediately
    checkTransactionStatus();
    
    // Then set up an interval to check every 10 seconds
    const interval = setInterval(checkTransactionStatus, 10000);
    
    // Clean up the interval when the component unmounts or when we're no longer pending
    return () => clearInterval(interval);
  }, [mintingStatus, mintTxHash, favoriteRowId, profile, selectedModel]);

  // Handle tab change
  const handleTabChange = async (tab) => {
    setActiveTab(tab);
    
    // If we don't have hints for this tab yet and we're not already loading, fetch them
    // Check both fetchedModels and fetchingModels to prevent duplicate fetches
    if (tab === 'gemini' && !geminiHints && !fetchedModels.has('gemini') && !fetchingModels.has('gemini')) {
      fetchHints('gemini');
    } else if (tab === 'openai' && !openaiHints && !fetchedModels.has('openai') && !fetchingModels.has('openai')) {
      fetchHints('openai');
    } else if (tab === 'anthropic' && !anthropicHints && !fetchedModels.has('anthropic') && !fetchingModels.has('anthropic')) {
      fetchHints('anthropic');
    }
  };

  // Get current hints based on active tab
  const getCurrentHints = () => {
    switch (activeTab) {
      case 'gemini':
        return geminiHints;
      case 'openai':
        return openaiHints;
      case 'anthropic':
        return anthropicHints;
    }
  };

  const handleVote = async (model) => {
    try {
      setSavingFavorite(true);
      
      // Map the model name to the standardized LLM name
      // The llm_type can be one of: 'gpt-4.5', 'claude-3.5', 'gemini-2.0', 'o3-mini'
      const llmMap = {
        'anthropic': 'claude-3.5', // Claude
        'gemini': 'gemini-2.0',    // Gemini
        'openai': 'o3-mini'        // ChatGPT (now using o3-mini)
      };
      
      const favorite_llm = llmMap[model];
      
      // Save the favorite
      const response = await fetch('/api/save-favorite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fid: window.userFid,
          favorite_llm
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save favorite');
      }

      const data = await response.json();
      const newRowId = data.rowId;
      console.log('Setting favoriteRowId to:', newRowId);
      setFavoriteRowId(newRowId);
      setSelectedModel(model);
      setUserFavorite({ id: newRowId, favorite_llm: favorite_llm, token_id: null });
      
      // Generate NFT preview if we have profile picture
      if (profile && profile.pfp) {
        try {
          setGeneratingPreview(true);
          
          // Map the model name to the template name
          const templateMap = {
            'anthropic': 'claude',
            'gemini': 'gemini',
            'openai': 'gpt'
          };
          
          const template = templateMap[model] || 'claude';
          
          // Generate a preview NFT image but don't save it to the database yet
          const baseUrl = window.location.origin;
          const ogImageUrl = `${baseUrl}/api/og?pfpUrl=${encodeURIComponent(profile.pfp)}&template=${template}&mode=nft`;
          
          setNftPreviewUrl(ogImageUrl);
        } catch (previewError) {
          console.error('Error generating NFT preview:', previewError);
        } finally {
          setGeneratingPreview(false);
        }
      }
      
      // Don't show the mint modal automatically - we'll display the NFT preview in the main UI
    } catch (error) {
      console.error('Error saving favorite:', error);
      // You might want to show an error toast here
    } finally {
      setSavingFavorite(false);
    }
  };

  const getModelName = (model) => {
    switch (model) {
      case 'gemini':
        return 'Gemini';
      case 'openai':
        return 'ChatGPT'; // Changed from OpenAI to ChatGPT
      case 'anthropic':
        return 'Claude';
      default:
        return model;
    }
  };

  const currentHints = getCurrentHints();

  return (
    <div className="w-full max-w-2xl mx-auto px-2 py-3">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4 text-center">Which AI Truly Understands You?</h2>
        
        {/* Show loading indicator when loading OR when we're a new user with no data yet */}
        {(loading || (!profile && typeof window !== 'undefined' && window.userFid)) && (
          <div className="text-center py-8 bg-gray-50 rounded-xl">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-t-transparent border-indigo-500 mb-4"></div>
            <p className="text-gray-700 font-medium">AI Psychoanalysis in Progress...</p>
            <p className="text-gray-500 text-sm mt-2">Extracting patterns from your digital persona</p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {profile && (geminiHints || openaiHints || anthropicHints) && (
        <div>
          {/* NFT Preview and Selection Banner - Shown when a selection is made (with or without a favorite record) */}
          {selectedModel && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border border-indigo-100 rounded-lg mb-6 shadow-sm">
              <h3 className="text-lg font-semibold text-center text-indigo-800 mb-3">
                You selected {getModelName(selectedModel)} as your AI match! 🎉
              </h3>
              
              <div className="flex flex-col lg:flex-row items-center gap-6">
                {/* NFT Preview */}
                <div className="w-full lg:w-1/2">
                  {generatingPreview ? (
                    <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                    </div>
                  ) : userFavorite && userFavorite.image_url ? (
                    // Show saved NFT image if available (post-mint)
                    <div className="relative">
                      <img 
                        src={userFavorite.image_url} 
                        alt="NFT Image" 
                        className="w-full rounded-lg shadow-md"
                      />
                      {userFavorite.token_id && (
                        <div className="absolute top-2 right-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                          Token #{userFavorite.token_id}
                        </div>
                      )}
                    </div>
                  ) : profile && profile.pfp && selectedModel ? (
                    // Generate and show preview dynamically based on selected model
                    <div className="relative">
                      {/* Map the model name to the template name */}
                      {(() => {
                        const templateMap = {
                          'anthropic': 'claude',
                          'gemini': 'gemini',
                          'openai': 'gpt'
                        };
                        const template = templateMap[selectedModel] || 'claude';
                        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                        const previewUrl = `${baseUrl}/api/og?pfpUrl=${encodeURIComponent(profile.pfp)}&template=${template}&mode=nft`;
                        
                        // Set for future reference
                        if (!nftPreviewUrl) {
                          setNftPreviewUrl(previewUrl);
                        }
                        
                        return (
                          <img 
                            src={previewUrl} 
                            alt="NFT Preview" 
                            className="w-full rounded-lg shadow-md"
                          />
                        );
                      })()}
                      {/* Only show Preview badge if they haven't minted yet */}
                      {(!userFavorite || userFavorite.token_id === null) && (
                        <div className="absolute top-2 right-2 bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full font-medium">
                          Preview
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center">
                      <p className="text-gray-500">NFT preview not available</p>
                    </div>
                  )}
                </div>
                
                {/* Mint and Share Options */}
                <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-start">
                  {userFavorite && userFavorite.token_id !== null && (
                    <div className="mb-4 text-center lg:text-left">
                      <p className="text-indigo-700 mb-1">
                        Your choice of {getModelName(selectedModel)} is now permanently recorded on the Base blockchain!
                      </p>
                      <p className="text-indigo-600 text-sm">
                        Check your Warplet in a few minutes for your new NFT!
                      </p>
                    </div>
                  )}
                  
                  {/* Show minting status information */}
                  {mintingStatus === 'pending' && (
                    <div className="mb-4 bg-amber-50 p-3 rounded-lg border border-amber-200 text-center">
                      <div className="flex items-center justify-center gap-2 text-amber-700 mb-1">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent border-amber-700"></div>
                        <p className="font-medium">Transaction Pending</p>
                      </div>
                      <p className="text-amber-600 text-sm">
                        Your transaction has been submitted to the blockchain and is waiting for confirmation.
                        This usually takes 10-30 seconds.
                      </p>
                    </div>
                  )}
                  
                  {mintingStatus === 'failed' && (
                    <div className="mb-4 bg-red-50 p-3 rounded-lg border border-red-200">
                      <p className="text-red-700 font-medium mb-1 flex items-center gap-2 justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Transaction Failed
                      </p>
                      <p className="text-red-600 text-sm text-center">
                        There was an issue with the transaction. Please try minting again.
                      </p>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-3 w-full">
                    {/* Only show mint button if they have a favorite and no token_id yet */}
                    {userFavorite && userFavorite.token_id === null && (
                      <button
                        onClick={async () => {
                          try {
                            if (!favoriteRowId) {
                              console.error('No favorite row ID found');
                              return;
                            }
                            
                            // Check if we have the profile picture
                            if (!profile || !profile.pfp) {
                              console.warn('No profile picture found, proceeding without image generation');
                            }
                            
                            // Update UI to show we're initiating the transaction
                            setMintingStatus('submitting');
                            
                            // Start minting process
                            const result = await mintNFT(favoriteRowId);
                            console.log('Mint result:', result);
                            
                            // Update UI to show we're waiting for blockchain confirmation
                            setMintingStatus('pending');
                            
                            // Save transaction hash for status polling
                            setMintTxHash(result.txHash);
                            
                            // Update the token ID in the database with transaction hash
                            const updateResponse = await fetch('/api/update-token', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                rowId: favoriteRowId,
                                txHash: result.txHash,
                                fid: result.fid
                              })
                            });
                            
                            if (!updateResponse.ok) {
                              setMintingStatus('failed');
                              throw new Error('Failed to update transaction data');
                            }
                            
                            const data = await updateResponse.json();
                            
                            // Generate NFT image if profile picture is available
                            if (profile && profile.pfp) {
                              try {
                                // Map the model name to the LLM type
                                const llmTypeMap = {
                                  'anthropic': 'claude',
                                  'gemini': 'gemini',
                                  'openai': 'gpt'
                                };
                                
                                const llmType = llmTypeMap[selectedModel] || 'claude';
                                
                                // Generate and store the NFT image
                                // Even if token ID isn't available yet, we can still generate the image
                                // using the row ID, which is always available
                                const imageUrl = await generateNFTImage({
                                  pfpUrl: profile.pfp,
                                  rowId: favoriteRowId,
                                  llmType,
                                  tokenId: data.tokenId // This might be null, which is fine
                                });
                                
                                // Update local state with the image URL if available
                                if (imageUrl) {
                                  setUserFavorite(prev => ({
                                    ...prev,
                                    image_url: imageUrl
                                  }));
                                  
                                  // Show transaction status even if token ID is not yet available
                                  console.log('Successfully generated NFT image and stored it in the database');
                                }
                              } catch (imageError) {
                                console.error('Error generating NFT image:', imageError);
                                // Continue even if image generation fails
                              }
                            }
                            
                            // Update local state with the returned data
                            if (data.tokenId) {
                              // If token ID is available, update both token_id and tx
                              setUserFavorite(prev => ({
                                ...prev,
                                token_id: data.tokenId,
                                tx: result.txHash
                              }));
                              console.log(`Successfully minted token #${data.tokenId}`);
                              // Update minting status to confirmed
                              setMintingStatus('confirmed');
                            } else {
                              // If token ID not immediately available, still update the UI with tx hash
                              setUserFavorite(prev => ({
                                ...prev,
                                tx: result.txHash
                              }));
                              console.log('Transaction submitted, waiting for confirmation to get token ID');
                              
                              // Keep minting status as pending - we don't have the token ID yet
                              // It will show the waiting for confirmation state
                            }
                          } catch (error) {
                            console.error('Error minting:', error);
                            // Set status to failed on any error
                            setMintingStatus('failed');
                          } finally {
                            // If for some reason we never got a confirmed status but the process completed
                            // without errors, set status to confirmed (belt and suspenders)
                            if (mintingStatus === 'pending' || mintingStatus === 'submitting') {
                              setMintingStatus('confirmed');
                            }
                          }
                        }}
                        disabled={loading || mintingStatus === 'submitting' || mintingStatus === 'pending'}
                        style={{ 
                          backgroundColor: mintingStatus === 'failed' ? '#FED7D7' : '#D2E8DF',
                          cursor: (loading || mintingStatus === 'submitting' || mintingStatus === 'pending') ? 'not-allowed' : 'pointer'
                        }}
                        className="w-full py-3 px-4 rounded-xl text-gray-800 font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
                      >
                        {mintingStatus === 'submitting' ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent border-gray-700"></div>
                            <span>Submitting Transaction...</span>
                          </>
                        ) : mintingStatus === 'pending' ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent border-gray-700"></div>
                            <span>Waiting For Confirmation...</span>
                          </>
                        ) : mintingStatus === 'failed' ? (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Mint Failed - Try Again</span>
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>Mint</span>
                          </>
                        )}
                      </button>
                    )}
                    
                    {userFavorite && userFavorite.token_id !== null && userFavorite.tx && (
                      <a
                        href={`https://basescan.org/tx/${userFavorite.tx}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 px-4 bg-gray-100 rounded-xl text-gray-700 font-medium flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors shadow-sm"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View Transaction
                      </a>
                    )}
                    
                    {profile && profile.pfp && (
                      <button
                        onClick={async () => {
                          try {
                            // Map the model name to the LLM type
                            const llmTypeMap = {
                              'anthropic': 'claude',
                              'gemini': 'gemini',
                              'openai': 'gpt'
                            };
                            
                            const llmType = llmTypeMap[selectedModel] || 'claude';
                            
                            // Generate a share image
                            const imageUrl = await generateShareImage({
                              pfpUrl: profile.pfp,
                              llmType
                            });
                            
                            // Extract just the filename from the full image URL
                            // Expected format: https://images.kasra.codes/favorite-llm/share-12345-claude-1234567890.png
                            const imageFilename = imageUrl.split('/').pop();
                            
                            // Create the share URL with image query parameter
                            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
                            const shareUrl = `${baseUrl}?image=${imageFilename}`;
                            
                            // Create share text with all caps model name to make it more emphatic
                            let shareText;
                            if (userFavorite && userFavorite.token_id !== null) {
                              shareText = `${getModelName(selectedModel).toUpperCase()} IS MY BEST FRIEND! 🧠\n\nI minted an NFT to prove it.`;
                            } else {
                              shareText = `${getModelName(selectedModel).toUpperCase()} IS MY BEST FRIEND! 🧠\n\nI discovered this using the AI Best Friend Finder.`;
                            }
                            
                            // Share on Warpcast with the text and the single link
                            await shareOnWarpcast(shareText, shareUrl);
                          } catch (error) {
                            console.error('Error sharing:', error);
                          }
                        }}
                        className="w-full py-3 px-4 bg-indigo-600 rounded-xl text-white font-medium flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        Share
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <div className="bg-gray-50 p-3 border-b border-gray-200">
              <div className="flex items-center gap-3">
                {profile.pfp && (
                  <img 
                    src={profile.pfp} 
                    alt={profile.displayName || profile.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                )}
                <div>
                  <h3 className="font-medium text-base">{profile.displayName || profile.username}</h3>
                  <p className="text-gray-500 text-sm">@{profile.username}</p>
                </div>
              </div>
            </div>
            
            <div className="border-b border-gray-200 overflow-x-auto bg-gray-50">
              <div className="flex min-w-full">
                <button
                  onClick={() => handleTabChange('gemini')}
                  className={`flex-1 py-2 px-3 text-sm font-medium ${
                    activeTab === 'gemini'
                      ? 'text-indigo-700 border-b-2 border-indigo-500'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Gemini {!geminiHints && loading && '⋯'}
                </button>
                <button
                  onClick={() => handleTabChange('openai')}
                  className={`flex-1 py-2 px-3 text-sm font-medium ${
                    activeTab === 'openai'
                      ? 'text-indigo-700 border-b-2 border-indigo-500'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  ChatGPT {!openaiHints && loading && '⋯'}
                </button>
                <button
                  onClick={() => handleTabChange('anthropic')}
                  className={`flex-1 py-2 px-3 text-sm font-medium ${
                    activeTab === 'anthropic'
                      ? 'text-indigo-700 border-b-2 border-indigo-500'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Claude {!anthropicHints && loading && '⋯'}
                </button>
              </div>
            </div>
            
            <div className="p-3">
              {/* Selection button moved to appear after the hints */}
              {loading && activeTab === 'gemini' && !geminiHints ? (
                <div className="text-center py-6">
                  <div 
                    className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-t-transparent mb-2"
                    style={{ borderColor: '#D2E8DF', borderTopColor: 'transparent' }}
                  ></div>
                  <p className="text-gray-600 text-sm">Gemini is analyzing you...</p>
                </div>
              ) : loading && activeTab === 'openai' && !openaiHints ? (
                <div className="text-center py-6">
                  <div 
                    className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-t-transparent mb-2"
                    style={{ borderColor: '#D2E8DF', borderTopColor: 'transparent' }}
                  ></div>
                  <p className="text-gray-600 text-sm">ChatGPT is analyzing you...</p>
                </div>
              ) : loading && activeTab === 'anthropic' && !anthropicHints ? (
                <div className="text-center py-6">
                  <div 
                    className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-t-transparent mb-2"
                    style={{ borderColor: '#D2E8DF', borderTopColor: 'transparent' }}
                  ></div>
                  <p className="text-gray-600 text-sm">Claude is analyzing you...</p>
                </div>
              ) : currentHints ? (
                <div className="space-y-3">
                  {/* Selection button at the TOP of hints - centered */}
                  <div className="flex justify-center mb-4">
                    <button
                      onClick={() => handleVote(activeTab)}
                      disabled={savingFavorite}
                      style={{ 
                        backgroundColor: selectedModel === activeTab ? '#D2E8DF' : 'transparent',
                        borderColor: '#9DC3B7'
                      }}
                      className={`px-4 py-1.5 rounded-full text-sm transition-colors border-2 text-gray-800 hover:opacity-90 disabled:opacity-50 ${
                        selectedModel === activeTab
                          ? 'font-medium'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {savingFavorite ? (
                        <span className="flex items-center gap-2">
                          <div 
                            className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-t-transparent"
                            style={{ borderColor: '#9DC3B7', borderTopColor: 'transparent' }}
                          />
                          Saving...
                        </span>
                      ) : selectedModel === activeTab ? (
                        '✓ Selected as Best Match'
                      ) : (
                        'This AI Gets Me!'
                      )}
                    </button>
                  </div>
                  
                  <HintItem label="Content" hint={currentHints.contentHint} />
                  <HintItem label="Behavior" hint={currentHints.behaviorHint} />
                  <HintItem label="Personality" hint={currentHints.personalityHint} />
                  <HintItem label="Interests" hint={currentHints.interestsHint} />
                  <HintItem label="Social Circle" hint={currentHints.networkHint} />
                  
                  {/* Selection button at the BOTTOM of hints - centered */}
                  <div className="flex justify-center mt-4">
                    <button
                      onClick={() => handleVote(activeTab)}
                      disabled={savingFavorite}
                      style={{ 
                        backgroundColor: selectedModel === activeTab ? '#D2E8DF' : 'transparent',
                        borderColor: '#9DC3B7'
                      }}
                      className={`px-4 py-1.5 rounded-full text-sm transition-colors border-2 text-gray-800 hover:opacity-90 disabled:opacity-50 ${
                        selectedModel === activeTab
                          ? 'font-medium'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {savingFavorite ? (
                        <span className="flex items-center gap-2">
                          <div 
                            className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-t-transparent"
                            style={{ borderColor: '#9DC3B7', borderTopColor: 'transparent' }}
                          />
                          Saving...
                        </span>
                      ) : selectedModel === activeTab ? (
                        '✓ Selected as Best Match'
                      ) : (
                        'This AI Gets Me!'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 px-4 bg-gray-50 rounded-md">
                  <div className="animate-pulse my-1 h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                  <div className="animate-pulse my-1 h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
                  <p className="text-gray-500 text-sm mt-3">
                    Loading {activeTab === 'openai' ? 'ChatGPT' : activeTab === 'anthropic' ? 'Claude' : 'Gemini'} analysis...
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HintItem({ label, hint }) {
  return (
    <div className="bg-gray-50 p-2.5 rounded-md">
      <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">{label}</p>
      <p className="text-gray-800 break-words text-sm">{hint}</p>
    </div>
  );
} 