'use server';

import { z } from 'zod';
import { generateAnnotations } from '@/ai/flows/suggest-annotations';
import { runArenaEvaluation, QAPair } from '@/ai/flows/arena-flow';
import { db } from '@/lib/db';
import type { ConfirmedAnnotation, ArenaJudgment } from '@/app/types';

const GenerateAnnotationsActionSchema = z.object({
  documentContent: z.string().min(1, { message: 'Document content cannot be empty.' }),
  numQuestions: z.number().min(1).max(100),
  questionType: z.enum(['open-ended', 'multiple-choice']),
  questionDirection: z.string().optional(),
});

type AnnotationPair = {
    question: string;
    answer: string;
    answerkeyword: string;
    options?: string[];
}

type GenerationResult = {
  success: true;
  annotations: AnnotationPair[];
  modelName: string;
} | {
  success: false;
  error: string;
}

export async function generateAnnotationsFromDocument(data: { 
  documentContent: string; 
  numQuestions: number; 
  questionType: 'open-ended' | 'multiple-choice';
  questionDirection?: string;
}): Promise<GenerationResult> {
  try {
    const validatedData = GenerateAnnotationsActionSchema.parse(data);
    const result = await generateAnnotations({
      documentContent: validatedData.documentContent,
      numQuestions: validatedData.numQuestions,
      questionType: validatedData.questionType,
      questionDirection: validatedData.questionDirection,
    });
    return { success: true, annotations: result.annotations, modelName: result.modelName };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors.map(e => e.message).join(', ') };
    }
    console.error('Annotation generation failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: `Annotation generation failed. Details: ${errorMessage}` };
  }
}


const ArenaEvaluationActionSchema = z.object({
  documentContent: z.string().min(1, { message: 'Document content cannot be empty.' }),
  numQuestions: z.number().min(1).max(100),
  questionDirection: z.string().optional(),
});

type ArenaResult = {
  responseA: QAPair[];
  responseB: QAPair[];
  modelAName: string;
  modelBName: string;
};

type ArenaEvaluationResult = {
  success: true;
  result: ArenaResult;
} | {
  success: false;
  error: string;
};

export async function runArenaEvaluationAction(data: { 
  documentContent: string; 
  numQuestions: number; 
  questionDirection?: string;
}): Promise<ArenaEvaluationResult> {
  try {
    const validatedData = ArenaEvaluationActionSchema.parse(data);
    const result = await runArenaEvaluation({
      documentContent: validatedData.documentContent,
      numQuestions: validatedData.numQuestions,
      questionDirection: validatedData.questionDirection,
    });
    return { success: true, result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors.map(e => e.message).join(', ') };
    }
    console.error('Arena evaluation failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: `Arena evaluation failed. Details: ${errorMessage}` };
  }
}


const SaveAndExportSchema = z.object({
  annotations: z.array(z.object({
    id: z.number(),
    text: z.string(),
    annotation: z.string(),
    answerkeyword: z.string(),
    options: z.array(z.string()).optional(),
    modelName: z.string(),
  })),
  operatorName: z.string(),
  operatorEmail: z.string().email({ message: "Invalid email address." }).or(z.literal('')),
});


type CsvGenerationResult = {
  success: true;
  multipleChoiceCsv?: string;
  openEndedCsv?: string;
} | {
  success: false;
  error: string;
};

