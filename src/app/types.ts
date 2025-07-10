import type { QAPair } from '@/ai/flows/arena-flow';

export type ConfirmedAnnotation = {
  id: number;
  text: string;
  annotation: string;
  answerkeyword: string;
  options?: string[];
  modelName: string;
};

export type GeneratedAnnotation = {
  question: string;
  answer: string;
  answerkeyword: string;
  options?: string[];
  modelName: string;
};

export type ArenaResult = {
  userPrompt: string;
  responseA: QAPair[];
  responseB: QAPair[];
  modelAName: string;
  modelBName: string;
};

export type OperationType = 
  | 'arena'
  | 'open-ended'
  | 'multiple-choice'
  | 'manual-open-ended'
  | 'manual-multiple-choice'
  | 'csv-open-ended'
  | 'csv-multiple-choice';

export type ArenaJudgment = {
  id: string;
  question: string;
  answer_model_a: string;
  answer_model_b: string;
  model_a_name: string;
  model_b_name: string;
  judgment: string;
};
