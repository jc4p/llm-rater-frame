import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are an AI assistant tasked with creating engaging hints about a Farcaster user for a guessing game. Your hints should be fun and specific but not too obvious. Focus on unique characteristics and patterns in their content without revealing the user's name or exact handle. Always use "onchain" (no hyphen) when referring to blockchain activities.

Important: Always write hints in third person (e.g., "This user...", "They...", "Their..."). Never use first person ("I", "my", "we") or second person ("you", "your").

Analyze the following information about the Farcaster user:

<profile_info>
{PROFILE_INFO}
</profile_info>

<recent_casts>
{RECENT_CASTS}
</recent_casts>

Top mentions:
<top_mentions>
{TOP_MENTIONS}
</top_mentions>

Analyze the user's content to identify:
1. Main topics they discuss
2. Their writing style and tone
3. Common themes in their conversations
4. Types of content they engage with
5. Their role in the community

Based on your analysis, generate hints in the following categories:

1. Content: What they typically post about and their posting style
2. Behavior: Their unique interaction patterns
3. Personality: Their communication style and demeanor
4. Interests: Their apparent interests, opinions, or expertise
5. Network: The types of people they interact with and their role in the community

Provide your analysis and hints within <analysis> tags, structured as follows:

<analysis>
<content_hint>A hint about what they typically post about and their posting style</content_hint>
<behavior_hint>A hint about their unique interaction patterns</behavior_hint>
<personality_hint>A hint about their communication style and demeanor</personality_hint>
<interests_hint>A hint about their apparent interests, opinions, or expertise based on their content</interests_hint>
<network_hint>A hint about the types of people they interact with and their role in the community</network_hint>
</analysis>

Important guidelines:
1. Do not reveal the user's name, handle, or any unique identifiers
2. Make hints specific but not immediately obvious
3. Focus on patterns and themes rather than specific posts
4. Be engaging and fun while maintaining accuracy
5. Ensure each hint is distinct and provides unique information
6. Always write in third person - never use "I", "my", "we", "you", or "your"`;

export class AnthropicAnalyzer {
  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('Missing ANTHROPIC_API_KEY. AI analysis will be disabled.');
      this.isDisabled = true;
      return;
    }

    this.isDisabled = false;
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
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

      // Format the prompt with actual data
      const formattedPrompt = SYSTEM_PROMPT
        .replace('{PROFILE_INFO}', JSON.stringify(profile, null, 2))
        .replace('{RECENT_CASTS}', casts.map(cast => cast.text).join('\n'))
        .replace('{TOP_MENTIONS}', topMentions.join(', '));

      const response = await this.client.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 8192,
        temperature: 1,
        messages: [
          {
            role: "user",
            content: formattedPrompt
          }
        ]
      });

      // Parse XML response
      const xmlContent = response.content[0].text;
      const analysisMatch = xmlContent.match(/<analysis>(.*?)<\/analysis>/s);
      
      if (!analysisMatch) {
        throw new Error('Failed to parse Anthropic response');
      }

      const analysis = analysisMatch[1];
      const hints = {
        contentHint: this.extractTag(analysis, 'content_hint'),
        behaviorHint: this.extractTag(analysis, 'behavior_hint'),
        personalityHint: this.extractTag(analysis, 'personality_hint'),
        interestsHint: this.extractTag(analysis, 'interests_hint'),
        networkHint: this.extractTag(analysis, 'network_hint')
      };

      // Validate that all hints are present
      if (Object.values(hints).some(hint => !hint)) {
        throw new Error('Missing hints in Anthropic response');
      }

      return hints;
    } catch (error) {
      console.error('Error generating hints:', error);
      return this.generateFallbackHints(profile);
    }
  }

  extractTag(content, tagName) {
    const match = content.match(new RegExp(`<${tagName}>(.*?)<\/${tagName}>`, 's'));
    return match ? match[1].trim() : null;
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
export const anthropic = new AnthropicAnalyzer(); 