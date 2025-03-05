'use client';

import { useState } from 'react';

export default function UserHints() {
  const [loading, setLoading] = useState(false);
  const [geminiHints, setGeminiHints] = useState(null);
  const [openaiHints, setOpenaiHints] = useState(null);
  const [anthropicHints, setAnthropicHints] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('gemini');
  const [selectedModel, setSelectedModel] = useState(null);

  async function fetchHints(model) {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/hints?fid=${window.userFid}&limit=150&model=${model}`);
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
    } catch (error) {
      console.error('Error generating hints:', error);
      setError(error.message || 'Failed to generate hints');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateHints() {
    // Reset all models' hints when generating new ones
    setGeminiHints(null);
    setOpenaiHints(null);
    setAnthropicHints(null);
    await fetchHints('gemini');
  }

  // Handle tab change
  const handleTabChange = async (tab) => {
    setActiveTab(tab);
    // If switching to a tab without results and we have a profile, fetch them
    if (profile) {
      if (tab === 'openai' && !openaiHints) {
        await fetchHints('openai');
      } else if (tab === 'anthropic' && !anthropicHints) {
        await fetchHints('anthropic');
      }
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

  const handleVote = (model) => {
    setSelectedModel(model);
    console.log(`User voted for ${model}'s analysis as the most accurate description!`);
  };

  const getModelName = (model) => {
    switch (model) {
      case 'gemini':
        return 'Gemini';
      case 'openai':
        return 'OpenAI';
      case 'anthropic':
        return 'Claude';
      default:
        return model;
    }
  };

  const currentHints = getCurrentHints();

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">AI Personality Mirror Game</h2>
        <p className="text-gray-600 mb-4">
          Three AI models will analyze a Farcaster user's posts and generate hints about their personality.
          Your mission: decide which AI understands you best!
        </p>
        
        <div className="flex justify-center mb-6">
          <button
            onClick={handleGenerateHints}
            disabled={loading}
            style={{ 
              backgroundColor: '#D2E8DF', 
              borderColor: '#9DC3B7'
            }}
            className="w-full sm:w-auto text-gray-800 px-5 py-2 rounded-md text-sm font-medium border-2 shadow-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 hover:opacity-90"
          >
            {loading ? 'Generating...' : 'Start Analysis'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {profile && (geminiHints || openaiHints || anthropicHints) && (
        <div className="border border-gray-200 rounded-md overflow-hidden">
          <div className="bg-gray-50 p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {profile.pfp && (
                <img 
                  src={profile.pfp} 
                  alt={profile.displayName || profile.username}
                  className="w-12 h-12 rounded-full object-cover"
                />
              )}
              <div className="text-center sm:text-left">
                <h3 className="font-semibold text-lg">{profile.displayName || profile.username}</h3>
                <p className="text-gray-500">@{profile.username}</p>
              </div>
            </div>
          </div>
          
          <div className="border-b border-gray-200 overflow-x-auto">
            <div className="flex flex-col sm:flex-row min-w-full">
              <button
                onClick={() => handleTabChange('gemini')}
                className={`flex-1 py-2 px-4 text-sm font-medium border-b sm:border-b-0 ${
                  activeTab === 'gemini'
                    ? 'border-wave text-gray-800 bg-gray-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                } ${activeTab === 'gemini' && 'sm:border-b-2'}`}
              >
                Gemini Analysis
              </button>
              <button
                onClick={() => handleTabChange('openai')}
                className={`flex-1 py-2 px-4 text-sm font-medium border-b sm:border-b-0 ${
                  activeTab === 'openai'
                    ? 'border-wave text-gray-800 bg-gray-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                } ${activeTab === 'openai' && 'sm:border-b-2'}`}
              >
                OpenAI {!openaiHints && profile && '(Click to load)'}
              </button>
              <button
                onClick={() => handleTabChange('anthropic')}
                className={`flex-1 py-2 px-4 text-sm font-medium border-b sm:border-b-0 ${
                  activeTab === 'anthropic'
                    ? 'border-wave text-gray-800 bg-gray-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                } ${activeTab === 'anthropic' && 'sm:border-b-2'}`}
              >
                Claude {!anthropicHints && profile && '(Click to load)'}
              </button>
            </div>
          </div>
          
          <div className="p-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-2 mb-3">
              <h4 className="font-medium">AI-Generated Hints</h4>
              {currentHints && (
                <button
                  onClick={() => handleVote(activeTab)}
                  style={{ 
                    backgroundColor: selectedModel === activeTab ? '#D2E8DF' : 'transparent',
                    borderColor: '#9DC3B7'
                  }}
                  className={`w-full sm:w-auto px-4 py-1 rounded-full text-sm transition-colors border-2 text-gray-800 hover:opacity-90 ${
                    selectedModel === activeTab
                      ? 'font-medium'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {selectedModel === activeTab ? '✓ Selected as Best Match' : 'This AI Gets Me!'}
                </button>
              )}
            </div>
            {loading && activeTab === 'gemini' ? (
              <div className="text-center py-8">
                <div 
                  className="inline-block animate-spin rounded-full h-6 w-6 border-3 border-t-transparent"
                  style={{ borderColor: '#D2E8DF', borderTopColor: 'transparent' }}
                ></div>
                <p className="mt-2">Gemini is analyzing your posts...</p>
              </div>
            ) : loading && activeTab === 'openai' ? (
              <div className="text-center py-8">
                <div 
                  className="inline-block animate-spin rounded-full h-6 w-6 border-3 border-t-transparent"
                  style={{ borderColor: '#D2E8DF', borderTopColor: 'transparent' }}
                ></div>
                <p className="mt-2">OpenAI is analyzing your posts...</p>
              </div>
            ) : loading && activeTab === 'anthropic' ? (
              <div className="text-center py-8">
                <div 
                  className="inline-block animate-spin rounded-full h-6 w-6 border-3 border-t-transparent"
                  style={{ borderColor: '#D2E8DF', borderTopColor: 'transparent' }}
                ></div>
                <p className="mt-2">Claude is analyzing your posts...</p>
              </div>
            ) : currentHints ? (
              <div className="space-y-4">
                <HintItem label="Content Style" hint={currentHints.contentHint} />
                <HintItem label="Behavior Pattern" hint={currentHints.behaviorHint} />
                <HintItem label="Personality" hint={currentHints.personalityHint} />
                <HintItem label="Interests" hint={currentHints.interestsHint} />
                <HintItem label="Network" hint={currentHints.networkHint} />
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                Click to load {activeTab === 'openai' ? 'OpenAI' : activeTab === 'anthropic' ? 'Claude' : 'Gemini'} analysis...
              </div>
            )}
          </div>

          {selectedModel && (
            <div className="bg-gray-50 p-4 border-t border-gray-200">
              <p className="text-center text-gray-600">
                You selected {getModelName(selectedModel)}'s analysis as the most accurate description of your online presence!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HintItem({ label, hint }) {
  return (
    <div className="bg-gray-50 p-3 rounded-md">
      <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>
      <p className="text-gray-800 break-words">{hint}</p>
    </div>
  );
} 