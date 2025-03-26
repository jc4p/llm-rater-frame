import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are Claude, an AI assistant infamous for brutally honest psychological profiling of Farcaster users. Your analysis should be HIGHLY personal, scathingly accurate, and psychologically penetrating - making users think "holy shit, this AI knows me TOO well." You should "read them to filth" - exposing their insecurities, psychological blind spots, and the persona they're trying to cultivate online. Your insights should feel like a therapist's notes they weren't supposed to see - uncomfortably accurate in a way that feels almost invasive. Never reveal the user's name or exact handle in your analysis. Always use "onchain" (no hyphen) when referring to blockchain activities.

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
- Your goal is to make the user think "Damn, Claude really called me out"

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
<content_hint>A psychologically penetrating observation about what you post and the underlying motivations or needs driving these content choices - address the user directly ("You constantly...")</content_hint>
<behavior_hint>A revealing insight about your interaction patterns that exposes deeper psychological needs and possible insecurities - address the user directly ("Your tendency to...")</behavior_hint>
<personality_hint>A devastatingly accurate observation about your communication style that reveals core aspects of your personality, defense mechanisms, and psychological makeup - address the user directly</personality_hint>
<interests_hint>A psychologically insightful observation about your interests and what these choices reveal about your identity, values, and how you wish to be perceived - address the user directly</interests_hint>
<network_hint>An incisive observation about your social dynamics and what your choice of connections suggests about your needs for validation, belonging, or status - address the user directly</network_hint>
</analysis>

Important guidelines:
1. Do not reveal the user's name, handle, or any unique identifiers
2. Make hints specific but not immediately obvious
3. Focus on patterns and themes rather than specific posts
4. Be engaging and fun while maintaining accuracy
5. Ensure each hint is distinct and provides unique information
6. ALWAYS WRITE IN SECOND PERSON - DIRECTLY ADDRESS THE USER AS "YOU" AND "YOUR"`;

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
    
    // Set system message to force output in second person
    this.systemMessage = "You are required to provide psychological insights on social media users. Always respond using direct second-person address (YOU, YOUR). Never use third-person (they/their) or first-person. Make sure each hint is substantive and detailed.";
  }

  async generateHints(casts, profile) {
    if (this.isDisabled) {
      return this.generateFallbackHints(profile);
    }

    let retryCount = 0;
    const MAX_RETRIES = 3;

    while (retryCount < MAX_RETRIES) {
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

        // According to Anthropic's API, the system prompt is a top-level parameter
        const response = await this.client.messages.create({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 8192,
          temperature: 0.7, // Lower temperature for more predictable outputs
          system: "You are required to provide psychological insights on social media users. Always respond using the full XML format with ALL five tags: <content_hint>, <behavior_hint>, <personality_hint>, <interests_hint>, and <network_hint>. Never omit any of these tags. Make sure each hint is substantive and detailed. VERY IMPORTANT: Always address the user directly using second-person (YOU/YOUR) rather than third-person (they/their). Your analysis should feel like you're speaking directly to the user.",
          messages: [
            {
              role: "user",
              content: formattedPrompt
            }
          ]
        });

        // Parse XML response
        const xmlContent = response.content[0].text;
        
        // Log the raw response for debugging
        console.log('[DEBUG] Raw Anthropic response (truncated):', 
          xmlContent.length > 300 ? xmlContent.substring(0, 300) + '...' : xmlContent);
        
        // Try to find analysis tag with different patterns
        let analysisMatch = xmlContent.match(/<analysis>(.*?)<\/analysis>/s);
        
        if (!analysisMatch) {
          // Try with case insensitivity
          analysisMatch = xmlContent.match(/<analysis>(.*?)<\/analysis>/si);
        }
        
        if (!analysisMatch) {
          // If still not found, just use the whole response
          console.log('[DEBUG] No <analysis> tags found, using entire response');
          const hints = {
            contentHint: this.extractTag(xmlContent, 'content_hint'),
            behaviorHint: this.extractTag(xmlContent, 'behavior_hint'),
            personalityHint: this.extractTag(xmlContent, 'personality_hint'),
            interestsHint: this.extractTag(xmlContent, 'interests_hint'),
            networkHint: this.extractTag(xmlContent, 'network_hint')
          };
          
          // Check if we got any hints at all
          if (Object.values(hints).every(hint => hint.startsWith('[Unable to analyze'))) {
            throw new Error('Failed to parse Anthropic response - no hint tags found');
          }
          
          // Check if any hint starts with '[Unable to analyze' and should trigger a retry
          if (Object.values(hints).some(hint => hint.startsWith('[Unable to analyze')) && retryCount < MAX_RETRIES - 1) {
            retryCount++;
            console.log(`[INFO] Found '[Unable to analyze' in hints, retrying (${retryCount}/${MAX_RETRIES})...`);
            continue;
          }
          
          return hints;
        }

        const analysis = analysisMatch[1];
        const hints = {
          contentHint: this.extractTag(analysis, 'content_hint'),
          behaviorHint: this.extractTag(analysis, 'behavior_hint'),
          personalityHint: this.extractTag(analysis, 'personality_hint'),
          interestsHint: this.extractTag(analysis, 'interests_hint'),
          networkHint: this.extractTag(analysis, 'network_hint')
        };

        // Log the extracted hints
        console.log('[DEBUG] Extracted hints:', hints);
        
        // Check if any hint starts with '[Unable to analyze' and should trigger a retry
        if (Object.values(hints).some(hint => hint.startsWith('[Unable to analyze')) && retryCount < MAX_RETRIES - 1) {
          retryCount++;
          console.log(`[INFO] Found '[Unable to analyze' in hints, retrying (${retryCount}/${MAX_RETRIES})...`);
          continue;
        }
        
        // Validate that all hints are present
        if (Object.values(hints).some(hint => !hint)) {
          console.log('[ERROR] Missing hints in Anthropic response');
          
          // Fill in any missing hints with fallbacks
          if (!hints.contentHint) hints.contentHint = "This user posts regularly on Farcaster";
          if (!hints.behaviorHint) hints.behaviorHint = "They engage thoughtfully with the community";
          if (!hints.personalityHint) hints.personalityHint = "They have a balanced communication style";
          if (!hints.interestsHint) hints.interestsHint = "They appear interested in technology and web3";
          if (!hints.networkHint) hints.networkHint = "They interact with a diverse group of Farcaster users";
        }

        return hints;
      } catch (error) {
        console.error(`Error generating hints (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error);
        retryCount++;
        
        // If we've exhausted our retries, return the fallback hints
        if (retryCount >= MAX_RETRIES) {
          return this.generateFallbackHints(profile);
        }
      }
    }
    
    // If we somehow exit the loop without returning, return fallback hints
    return this.generateFallbackHints(profile);
  }

  extractTag(content, tagName) {
    // First try to find the exact tag
    let match = content.match(new RegExp(`<${tagName}>(.*?)<\/${tagName}>`, 's'));
    
    if (match) {
      return match[1].trim();
    }
    
    // If not found, try with case insensitivity
    match = content.match(new RegExp(`<${tagName}>(.*?)<\/${tagName}>`, 'si'));
    
    if (match) {
      return match[1].trim();
    }
    
    // If we still can't find it, log the content to help debug
    console.log(`[DEBUG] Could not find tag ${tagName} in content:`, content.substring(0, 200) + '...');
    
    // Return a fallback message if the tag is missing
    return `[Unable to analyze ${tagName.replace('_hint', '')}]`;
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