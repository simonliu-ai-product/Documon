'use server';

/**
 * @fileOverview 執行兩個模型配置的並排比較。
 *
 * - runArenaEvaluation - 一個為相同輸入生成兩種不同回應的函式。
 * - ArenaInput - runArenaEvaluation 函式的輸入型別。
 * - ArenaOutput - runArenaEvaluation 函式的回傳型別。
 */

import { arenaVLLMConfig } from '@/ai/genkit';
import { z } from 'zod';
import OpenAI from 'openai';

const ArenaInputSchema = z.object({
  documentContent: z.string().describe('PDF 文件的完整文字內容。'),
  numQuestions: z.number().describe('要生成的問題數量。'),
  questionDirection: z.string().optional().describe('Optional direction for question generation.'),
});
export type ArenaInput = z.infer<typeof ArenaInputSchema>;

const QAPairSchema = z.object({
  question: z.string().describe('根據文件內容生成的問題。'),
  answer: z.string().describe('從文件中提取的、作為問題答案的關鍵文字片段。'),
});
export type QAPair = z.infer<typeof QAPairSchema>;

const ArenaOutputSchema = z.object({
  responseA: z.array(QAPairSchema).describe('模型 A 生成的問答對列表。'),
  responseB: z.array(QAPairSchema).describe('模型 B 生成的問答對列表。'),
  modelAName: z.string().describe('模型 A 的名稱。'),
  modelBName: z.string().describe('模型 B 的名稱。'),
});
export type ArenaOutput = z.infer<typeof ArenaOutputSchema>;

export async function runArenaEvaluation(input: ArenaInput): Promise<ArenaOutput> {
  try {
    // Step 1: Generate questions using Model A
    const clientA = new OpenAI({ apiKey: arenaVLLMConfig.modelA.apiKey, baseURL: arenaVLLMConfig.modelA.baseURL });
    const questions = await generateQuestionsFromVLLM(clientA, arenaVLLMConfig.modelA.modelId, input.documentContent, input.numQuestions, input.questionDirection);

    if (questions.length === 0) {
      return { responseA: [], responseB: [], modelAName: arenaVLLMConfig.modelA.name, modelBName: arenaVLLMConfig.modelB.name };
    }
    
    // Step 2: Set up OpenAI client for Model B. Client A is already set up.
    const clientB = new OpenAI({ apiKey: arenaVLLMConfig.modelB.apiKey, baseURL: arenaVLLMConfig.modelB.baseURL });
    
    // Step 3: Get answers from both vLLM models in parallel.
    const [qaPairsFromA, qaPairsFromB] = await Promise.all([
        getAnswersFromVLLM(clientA, arenaVLLMConfig.modelA.modelId, input.documentContent, questions),
        getAnswersFromVLLM(clientB, arenaVLLMConfig.modelB.modelId, input.documentContent, questions)
    ]);
    
    // Step 4: Reconstruct responses to ensure order and handle potential missing answers.
    const answerMapA = new Map(qaPairsFromA.map(p => [p.question, p.answer]));
    const answerMapB = new Map(qaPairsFromB.map(p => [p.question, p.answer]));
    
    const responseA = questions.map(q => ({
      question: q,
      answer: answerMapA.get(q) || "模型 A 未能回答此問題。"
    }));
    
    const responseB = questions.map(q => ({
      question: q,
      answer: answerMapB.get(q) || "模型 B 未能回答此問題。"
    }));
    
    return {
      responseA: responseA,
      responseB: responseB,
      modelAName: arenaVLLMConfig.modelA.name,
      modelBName: arenaVLLMConfig.modelB.name,
    };
  } catch (error) {
    console.error('An error occurred during the arena evaluation flow:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Return a structured error response that the action can handle
    // This is a bit of a workaround as the flow is expected to return ArenaOutput.
    // The action will need to check for this specific error format.
    // A better approach might be for the action to handle the try/catch.
    // For now, we send an empty response with model names to avoid breaking the frontend.
    return {
      responseA: [{ question: 'Flow Error', answer: errorMessage }],
      responseB: [{ question: 'Flow Error', answer: errorMessage }],
      modelAName: arenaVLLMConfig.modelA.name,
      modelBName: arenaVLLMConfig.modelB.name,
    };
  }
}


const VLLMAnswerOutputSchema = z.object({
  questions: z.array(QAPairSchema),
});

const VLLMQuestionOutputSchema = z.object({
  questions: z.array(z.string()),
});

// Helper function to generate questions from a vLLM endpoint
async function generateQuestionsFromVLLM(
    client: OpenAI,
    modelId: string,
    documentContent: string,
    numQuestions: number,
    questionDirection?: string
): Promise<string[]> {
    const directionPrompt = questionDirection
      ? `\n請特別注意，出題時請遵循以下方向： "${questionDirection}"`
      : '';

    const systemPrompt = `你是一位 AI 助理。你的任務是根據提供的文件內容，生成 ${numQuestions} 個問題。
你的回傳結果必須是一個符合規範的 JSON 物件，其中只包含一個 'questions' 鍵，其值為一個問題字串的陣列。${directionPrompt}
例如: { "questions": ["問題一?", "問題二?"] }`;
    const userMessage = `文件內容:\n${documentContent}`;
    
    try {
        const response = await client.chat.completions.create({
            model: modelId,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
            ],
            response_format: { type: 'json_object' },
        });
        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('vLLM model for question generation returned no content.');
        }
        const parsedJson = JSON.parse(content);
        const validationResult = VLLMQuestionOutputSchema.safeParse(parsedJson);

        if (!validationResult.success) {
            console.error("vLLM question generation response validation failed:", validationResult.error);
            throw new Error(`vLLM question generation response did not match expected schema. Details: ${validationResult.error.toString()}`);
        }

        return validationResult.data.questions;
    } catch (error) {
        console.error(`Error generating questions from vLLM model ${modelId}:`, error);
        throw error; // Rethrow to be caught by the main flow
    }
}

// Helper function to call a vLLM endpoint and parse the response
async function getAnswersFromVLLM(
    client: OpenAI,
    modelId: string,
    documentContent: string,
    questionsToAnswer: string[]
): Promise<QAPair[]> {
  const systemPrompt = `你是 AI 助理。
你的任務是根據提供的文件內容，為以下每一個問題，提供一個詳盡的答案。
請確保你的回覆是一個符合規範的 JSON 物件，其中 'questions' 欄位是一個陣列。
陣列中的每個物件都必須包含你所回答的 'question' (原文必須一字不改) 和你生成的 'answer'。
文件內容:
${documentContent}
`;

  const userMessage = `請回答以下問題：\n${questionsToAnswer.map(q => `- ${q}`).join('\n')}`;

  try {
    const response = await client.chat.completions.create({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('vLLM model returned no content.');
    }
    
    const parsedJson = JSON.parse(content);
    const validationResult = VLLMAnswerOutputSchema.safeParse(parsedJson);

    if (!validationResult.success) {
        console.error("vLLM response validation failed:", validationResult.error);
        throw new Error(`vLLM response did not match expected schema. Details: ${validationResult.error.toString()}`);
    }

    return validationResult.data.questions;
  } catch (error) {
    console.error(`Error calling vLLM model ${modelId}:`, error);
    return questionsToAnswer.map(q => ({
        question: q,
        answer: `模型 ${modelId} 呼叫失敗。錯誤: ${error instanceof Error ? error.message : String(error)}`
    }));
  }
}
