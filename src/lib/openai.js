import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

const SYSTEM_PROMPT = `You are an AI assistant helping to create engaging hints about a Farcaster user for a guessing game.
Your hints should be fun and specific but not too obvious.
Focus on unique characteristics and patterns in their content.
Never reveal the user's name or exact handle in your hints.
Always use "onchain" (no hyphen) when referring to blockchain activities.`;

// Define the schema for structured output
const HintsSchema = z.object({
  contentHint: z.string().describe("A hint about what they typically post about and their posting style"),
  behaviorHint: z.string().describe("A hint about their unique interaction patterns (e.g., 'Often plays devil's advocate in tech debates')"),
  personalityHint: z.string().describe("A hint about their communication style and demeanor"),
  interestsHint: z.string().describe("A hint about their apparent interests, opinions, or expertise based on their content"),
  networkHint: z.string().describe("A hint about the types of people they interact with and their role in the community")
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

  async generateHints(casts, profile) {
    if (this.isDisabled) {
      return this.generateFallbackHints(profile);
    }

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

      const completion = await this.client.beta.chat.completions.parse({
        model: "gpt-4.5-preview",
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
export const openai = new OpenAIAnalyzer(); 