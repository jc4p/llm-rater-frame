'use client';

import { useState, useEffect } from 'react';
import UserHints from './UserHints';
import { mintNFT } from '@/lib/frame';

export default function HomeComponent() {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userFavorite, setUserFavorite] = useState(null);
  const [showMintModal, setShowMintModal] = useState(false);

  const checkFavoriteStatus = async () => {
    // Safely check for window object (prevents SSR issues)
    if (typeof window === 'undefined' || !window.userFid) return;

    try {
      const response = await fetch(`/api/check-favorite?fid=${window.userFid}`);
      const data = await response.json();
      
      if (data.hasFavorite) {
        setUserFavorite(data.favorite);
        // Remove automatic showing of mint modal
      } else {
        console.log('No favorite found, new user detected');
        // If no favorite exists, we ensure the user is set to null explicitly
        // This will trigger the useEffect in UserHints for new users
        setUserFavorite(null);
      }
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  };

  useEffect(() => {
    // Only run this effect on the client side
    if (typeof window === 'undefined') return;
    
    // Import frameReady dynamically to avoid SSR issues
    import('@/lib/frame').then(({ frameReady }) => {
      // Check every 1s if userFid is available (it's set by frame.js)
      const interval = setInterval(() => {
        if (window.userFid) {
          checkFavoriteStatus();
          
          // Always call frameReady here to ensure the frame is interactive
          // This ensures the splash screen is removed and the frame is responsive
          frameReady();
          
          clearInterval(interval);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    });
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/get-leaderboard');
      const data = await response.json();
      setLeaderboardData(data);
      setShowLeaderboard(true);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-fog p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-end mb-4">
            <button
              onClick={fetchLeaderboard}
              className="flex items-center justify-center w-10 h-10 bg-white rounded-full shadow-sm hover:shadow-md transition-all"
              disabled={loading}
              aria-label="View leaderboard"
            >
              <span role="img" aria-label="trophy" className="text-xl">🏆</span>
            </button>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <UserHints initialFavorite={userFavorite} />
          </div>
        </div>
      </div>

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.50)' }}
          onClick={() => setShowLeaderboard(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold">AI Model Leaderboard</h2>
              <button 
                onClick={() => setShowLeaderboard(false)}
                className="text-gray-500 hover:text-gray-700 p-2"
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              {loading ? (
                <div className="text-center py-8">
                  <div 
                    className="inline-block animate-spin rounded-full h-6 w-6 border-3 border-t-transparent"
                    style={{ borderColor: '#D2E8DF', borderTopColor: 'transparent' }}
                  ></div>
                  <p className="mt-2">Loading leaderboard data...</p>
                </div>
              ) : leaderboardData && (
                <>
                  <p className="text-gray-600 mb-4">
                    Total Votes: {leaderboardData.total_votes}
                  </p>
                  <div className="space-y-3">
                    {leaderboardData.leaderboard.map((item, index) => (
                      <div 
                        key={item.favorite_llm}
                        className="relative overflow-hidden bg-gray-50 rounded-lg"
                      >
                        <div 
                          className="absolute left-0 top-0 h-full bg-wave opacity-10"
                          style={{ 
                            width: `${(item.users_count / leaderboardData.total_votes) * 100}%`,
                            backgroundColor: '#D2E8DF'
                          }}
                        />
                        <div className="relative flex items-center justify-between p-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''}
                            </span>
                            <span className="font-medium">{item.display_name || item.favorite_llm}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-gray-600">{item.users_count} votes</span>
                            <div className="text-xs text-gray-400">
                              {((item.users_count / leaderboardData.total_votes) * 100).toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-gray-400 text-xs mt-4">
                    Last updated: {new Date(leaderboardData.updated_at).toLocaleString()}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mint Modal */}
      {showMintModal && userFavorite && !userFavorite.token_id && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.50)' }}
          onClick={() => setShowMintModal(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold">Mint Your Decision</h2>
              <button 
                onClick={() => setShowMintModal(false)}
                className="text-gray-500 hover:text-gray-700 p-2"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <p className="text-gray-600 mb-6">
                Would you like to mint your decision as an NFT? This will create a permanent record of your choice on the blockchain.
              </p>
              
              <div className="flex gap-4">
                <button
                  onClick={async () => {
                    try {
                      // Get user profile for the PFP
                      // Safely check for window object (prevents SSR issues)
                      if (typeof window === 'undefined') {
                        throw new Error('Window not defined');
                      }
                      
                      const profileResponse = await fetch(`/api/hints?fid=${window.userFid}&limit=1`);
                      const profileData = await profileResponse.json();
                      const pfpUrl = profileData.profile?.pfp;
                      
                      // Check if we have the profile picture
                      if (!pfpUrl) {
                        console.warn('No profile picture found, proceeding without image generation');
                      }
                      
                      // Start minting
                      const result = await mintNFT(userFavorite.id);
                      console.log('Mint result:', result);

                      // Update the token ID in the database with the transaction hash
                      const updateResponse = await fetch('/api/update-token', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          rowId: userFavorite.id,
                          txHash: result.txHash,
                          fid: result.fid
                        })
                      });

                      if (!updateResponse.ok) {
                        throw new Error('Failed to update transaction data');
                      }
                      
                      // Generate NFT image if profile picture is available
                      if (pfpUrl) {
                        try {
                          // Map the LLM name to the template name
                          const llmTypeMap = {
                            'claude-3.5': 'claude',
                            'gemini-2.0': 'gemini',
                            'gpt-4.5': 'gpt'
                          };
                          
                          const llmType = llmTypeMap[userFavorite.favorite_llm] || 'claude';
                          
                          // Generate and store the NFT image
                          const imageUrl = await generateNFTImage({
                            pfpUrl,
                            rowId: userFavorite.id,
                            llmType,
                            tokenId: result.tokenId // This might be undefined, which is fine
                          });
                          
                          console.log('Generated NFT image:', imageUrl);
                        } catch (imageError) {
                          console.error('Error generating NFT image:', imageError);
                          // Continue even if image generation fails
                        }
                      }

                      // Refresh user's favorite status
                      await checkFavoriteStatus();
                      setShowMintModal(false);
                    } catch (error) {
                      console.error('Error minting:', error);
                      // You might want to show an error toast here
                    }
                  }}
                  style={{ backgroundColor: '#D2E8DF' }}
                  className="flex-1 px-4 py-2 text-gray-800 rounded-lg hover:opacity-90 transition-opacity"
                >
                  Yes, Mint It!
                </button>
                <button
                  onClick={() => setShowMintModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 