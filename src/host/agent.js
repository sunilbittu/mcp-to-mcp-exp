/**
 * Claude agent that orchestrates MCP tool calls.
 *
 * The agent receives a natural-language query, sees the MCP server's tools as
 * native Claude tools, and runs an agentic loop until it produces a final
 * answer. Each iteration of the loop is wrapped in a New Relic segment.
 */

import Anthropic from '@anthropic-ai/sdk';

import { callMcpTool, listMcpTools } from './mcp-client.js';
import { instrument, noticeError, recordCustomEvent } from './telemetry.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7';
const MAX_TOKENS = 1024;
const MAX_ITERATIONS = 6;

const SYSTEM_PROMPT = `You are a weather assistant. The user will ask about weather in a city.
Use the available tools to:
1. Resolve the city to coordinates with get_city_info.
2. Fetch current weather with get_weather using those coordinates.
3. Reply with a single concise sentence summarizing the conditions.

Always call get_city_info before get_weather. Never invent coordinates or weather values.`;

let anthropic = null;
function getClient() {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

function toAnthropicTools(mcpTools) {
  return mcpTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}

export async function runAgent(query) {
  return instrument('agent.run', async (recorder) => {
    const client = getClient();
    const mcpTools = await listMcpTools();
    const tools = toAnthropicTools(mcpTools);

    recorder.addAttributes({
      'agent.model': MODEL,
      'agent.query': query,
      'agent.tool_count': tools.length,
    });

    const messages = [{ role: 'user', content: query }];
    const trace = [];
    const collectedToolResults = {};

    for (let i = 0; i < MAX_ITERATIONS; i += 1) {
      const response = await instrument(`agent.llm.iteration_${i + 1}`, async (rec) => {
        rec.addAttributes({ 'agent.iteration': i + 1 });
        const r = await client.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
          tools,
          messages,
        });
        rec.addAttributes({
          'agent.stop_reason': r.stop_reason,
          'agent.input_tokens': r.usage?.input_tokens ?? 0,
          'agent.output_tokens': r.usage?.output_tokens ?? 0,
        });
        recordCustomEvent('AgentLLMCall', {
          model: MODEL,
          iteration: i + 1,
          stop_reason: r.stop_reason,
          input_tokens: r.usage?.input_tokens ?? 0,
          output_tokens: r.usage?.output_tokens ?? 0,
        });
        return r;
      });

      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason !== 'tool_use') {
        const finalText = response.content
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
        trace.push({ type: 'final', text: finalText });
        return {
          summary: finalText,
          city: collectedToolResults.get_city_info ?? null,
          weather: collectedToolResults.get_weather ?? null,
          trace,
          iterations: i + 1,
        };
      }

      const toolUses = response.content.filter((b) => b.type === 'tool_use');
      const toolResults = [];
      for (const use of toolUses) {
        trace.push({
          type: 'tool_use',
          name: use.name,
          input: use.input,
        });
        try {
          const { text, parsed } = await callMcpTool(use.name, use.input);
          collectedToolResults[use.name] = parsed ?? text;
          trace.push({ type: 'tool_result', name: use.name, output: parsed ?? text });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: use.id,
            content: text ?? JSON.stringify(parsed ?? null),
          });
        } catch (err) {
          noticeError(err, { tool: use.name });
          trace.push({ type: 'tool_error', name: use.name, error: err.message });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: use.id,
            is_error: true,
            content: `Error: ${err.message}`,
          });
        }
      }
      messages.push({ role: 'user', content: toolResults });
    }

    throw new Error(`Agent exceeded ${MAX_ITERATIONS} iterations without finishing`);
  });
}
