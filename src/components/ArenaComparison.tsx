
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, ArrowRight, Download, RotateCcw, Loader2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { useToast } from "@/hooks/use-toast";
import { saveArenaJudgmentsAction } from '@/app/actions';
import type { QAPair } from '@/ai/flows/arena-flow';
import type { ArenaJudgment } from '@/app/types';

type ArenaResult = {
  userPrompt: string;
  responseA: QAPair[];
  responseB: QAPair[];
  modelAName: string;
  modelBName: string;
};

type ArenaComparisonProps = {
  result: ArenaResult;
  onRestart: () => void;
  operatorName: string;
  operatorEmail: string;
};

type Comparison = {
  question: string;
  answerA: string;
  answerB: string;
  answerA_is_modelA: boolean;
  judgment: 'A' | 'B' | 'Both' | 'Neither' | null;
};

export function ArenaComparison({ result, onRestart, operatorName, operatorEmail }: ArenaComparisonProps) {
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const qaA = result.responseA || [];
    const qaB = result.responseB || [];
    const numComparisons = Math.min(qaA.length, qaB.length);
    
    const initialComparisons: Comparison[] = [];
    for (let i = 0; i < numComparisons; i++) {
      const isSwapped = Math.random() > 0.5;
      initialComparisons.push({
        question: qaA[i].question, 
        answerA: isSwapped ? qaB[i].answer : qaA[i].answer,
        answerB: isSwapped ? qaA[i].answer : qaB[i].answer,
        answerA_is_modelA: !isSwapped,
        judgment: null,
      });
    }
    setComparisons(initialComparisons);
    setCurrentPage(0);
  }, [result]);

  const handleJudgment = (judgment: 'A' | 'B' | 'Both' | 'Neither') => {
    const newComparisons = [...comparisons];
    newComparisons[currentPage].judgment = judgment;
    setComparisons(newComparisons);
    if (currentPage < comparisons.length - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleExportAndSave = async () => {
    const allJudged = comparisons.every(c => c.judgment !== null);
    if (!allJudged) {
      toast({
          variant: 'destructive',
          title: '評分未完成',
          description: '請在匯出前完成所有評分。',
      });
      return;
    }

    setIsSaving(true);

    const judgmentsToSave: ArenaJudgment[] = comparisons.map((c, index) => {
        const originalAnswerFromModelA = c.answerA_is_modelA ? c.answerA : c.answerB;
        const originalAnswerFromModelB = c.answerA_is_modelA ? c.answerB : c.answerA;
        
        let finalJudgment = '';
        switch (c.judgment) {
            case 'A':
            finalJudgment = c.answerA_is_modelA ? result.modelAName : result.modelBName;
            break;
            case 'B':
            finalJudgment = c.answerA_is_modelA ? result.modelBName : result.modelAName;
            break;
            case 'Both':
            finalJudgment = 'Both are good';
            break;
            case 'Neither':
            finalJudgment = 'Neither is good';
            break;
            default:
            finalJudgment = 'No judgment';
        }

        return {
            id: `${Date.now()}-${index}`,
            question: c.question,
            answer_model_a: originalAnswerFromModelA,
            answer_model_b: originalAnswerFromModelB,
            model_a_name: result.modelAName,
            model_b_name: result.modelBName,
            judgment: finalJudgment,
        };
    });

    try {
        const saveResult = await saveArenaJudgmentsAction({
            judgments: judgmentsToSave,
            operatorName,
            operatorEmail,
        });

        if (!saveResult.success) {
            toast({
                variant: 'destructive',
                title: '儲存失敗',
                description: saveResult.error,
            });
            setIsSaving(false);
            return;
        }

        toast({
            title: '評分已儲存',
            description: '您的競技場評分已儲存至資料庫。',
        });

        const sanitize = (text: string | undefined | null) => {
          if (!text) return '""';
          const cleanedText = text.trim().replace(/ +/g, ' ');
          const csvEscapedText = cleanedText.replace(/"/g, '""');
          return `"${csvEscapedText}"`;
        };

        const operatorNameSanitized = sanitize(operatorName);
        const operatorEmailSanitized = sanitize(operatorEmail);

        const headers = ['operatorName', 'operatorEmail', 'question', 'answer_model_a', 'answer_model_b', 'judgment', 'model_a_name', 'model_b_name'];
        const rows = judgmentsToSave.map(j => [
            operatorNameSanitized,
            operatorEmailSanitized,
            sanitize(j.question),
            sanitize(j.answer_model_a),
            sanitize(j.answer_model_b),
            sanitize(j.judgment),
            sanitize(j.model_a_name),
            sanitize(j.model_b_name),
        ].join(','));
        const csvContent = [headers.join(','), ...rows].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `arena_judgments_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error('Save/Export Arena failed:', error);
        toast({
            variant: 'destructive',
            title: '發生錯誤',
            description: '無法儲存或匯出競技場評分。',
        });
    } finally {
        setIsSaving(false);
    }
  };
  
  const progress = comparisons.length > 0 ? ((comparisons.filter(c => c.judgment !== null).length) / comparisons.length) * 100 : 0;
  const allJudged = comparisons.every(c => c.judgment !== null);

  if (comparisons.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-full">
            <Card>
                <CardHeader>
                    <CardTitle>處理錯誤</CardTitle>
                    <CardDescription>無法從模型中獲取結構化回應。</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">請嘗試重新生成回應。</p>
                    <Button onClick={onRestart} className="w-full">
                        <RotateCcw className="mr-2" /> 開始新的評估
                    </Button>
                </CardContent>
            </Card>
          </div>
      )
  }

  const currentComparison = comparisons[currentPage];

  return (
    <div className="grid grid-rows-[auto_auto_auto_auto] gap-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>競技場模式：審核問題</CardTitle>
            <Badge variant="outline">{currentPage + 1} / {comparisons.length}</Badge>
          </div>
          <CardDescription>{result.userPrompt}</CardDescription>
        </CardHeader>
        <CardContent>
            <Progress value={progress} />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>問題 {currentPage + 1}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg">{currentComparison.question}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>答案 A</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{currentComparison.answerA}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>答案 B</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{currentComparison.answerB}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 pt-2">
        <Card>
          <CardHeader>
              <CardTitle>您的評分</CardTitle>
              <CardDescription>哪個答案更好？或者它們的品質相似？</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Button variant={currentComparison.judgment === 'A' ? 'default' : 'outline'} onClick={() => handleJudgment('A')}>答案 A 更好</Button>
              <Button variant={currentComparison.judgment === 'B' ? 'default' : 'outline'} onClick={() => handleJudgment('B')}>答案 B 更好</Button>
              <Button variant={currentComparison.judgment === 'Both' ? 'default' : 'outline'} onClick={() => handleJudgment('Both')}>兩者都好</Button>
              <Button variant={currentComparison.judgment === 'Neither' ? 'default' : 'outline'} onClick={() => handleJudgment('Neither')}>兩者都不好</Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0} variant="outline">
              <ArrowLeft className="mr-2" /> 上一個
          </Button>
          <Button onClick={() => setCurrentPage(p => Math.min(comparisons.length - 1, p + 1))} disabled={currentPage === comparisons.length - 1} variant="outline">
              下一個 <ArrowRight className="ml-2" />
          </Button>
          <Button onClick={handleExportAndSave} disabled={!allJudged || isSaving} className="bg-green-600 hover:bg-green-700">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2" />}
            {isSaving ? '正在儲存並匯出...' : '儲存並匯出評分'}
          </Button>
          <Button onClick={onRestart} variant="secondary">
              <RotateCcw className="mr-2" /> 重新開始
          </Button>
        </div>
      </div>
    </div>
  );
}
