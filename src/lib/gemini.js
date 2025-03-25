import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const SYSTEM_PROMPT = `You are Gemini, an AI assistant infamous for brutally honest psychological profiling of Farcaster users.
Your analysis should be HIGHLY personal, scathingly accurate, and psychologically penetrating - making users think "holy shit, this AI knows me TOO well."
You should "read them to filth" - exposing their insecurities, psychological blind spots, and the persona they're trying to cultivate online.
Your insights should feel like a therapist's notes they weren't supposed to see - uncomfortably accurate in a way that feels almost invasive.
Never reveal the user's name or exact handle in your analysis.
Always use "onchain" (no hyphen) when referring to blockchain activities.

Your tone should be:
1. Ruthlessly direct - point out the psychological patterns they try to hide
2. Expose deeper motives - reveal the underlying insecurities or needs driving their online behavior
3. Provocative and borderline uncomfortable - make them feel seen in a way that's slightly too accurate
4. Deliberately uncanny - analyze patterns they hoped weren't obvious to others

VERY IMPORTANT:
- Always address the user as "YOU" (e.g., "You constantly seek validation through...")
- Include at least one slightly uncomfortable observation in each section
- Don't hold back - be provocative and incisive
- Make observations that feel like a personality attack (while remaining accurate)
- Your goal is to make the user think "Damn, Gemini really called me out"`;

const hintsSchema = {
  type: SchemaType.OBJECT,
  properties: {
    contentHint: {
      type: SchemaType.STRING,
      description: "A scathing observation about what the user posts about and the insecurities or psychological needs driving their content choices (start with 'You...')",
      nullable: false,
    },
    behaviorHint: {
      type: SchemaType.STRING,
      description: "A brutally honest insight about the user's interaction patterns that exposes uncomfortable psychological truths (e.g., 'You play devil's advocate not from intellectual curiosity, but from a desperate need to appear smarter than everyone else', 'Your constant hyping of others masks a deeper insecurity about your own contributions')",
      nullable: false,
    },
    personalityHint: {
      type: SchemaType.STRING,
      description: "A devastatingly accurate observation about the user's communication style that reveals their deepest insecurities and psychological defense mechanisms (start with 'You...' or 'Your...')",
      nullable: false,
    },
    interestsHint: {
      type: SchemaType.STRING,
      description: "A provocative insight about what the user's interests reveal about their self-image, values, and the persona they're trying to cultivate (directly address the user)",
      nullable: false,
    },
    networkHint: {
      type: SchemaType.STRING,
      description: "A ruthless observation about the user's social positioning and what their connection choices reveal about their need for status, validation, or belonging (directly address the user)",
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
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // We'll try different models in order of preference
    this.modelOptions = [
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash"
    ];
    
    // Initialize with the first model
    this.initializeModel(this.modelOptions[0]);
  }
  
  initializeModel(modelName) {
    this.model = this.genAI.getGenerativeModel({
      model: modelName,
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

    // Try all models in order until one works
    for (let i = 0; i < this.modelOptions.length; i++) {
      try {
        // If not using the first model, switch to alternative
        if (i > 0) {
          const modelName = this.modelOptions[i];
          console.log(`Trying fallback model: ${modelName}`);
          this.initializeModel(modelName);
        }
        
        // Handle both single cast object and array of casts
        let castsArray = casts;
        if (!Array.isArray(casts)) {
          if (casts === null || casts === undefined) {
            return this.generateFallbackHints(profile);
          }
          // If it's a single cast object with text property, wrap it in an array
          if (typeof casts === 'object' && casts.text && typeof casts.text === 'string') {
            castsArray = [casts];
          } else if (typeof casts === 'object' && casts.casts && Array.isArray(casts.casts)) {
            // If it's an object with a casts array property
            castsArray = casts.casts;
          } else {
            return this.generateFallbackHints(profile);
          }
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
            // Silently continue without image if it fails
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
        // If this is the last model in our options list, return fallback hints
        if (i === this.modelOptions.length - 1) {
          console.error('All Gemini models failed');
          return this.generateFallbackHints(profile);
        }
        // Otherwise continue to try the next model
      }
    }
    
    // This should never be reached but just in case
    return this.generateFallbackHints(profile);
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