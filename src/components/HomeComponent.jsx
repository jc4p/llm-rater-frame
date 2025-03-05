'use client';

import UserHints from './UserHints';

export default function HomeComponent() {
  return (
    <div className="min-h-screen bg-fog p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">LLM Rater Frame</h1>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <UserHints />
        </div>
      </div>
    </div>
  );
} 