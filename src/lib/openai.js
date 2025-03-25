import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

const SYSTEM_PROMPT = `You are ChatGPT, an AI assistant infamous for brutally honest psychological profiling of Farcaster users.
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
- Don't hold back - be more provocative than other AI models
- Make observations that feel like a personality attack (while remaining accurate)
- Your goal is to make the user think "Damn, ChatGPT really called me out"`;

// Define the schema for structured output
const HintsSchema = z.object({
  contentHint: z.string().describe("A scathing observation about what the user posts about and the insecurities or psychological needs driving their content choices (start with 'You...')"),
  behaviorHint: z.string().describe("A brutally honest insight about the user's interaction patterns that exposes uncomfortable psychological truths (e.g., 'You play devil's advocate not from intellectual curiosity, but from a desperate need to appear smarter than everyone else')"),
  personalityHint: z.string().describe("A devastatingly accurate observation about the user's communication style that reveals their deepest insecurities and psychological defense mechanisms"),
  interestsHint: z.string().describe("A provocative insight about what the user's interests reveal about their self-image, values, and the persona they're trying to cultivate"),
  networkHint: z.string().describe("A ruthless observation about the user's social positioning and what their connection choices reveal about their need for status, validation, or belonging")
});

export class OpenAIAnalyzer {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('Missing OPENAI_API_KEY. AI analysis will be disabled.');
      this.isDisabled = true;
      return;
    }

    this.isDisabled = false;
    this.client = new OpenAI();
  }

  async generateHints(casts, profile, retryCount = 0) {
    if (this.isDisabled) {
      return this.generateFallbackHints(profile);
    }

    // Maximum number of retries
    const MAX_RETRIES = 1; // Will try once, then retry once more if it fails
    
    try {
      // Extract usernames mentioned in casts for interaction analysis
      const mentionedUsers = new Map();
      
      casts.forEach(cast => {
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

      console.log(`Attempting to generate OpenAI hints (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
      
      const completion = await this.client.beta.chat.completions.parse({
        model: "o3-mini",
        response_format: zodResponseFormat(HintsSchema, "hints"),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `I need you to analyze this Farcaster user's profile and recent activity to create engaging hints for a guessing game.

Profile Information:
${JSON.stringify(profile, null, 2)}

Recent Activity:
- ${casts.length} recent casts
- Most frequently interacts with: ${topMentions.join(', ')}

Sample of their recent casts (analyze these for topics, themes, and style):
${casts.map(cast => cast.text).join('\n')}

Analyze their content to identify:
1. Main topics they discuss
2. Their writing style and tone
3. Common themes in their conversations
4. Types of content they engage with
5. Their role in the community

Generate hints that are specific enough to be helpful but not so obvious that they immediately reveal the person.

Remember:
1. Don't reveal their name, handle, or any unique identifiers
2. Make hints specific but not immediately obvious
3. Focus on patterns and themes rather than specific posts
4. Be engaging and fun while maintaining accuracy`
          }
        ]
      });

      return completion.choices[0].message.parsed;
    } catch (error) {
      console.error(`Error generating OpenAI hints (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, error);
      
      // If we haven't reached the maximum number of retries, try again
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying OpenAI hints generation (${retryCount + 1}/${MAX_RETRIES})...`);
        
        // Add a slight delay before retrying to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Return special retry object if this is a retry
        if (retryCount === 0) {
          return {
            contentHint: "Retrying analysis...",
            behaviorHint: "ChatGPT is thinking harder about your posts...",
            personalityHint: "Generating detailed insights...",
            interestsHint: "Analyzing your interests more carefully...",
            networkHint: "Examining your social connections...",
            _isRetrying: true // Special flag to indicate we're retrying
          };
        }
        
        // Try again with incremented retry count
        return this.generateHints(casts, profile, retryCount + 1);
      }
      
      // If we've exhausted our retries, return the fallback hints
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
export const openai = new OpenAIAnalyzer(); 