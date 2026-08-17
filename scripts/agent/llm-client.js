const dotenv = require('dotenv');
dotenv.config();

/**
 * Universal LLM client supporting tool-calling and fallback offline mock.
 */
class LlmClient {
  constructor(config = {}) {
    this.apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    this.endpoint = process.env.LLM_ENDPOINT || (process.env.GEMINI_API_KEY ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions' : 'https://api.openai.com/v1/chat/completions');
    this.model = process.env.LLM_MODEL || config.model || 'gemini-2.5-flash';
    this.maxTokens = config.maxTokens || 1500;
  }

  isMockMode() {
    return !this.apiKey || process.argv.includes('--mock');
  }

  async runAgentStep(messages, availableTools = []) {
    if (this.isMockMode()) {
      return {
        role: 'assistant',
        content: null,
        mockBriefing: true
      };
    }

    const payload = {
      model: this.model,
      messages,
      max_tokens: this.maxTokens,
      temperature: 0.2
    };

    if (availableTools.length > 0) {
      payload.tools = availableTools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }
      }));
    }

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`[LlmClient] API call failed (${res.status}): ${errorText}. Falling back to deterministic summary.`);
        return { role: 'assistant', content: null, mockBriefing: true };
      }

      const data = await res.json();
      const choice = data.choices && data.choices[0];
      return choice ? choice.message : { role: 'assistant', content: null, mockBriefing: true };
    } catch (err) {
      console.warn(`[LlmClient] Request error: ${err.message}. Falling back to offline generation.`);
      return { role: 'assistant', content: null, mockBriefing: true };
    }
  }
}

module.exports = LlmClient;
