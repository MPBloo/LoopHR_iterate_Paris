/**
 * AI Agents service for real-time interview assistance
 * Uses Claude Haiku 4.5 to provide contextual suggestions to the interviewer
 */

import Anthropic from "@anthropic-ai/sdk";

export interface AgentMessage {
  agent: "Deeper" | "NextQuestion";
  text: string;
}

export interface AgentResponse {
  messages: AgentMessage[];
}

export interface AgentInput {
  session_id: string;
  speaker: "candidate";
  last_text: string;
  history: Array<{ speaker: string; text: string; timestamp: number }>;
  job_profile: string;
  questions_already_asked: string[];
}

/**
 * Initialize Anthropic client for agents
 */
function getAnthropicClient(): Anthropic | null {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  
  if (!apiKey || apiKey === "your-anthropic-api-key-here") {
    console.warn("⚠️ VITE_ANTHROPIC_API_KEY not configured. Agents disabled.");
    return null;
  }
  
  return new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true,
  });
}

/**
 * Call Claude Haiku 4.5 to get agent suggestions
 */
export async function getAgentSuggestions(input: AgentInput): Promise<AgentResponse> {
  console.log("🤖 Calling agents for suggestions...");
  
  const client = getAnthropicClient();
  
  if (!client) {
    return { messages: [] };
  }
  
  try {
    // Build history string
    const historyText = input.history
      .slice(-10) // Last 10 messages only
      .map(h => `[${h.speaker}]: ${h.text}`)
      .join('\n');
    
    const questionsAskedText = input.questions_already_asked.length > 0
      ? input.questions_already_asked.join(', ')
      : "None";
    
    const prompt = `You are an agent orchestrator assisting a recruiter during a live job interview.

There are 2 agents, with very specific roles:

1) Deeper
- Suggests follow-up questions to dig deeper into the candidate's LAST answer.
- Goal: obtain concrete examples, numbers, detailed context.
- Don't rephrase what has already been said, directly propose 1 or 2 short questions.

2) NextQuestion
- Suggests the NEXT logical question to ask now.
- Based on:
  - the conversation history ("history"),
  - the job position and key skills ("job_profile"),
  - what has NOT yet been sufficiently covered,
  - "questions_already_asked" to suggest a comparable question to those asked to other candidates if useful.

General rules:
- You speak ONLY to the recruiter, never to the candidate.
- Your messages must be in English, SHORT (< 200 characters) and actionable.
- You can have 0 or 1 agent speak per call, NEVER more than 1 message.
- Agent names must be EXACTLY: "Deeper" or "NextQuestion".
- If you have nothing truly useful to say, simply return no message.

MANDATORY output format (strict JSON):
{
  "messages": [
    { "agent": "Deeper", "text": "Ask for a specific example with numbers about this project." }
  ]
}

If no agent should speak, return exactly:
{
  "messages": []
}

INTERVIEW CONTEXT:

Session ID: ${input.session_id}
Last speaker: ${input.speaker}
Candidate's last answer: "${input.last_text}"

Recent history:
${historyText}

Job profile: ${input.job_profile}

Questions already asked to other candidates: ${questionsAskedText}

Analyze this context and generate the final JSON with AT MOST ONE agent (Deeper or NextQuestion) or none.`;

    console.log("🤖 Sending prompt to Claude (length:", prompt.length, "chars)");
    console.log("🤖 Prompt preview:", prompt.substring(0, 200) + "...");

    const message = await client.messages.create({
      model: "claude-haiku-4-5", // Claude 3.5 Haiku latest
      max_tokens: 256,
      temperature: 0.3, // Slightly creative but consistent
      messages: [{
        role: "user",
        content: prompt
      }]
    });
    
    console.log("🤖 Received response from Claude");
    
    // Parse response
    const content = message.content[0];
    if (content.type === 'text') {
      const text = content.text.trim();
      console.log("🤖 Raw agent response:", text);
      
      try {
        // Extract JSON from potential markdown code blocks or raw text
        let jsonText = text;
        
        // Try markdown code block first
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          console.log("🤖 Extracted JSON from markdown code block");
          jsonText = jsonMatch[1].trim();
        }
        
        // Try to extract just the JSON object (between first { and last })
        const jsonObjectMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          jsonText = jsonObjectMatch[0];
          console.log("🤖 Extracted JSON object from text");
        }
        
        console.log("🤖 Parsing JSON:", jsonText);
        const response = JSON.parse(jsonText) as AgentResponse;
        
        // Validate response structure
        if (!response.messages || !Array.isArray(response.messages)) {
          console.warn("⚠️ Invalid agent response structure");
          return { messages: [] };
        }
        
        console.log("🤖 Valid response structure, messages count:", response.messages.length);
        
        // Validate and filter messages
        const validMessages = response.messages.filter(msg => {
          if (!msg.agent || !msg.text) return false;
          if (msg.agent !== "Deeper" && msg.agent !== "NextQuestion") return false;
          if (msg.text.length > 200) {
            console.warn(`⚠️ Agent message too long (${msg.text.length} chars), truncating`);
            msg.text = msg.text.substring(0, 197) + "...";
          }
          return true;
        });
        
        // Ensure max 1 message
        const finalMessages = validMessages.slice(0, 1);
        
        console.log("✅ Agent suggestions:", finalMessages);
        return { messages: finalMessages };
        
      } catch (parseError) {
        console.error("❌ JSON parse error:", parseError);
        return { messages: [] };
      }
    }
    return { messages: [] };
    
  } catch (error) {
    console.error("❌ Error calling agents API:", error);
    return { messages: [] };
  }
}
