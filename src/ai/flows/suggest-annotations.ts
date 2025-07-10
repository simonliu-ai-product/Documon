'use server';

/**
 * @fileOverview Generates question-and-answer annotations from an entire document using a specified vLLM model.
 *
 * - generateAnnotations - A function that generates annotations for the entire document.
 * - GenerateAnnotationsInput - The input type for the generateAnnotations function.
 * - GenerateAnnotationsOutput - The return type for the generateAnnotations function.
 */

import { z } from 'genkit';
import OpenAI from 'openai';
import { arenaVLLMConfig } from '@/ai/genkit';

const GenerateAnnotationsInputSchema = z.object({
  documentContent: z.string().describe('The entire text content of the PDF document.'),
  numQuestions: z.number().describe('The number of questions to generate.'),
  questionType: z.enum(['open-ended', 'multiple-choice']).describe('The type of question to generate.'),
  questionDirection: z.string().optional().describe('Optional direction for question generation.'),
});
export type GenerateAnnotationsInput = z.infer<typeof GenerateAnnotationsInputSchema>;

const AnnotationPairSchema = z.object({
    question: z.string().describe("根據文件內容生成的問題。"),
    answer: z.string().describe("從文件中提取的、作為問題答案的關鍵文字片段。"),
    answerkeyword: z.string().describe("從答案中提取 1-3 個最重要的關鍵詞，並用逗號分隔。"),
    options: z.array(z.string()).optional().nullable().describe("若是單一選擇題，此處會包含所有選項，其中一項為正確答案。"),
});

const VLLMAnnotationOutputSchema = z.object({
  annotations: z.array(AnnotationPairSchema),
});

const GenerateAnnotationsOutputSchema = z.object({
  annotations: z.array(AnnotationPairSchema).describe('A list of generated question-and-answer pairs from the document.'),
  modelName: z.string().describe('The name of the model that generated the annotations.'),
});
export type GenerateAnnotationsOutput = z.infer<typeof GenerateAnnotationsOutputSchema>;

export async function generateAnnotations(input: GenerateAnnotationsInput): Promise<GenerateAnnotationsOutput> {
  const modelConfig = arenaVLLMConfig.modelA;
  const client = new OpenAI({ apiKey: modelConfig.apiKey, baseURL: modelConfig.baseURL });

  const directionPrompt = input.questionDirection
    ? `\n請特別注意，出題時請遵循以下方向： "${input.questionDirection}"`
    : '';

  const systemPrompt = `你是一位協助資料標注員的 AI 助理。
你的任務是仔細閱讀整份文件，然後根據指定的格式生成 ${input.numQuestions} 組問題與答案的配對。
你的輸出必須嚴格遵守 JSON 格式，特別是 \`options\` 欄位的有無，且整個回傳結果必須是一個 JSON 物件，其中只包含一個 'annotations' 鍵，其值為一個問答物件的陣列。

對於每一組問答，你都必須生成 "answerkeyword" 欄位。這個欄位應包含從「答案」中提取的 1 到 3 個最核心的關鍵詞，並用逗號分隔。

問題類型為：${input.questionType}${directionPrompt}

- 如果問題類型是 "open-ended" (問答題):
  每一組配對中，「答案」必須是從文件中直接提取的文字片段，「問題」則是對應這個答案所提出的疑問。
  每一組問答配對的 JSON 物件，都絕對不能包含 'options' 欄位。

- 如果問題類型是 "multiple-choice" (單一選擇題):
  每一組配對中，「答案」必須是從文件中直接提取的文字片段。針對這個答案，生成一個相關的問題，以及剛好四個選項。
  這四個選項中，必須包含一個正確答案（也就是你提取的「答案」），以及三個語意相關但錯誤的干擾選項。
  請將四個選項（包含正確答案）隨機排序後，填入 'options' 欄位。
  每一組問答配對的 JSON 物件，都必須包含 'options' 欄位，且該欄位必須是一個包含四個字串的陣列。

請確保生成的問題與答案緊密相關，並且能涵蓋文件的核心資訊。`;

  const userMessage = `文件內容:\n${input.documentContent}`;
  
  try {
    const response = await client.chat.completions.create({
      model: modelConfig.modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('vLLM model for annotation generation returned no content.');
    }
    const parsedJson = JSON.parse(content);
    const validationResult = VLLMAnnotationOutputSchema.safeParse(parsedJson);

    if (!validationResult.success) {
      console.error("vLLM annotation response validation failed:", validationResult.error);
      throw new Error(`vLLM annotation response did not match expected schema. Details: ${validationResult.error.toString()}`);
    }
    
    // Filter results to match the requested question type for consistency
    const filteredAnnotations = validationResult.data.annotations.filter(ann => {
      const hasOptions = Array.isArray(ann.options) && ann.options.length > 0;
      if (input.questionType === 'multiple-choice') {
        return hasOptions;
      }
      if (input.questionType === 'open-ended') {
        return !hasOptions;
      }
      return true;
    });

    return { 
      annotations: filteredAnnotations,
      modelName: modelConfig.name,
    };

  } catch (error) {
    console.error(`Error generating annotations from vLLM model ${modelConfig.modelId}:`, error);
    // Rethrow to be caught by the action
    throw new Error(`Annotation generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
