import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Configuration for custom vLLM models used in the Arena.
// These are accessed directly in the arena flow.
// Values are loaded from environment variables.
export const arenaVLLMConfig = {
  modelA: {
    name: process.env.VLLM_A_NAME,
    modelId: process.env.VLLM_A_MODEL_ID,
    baseURL: process.env.VLLM_A_BASE_URL,
    apiKey: process.env.VLLM_A_API_KEY,
  },
  modelB: {
    name: process.env.VLLM_B_NAME,
    modelId: process.env.VLLM_B_MODEL_ID,
    baseURL: process.env.VLLM_B_BASE_URL,
    apiKey: process.env.VLLM_B_API_KEY,
  }
};


// The core genkit instance
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash', // A default model for non-arena flows
});
