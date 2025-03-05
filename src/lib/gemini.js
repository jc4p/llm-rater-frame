import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const SYSTEM_PROMPT = `You are an AI assistant helping to create engaging hints about a Farcaster user for a guessing game.
Your hints should be fun and specific but not too obvious.
Focus on unique characteristics and patterns in their content.
Never reveal the user's name or exact handle in your hints.
Always use "onchain" (no hyphen) when referring to blockchain activities.`;

const hintsSchema = {
  type: SchemaType.OBJECT,
  properties: {
    contentHint: {
      type: SchemaType.STRING,
      description: "A hint about what they typically post about and their posting style",
      nullable: false,
    },
    behaviorHint: {
      type: SchemaType.STRING,
      description: "A hint about their unique interaction patterns (e.g., 'Often plays devil's advocate in tech debates', 'Loves to hype up and celebrate others' achievements', 'Known for their detailed technical breakdowns of new protocols', 'Always first to welcome newcomers to the community')",
      nullable: false,
    },
    personalityHint: {
      type: SchemaType.STRING,
      description: "A hint about their communication style and demeanor (e.g., 'Takes a thoughtful, measured approach to discussions', 'Brings high energy and enthusiasm to every conversation', 'Known for their sharp wit and playful banter', 'Tends to be diplomatic and seeks common ground')",
      nullable: false,
    },
    interestsHint: {
      type: SchemaType.STRING,
      description: "A hint about their apparent interests, opinions, or expertise based on their content",
      nullable: false,
    },
    networkHint: {
      type: SchemaType.STRING,
      description: "A hint about the types of people they interact with and their role in the community",
      nullable: false,
    }
  },
  required: ["contentHint", "behaviorHint", "personalityHint", "interestsHint", "networkHint"]
};

export class GeminiAnalyzer {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('Missing GEMINI_API_KEY. AI analysis will be disabled.');
      this.isDisabled = true;
      return;
    }

    this.isDisabled = false;
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        responseSchema: hintsSchema,
      }
    });
  }

  async generateHints(casts, profile) {
    if (this.isDisabled) {
      return this.generateFallbackHints(profile);
    }

    try {
      // Debug logs for casts parameter - only for FID 4407
      if (profile.username === 'jc4p' || profile.fid === 4407) {
        console.log('Casts type:', typeof casts);
        console.log('Casts value:', casts);
      }

      // Handle both single cast object and array of casts
      let castsArray = casts;
      if (!Array.isArray(casts)) {
        if (casts === null || casts === undefined) {
          console.error('Casts is null or undefined');
          return this.generateFallbackHints(profile);
        }
        // If it's a single cast object with text property, wrap it in an array
        if (typeof casts === 'object' && casts.text && typeof casts.text === 'string') {
          castsArray = [casts];
        } else if (typeof casts === 'object' && casts.casts && Array.isArray(casts.casts)) {
          // If it's an object with a casts array property
          castsArray = casts.casts;
        } else {
          console.error('Invalid casts format:', JSON.stringify(casts, null, 2));
          return this.generateFallbackHints(profile);
        }
      }

      if (profile.username === 'jc4p' || profile.fid === 4407) {
        console.log('Processed casts array length:', castsArray.length);
        console.log('First cast sample:', castsArray[0]);
      }

      // Extract usernames mentioned in casts for interaction analysis
      const mentionedUsers = new Map();
      
      castsArray.forEach(cast => {
        const matches = cast.text.match(/@(\w+)/g) || [];
        matches.forEach(match => {
          const username = match.slice(1);
          mentionedUsers.set(username, (mentionedUsers.get(username) || 0) + 1);
        });
      });

      // Sort users by mention frequency
      const topMentions = Array.from(mentionedUsers.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([user, count]) => `@${user} (${count} mentions)`);

      // Fetch profile picture if available
      let profilePicData = null;
      if (profile.pfp) {
        try {
          const imageResp = await fetch(profile.pfp);
          const imageBuffer = await imageResp.arrayBuffer();
          profilePicData = {
            inlineData: {
              data: Buffer.from(imageBuffer).toString("base64"),
              mimeType: "image/jpeg",
            },
          };
        } catch (error) {
          console.error('Error fetching profile picture:', error);
        }
      }

      const textPrompt = {
        text: `${SYSTEM_PROMPT}

I need you to analyze this Farcaster user's profile and recent activity to create engaging hints for a guessing game.

Profile Information:
${JSON.stringify(profile, null, 2)}

Recent Activity:
- ${castsArray.length} recent casts
- Most frequently interacts with: ${topMentions.join(', ')}

Sample of their recent casts (analyze these for topics, themes, and style):
${castsArray.map(cast => cast.text).join('\n')}

Analyze their content to identify:
1. Main topics they discuss
2. Their writing style and tone
3. Common themes in their conversations
4. Types of content they engage with
5. Their role in the community

Generate 4 hints that are specific enough to be helpful but not so obvious that they immediately reveal the person.

Remember:
1. Don't reveal their name, handle, or any unique identifiers
2. Make hints specific but not immediately obvious
3. Focus on patterns and themes rather than specific posts
4. Be engaging and fun while maintaining accuracy
5. For the profile picture, simply describe what is in it (e.g., 'a cartoon character wearing a hat', 'a person standing in front of mountains') - don't describe the style or mood`
      };

      // Combine text and image for the prompt
      const promptParts = profilePicData 
        ? [profilePicData, textPrompt]
        : [textPrompt];

      const result = await this.model.generateContent(promptParts);
      return JSON.parse(result.response.text());
    } catch (error) {
      console.error('Error generating hints:', error);
      return this.generateFallbackHints(profile);
    }
  }

  generateFallbackHints(profile) {
    return {
      contentHint: "This user is active in the Farcaster community",
      behaviorHint: "They engage regularly with others' posts",
      personalityHint: "They have a balanced and friendly communication style",
      interestsHint: "They seem interested in web3 and technology",
      networkHint: "They interact with various people in the tech community"
    };
  }
}

// Create singleton instance
export const gemini = new GeminiAnalyzer(); 