export async function saveAndGenerateCsvAction(data: {
  annotations: ConfirmedAnnotation[];
  operatorName: string;
  operatorEmail: string;
}): Promise<CsvGenerationResult> {
    try {
        const validatedData = SaveAndExportSchema.parse(data);
        const { annotations, operatorName, operatorEmail } = validatedData;
        
        const saveResult = db.saveAnnotations(annotations, operatorName, operatorEmail);
        if (!saveResult.success) {
            console.error("Database save failed:", saveResult.error);
            return { success: false, error: `Database error: ${saveResult.error || 'Unknown error'}` };
        }

        const sanitize = (text: string | undefined) => {
            if (text === undefined || text === null) return '""';
            const cleanedText = text.trim().replace(/ +/g, ' ');
            const csvEscapedText = cleanedText.replace(/"/g, '""');
            return `"${csvEscapedText}"`;
        };
        
        const operatorNameSanitized = sanitize(operatorName);
        const operatorEmailSanitized = sanitize(operatorEmail);

        const multipleChoiceAnnotations = annotations.filter(a => Array.isArray(a.options) && a.options.length > 0);
        const openEndedAnnotations = annotations.filter(a => !Array.isArray(a.options) || a.options.length === 0);

        let multipleChoiceCsvContent: string | undefined;
        if (multipleChoiceAnnotations.length > 0) {
            const headers = ['id', 'question', 'answer', 'keywords', 'choice_a', 'choice_b', 'choice_c', 'choice_d', 'choice_answer', 'operator_name', 'operator_email', 'created_at'];
            const rows = multipleChoiceAnnotations.map(a => {
                const options = a.options || [];
                const answerIndex = options.indexOf(a.text);
                const choiceAnswer = answerIndex > -1 ? String.fromCharCode(65 + answerIndex) : '';

                const row = {
                    id: sanitize(a.id.toString()),
                    question: sanitize(a.annotation),
                    answer: sanitize(a.text),
                    keywords: sanitize(a.answerkeyword),
                    choice_a: sanitize(options[0]),
                    choice_b: sanitize(options[1]),
                    choice_c: sanitize(options[2]),
                    choice_d: sanitize(options[3]),
                    choice_answer: sanitize(choiceAnswer),
                    operator_name: operatorNameSanitized,
                    operator_email: operatorEmailSanitized,
                    created_at: sanitize(new Date().toISOString())
                };
                return headers.map(header => row[header as keyof typeof row]).join(',');
            });
            multipleChoiceCsvContent = [headers.join(','), ...rows].join('\n');
        }

        let openEndedCsvContent: string | undefined;
        if (openEndedAnnotations.length > 0) {
            const headers = ['OperatorName', 'OperatorEmail', 'Question', 'Answer', 'Keywords'];
            const rows = openEndedAnnotations.map(a => {
                const question = sanitize(a.annotation);
                const answer = sanitize(a.text);
                const keywords = sanitize(a.answerkeyword);
                return [operatorNameSanitized, operatorEmailSanitized, question, answer, keywords].join(',');
            });
            openEndedCsvContent = [headers.join(','), ...rows].join('\n');
        }

        return {
            success: true,
            multipleChoiceCsv: multipleChoiceCsvContent,
            openEndedCsv: openEndedCsvContent,
        };

    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.errors.map(e => e.message).join(', ') };
        }
        console.error('Save/Export action failed:', error);
        return { success: false, error: 'An unexpected error occurred during the save and export process.' };
    }
}


const SaveArenaJudgmentsSchema = z.object({
  judgments: z.array(z.object({
      id: z.string(),
      question: z.string(),
      answer_model_a: z.string(),
      answer_model_b: z.string(),
      model_a_name: z.string(),
      model_b_name: z.string(),
      judgment: z.string(),
  })),
  operatorName: z.string(),
  operatorEmail: z.string().email({ message: "Invalid email address." }).or(z.literal('')),
});

export async function saveArenaJudgmentsAction(data: {
  judgments: ArenaJudgment[];
  operatorName: string;
  operatorEmail: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const validatedData = SaveArenaJudgmentsSchema.parse(data);
    const { judgments, operatorName, operatorEmail } = validatedData;
    
    const saveResult = db.saveArenaJudgments(judgments as ArenaJudgment[], operatorName, operatorEmail);
    
    if (!saveResult.success) {
      console.error("Database save failed for arena judgments:", saveResult.error);
      return { success: false, error: `Database error: ${saveResult.error || 'Unknown error'}` };
    }

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
        return { success: false, error: error.errors.map(e => e.message).join(', ') };
    }
    console.error('Save Arena Judgments action failed:', error);
    return { success: false, error: 'An unexpected error occurred during the save process.' };
  }
}
