/**
 * Claude Haiku integration service for automatic interview question detection
 */

import Anthropic from "@anthropic-ai/sdk";

// Complete list of question IDs with their text for analysis
const QUESTION_MAPPINGS = {
  // Fit & Motivation
  "fit-why-consulting": "Why consulting?",
  "fit-why-firm": "Why our firm specifically?",
  
  // Behavioral Questions
  "behav-challenging-project": "Tell me about a challenging project",
  "behav-led-team": "Describe a time you led a team",
  
  // Analytical & Technical Skills
  "analytical-analyze-data": "How would you analyze this data?",
  "analytical-metrics": "What metrics would you use?",
  
  // Questions worth asking
  "worth-counterintuitive-insight": "What's the most counterintuitive insight you've learned in consulting?",
  "worth-redesign-process": "If you could redesign our client engagement process from scratch, what would you change?",
};

/**
 * Initialize Anthropic client
 */
function getAnthropicClient(): Anthropic | null {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  
  if (!apiKey || apiKey === "your-anthropic-api-key-here") {
    console.warn("⚠️ VITE_ANTHROPIC_API_KEY not configured. Using fallback keyword detection.");
    return null;
  }
  
  return new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true, // Required for Vite (client-side)
  });
}

/**
 * Send transcript to Claude Haiku to detect asked questions
 * 
 * @param transcript - Complete recruiter transcript text
 * @returns Array of detected question IDs
 */
export async function sendToClaude(transcript: string): Promise<string[]> {
  console.log("📤 Sending to Claude Haiku:", transcript.substring(0, 100) + "...");
  
  // Check if transcript is empty
  if (!transcript || transcript.trim().length === 0) {
    console.log("📭 Empty transcript, skipping analysis");
    return [];
  }
  
  const client = getAnthropicClient();
  
  // Fallback: keyword detection if no API key
  if (!client) {
    return detectByKeywords(transcript);
  }
  
  try {
    // Build the list of questions for Claude
    const questionsList = Object.entries(QUESTION_MAPPINGS)
      .map(([id, question]) => `- ${id}: ${question}`)
      .join('\n');
    
    const message = await client.messages.create({
      model: "claude-haiku-4-5", // Claude 3.5 Haiku (latest)
      max_tokens: 512,
      temperature: 0, // Deterministic for detection
      messages: [{
        role: "user",
        content: `You are a JSON API service. You respond STRICTLY with valid JSON, no text around it.

Your task: analyze an interview transcript and identify which questions from a predefined list were asked.

Available questions:
${questionsList}

Interview transcript:
"${transcript}"

Analyze the transcript and identify which questions were asked. Consider:
- Direct questions matching the text
- Paraphrased versions of these questions
- Questions in French or English
- Similar intent even if worded differently

Expected JSON format:
{
  "detected_questions": ["question-id-1", "question-id-2"]
}

If no questions were detected, return:
{
  "detected_questions": []
}

IMPORTANT: 
- Return ONLY valid JSON
- No markdown, no code blocks
- No text before or after the JSON
- Just pure JSON`
      }]
    });
    
    // Parse Claude's response
    const content = message.content[0];
    if (content.type === 'text') {
      const text = content.text.trim();
      console.log("📄 Raw Claude response:", text);
      
      try {
        // Try to parse as JSON
        const jsonData = JSON.parse(text);
        const detectedIds = jsonData.detected_questions || [];
        console.log("✅ Claude detected questions:", detectedIds);
        return detectedIds;
      } catch (parseError) {
        console.log("⚠️ JSON parse error, trying to extract array...");
        
        // Fallback: try to extract JSON array from text
        const jsonMatch = text.match(/\[.*\]/s);
        if (jsonMatch) {
          const detectedIds = JSON.parse(jsonMatch[0]);
          console.log("✅ Claude detected questions (fallback):", detectedIds);
          return detectedIds;
        }
      }
    }
    
    console.log("⚠️ Could not parse Claude response, using fallback");
    return detectByKeywords(transcript);
    
  } catch (error) {
    console.error("❌ Error calling Claude API:", error);
    console.log("⚠️ Falling back to keyword detection");
    return detectByKeywords(transcript);
  }
}

/**
 * Détection par mots-clés (fallback si API Claude non disponible)
 */
function detectByKeywords(transcript: string): string[] {
  console.log("🔍 Using keyword-based detection (fallback)");
  
  const detectedIds: string[] = [];
  const lowerTranscript = transcript.toLowerCase();
  
  // Fit & Motivation
  if ((lowerTranscript.includes("pourquoi") || lowerTranscript.includes("why")) && 
      lowerTranscript.includes("consulting")) {
    detectedIds.push("fit-why-consulting");
  }
  
  if ((lowerTranscript.includes("pourquoi") || lowerTranscript.includes("why")) && 
      (lowerTranscript.includes("notre") || lowerTranscript.includes("cabinet") || 
       lowerTranscript.includes("entreprise") || lowerTranscript.includes("firm") || 
       lowerTranscript.includes("our company"))) {
    detectedIds.push("fit-why-firm");
  }
  
  // Behavioral
  if ((lowerTranscript.includes("projet") || lowerTranscript.includes("project")) && 
      (lowerTranscript.includes("difficile") || lowerTranscript.includes("complexe") || 
       lowerTranscript.includes("challenge") || lowerTranscript.includes("challenging"))) {
    detectedIds.push("behav-challenging-project");
  }
  
  if (lowerTranscript.includes("équipe") || lowerTranscript.includes("team") || 
      lowerTranscript.includes("leadership") || lowerTranscript.includes("dirigé") || 
      lowerTranscript.includes("led")) {
    detectedIds.push("behav-led-team");
  }
  
  // Analytical
  if ((lowerTranscript.includes("analyser") || lowerTranscript.includes("analyze")) && 
      (lowerTranscript.includes("données") || lowerTranscript.includes("data"))) {
    detectedIds.push("analytical-analyze-data");
  }
  
  if (lowerTranscript.includes("métriques") || lowerTranscript.includes("metrics") || 
      lowerTranscript.includes("kpi") || lowerTranscript.includes("indicateurs")) {
    detectedIds.push("analytical-metrics");
  }
  
  // Questions worth asking
  if (lowerTranscript.includes("insight") || lowerTranscript.includes("contre-intuitif") || 
      lowerTranscript.includes("counterintuitive") || lowerTranscript.includes("appris") || 
      lowerTranscript.includes("learned")) {
    detectedIds.push("worth-counterintuitive-insight");
  }
  
  if (lowerTranscript.includes("redesign") || lowerTranscript.includes("repenser") || 
      lowerTranscript.includes("processus") || lowerTranscript.includes("process") || 
      lowerTranscript.includes("scratch")) {
    detectedIds.push("worth-redesign-process");
  }
  
  console.log("✅ Keyword detection found:", detectedIds);
  return detectedIds;
}
