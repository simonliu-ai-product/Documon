'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { AnnotationCard } from '@/components/AnnotationCard';
import { Button } from '@/components/ui/button';
import { UploadCloud, Wand2, FileText, Plus, Download, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ArenaComparison } from '@/components/ArenaComparison';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import dynamic from 'next/dynamic';
import type { ConfirmedAnnotation, GeneratedAnnotation, ArenaResult, OperationType } from './types';
import { generateAnnotationsFromDocument, runArenaEvaluationAction, saveAndGenerateCsvAction } from './actions';

const PdfViewer = dynamic(() => 
  import('@/components/PdfViewer').then(mod => mod.PdfViewer), 
  { 
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /><p className="ml-2">正在載入 PDF 檢視器...</p></div>
  }
);


type View = 'form' | 'results' | 'arena-results' | 'manual-annotation';

// --- Refactored Sub-Components ---

const ConsentDialog = ({ onConsent }: { onConsent: () => void }) => {
  const [consentChecked, setConsentChecked] = useState(false);
  return (
    <div className="flex items-center justify-center h-full">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle>使用聲明與同意書</CardTitle>
          <CardDescription>請閱讀並同意以下條款以繼續。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-left">
          <ScrollArea className="h-48 p-4 border rounded-md">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {`歡迎使用 Documon 標註平台。\n\n為了持續改善我們的 AI 模型與服務品質，當您上傳文件並使用本工具進行標註或模型評估時，系統將會收集您上傳的內容、生成的問題與答案，以及您最終的標註與評估結果。\n\n請不要上傳任何包含敏感個人資訊、機密或受版權保護的資料。\n\n點擊「同意並繼續」即表示您已閱讀、理解並同意上述條款。`}
            </p>
          </ScrollArea>
          <div className="flex items-center space-x-2">
            <Checkbox id="consent-checkbox" checked={consentChecked} onCheckedChange={(c) => setConsentChecked(!!c)} />
            <Label htmlFor="consent-checkbox">我已閱讀並同意上述條款。</Label>
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" disabled={!consentChecked} onClick={onConsent}>同意並繼續</Button>
        </CardFooter>
      </Card>
    </div>
  );
};

const ProcessingIndicator = () => (
  <div className="flex items-center justify-center h-full">
    <Loader2 className="h-16 w-16 animate-spin" />
    <p className="ml-4 text-lg">正在處理您的文件...</p>
  </div>
);

const UploadForm = ({
  operatorName, setOperatorName,
  operatorEmail, setOperatorEmail,
  operationType, setOperationType,
  numQuestions, setNumQuestions,
  questionDirection, setQuestionDirection,
  onUploadClick, isProcessing,
}: any) => {
  const isAiMode = !operationType.startsWith('csv-') && !operationType.startsWith('manual-');
  return (
    <div className="flex items-center justify-center h-full">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle>上傳文件</CardTitle>
          <CardDescription>選擇操作類型，填寫您的資訊，並上傳文件。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="operator-name">使用者姓名 <span className="text-destructive">*</span></Label>
            <Input id="operator-name" value={operatorName} onChange={(e) => setOperatorName(e.target.value)} placeholder="您的姓名" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="operator-email">使用者電子郵件 <span className="text-destructive">*</span></Label>
            <Input id="operator-email" type="email" value={operatorEmail} onChange={(e) => setOperatorEmail(e.target.value)} placeholder="您的電子郵件" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="operation-type">操作類型 <span className="text-destructive">*</span></Label>
            <Select value={operationType} onValueChange={(v) => setOperationType(v as OperationType)}>
              <SelectTrigger id="operation-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="arena">AI 模型競技場</SelectItem>
                <SelectItem value="open-ended">AI 生成開放式問題</SelectItem>
                <SelectItem value="multiple-choice">AI 生成選擇題</SelectItem>
                <SelectItem value="manual-open-ended">手動標註開放式問題</SelectItem>
                <SelectItem value="manual-multiple-choice">手動標註選擇題</SelectItem>
                <SelectItem value="csv-open-ended">CSV 匯入開放式問題</SelectItem>
                <SelectItem value="csv-multiple-choice">CSV 匯入選擇題</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isAiMode && (
            <>
              <div className="space-y-2">
                <Label htmlFor="num-questions">問題數量</Label>
                <Input id="num-questions" type="number" value={numQuestions} onChange={(e) => setNumQuestions(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="question-direction">問題方向（選填）</Label>
                <Textarea id="question-direction" value={questionDirection} onChange={(e) => setQuestionDirection(e.target.value)} placeholder="例如：專注於歷史事件..." />
              </div>
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button size="lg" onClick={onUploadClick} disabled={isProcessing || !operatorName.trim() || !operatorEmail.trim()} className="w-full">
            {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UploadCloud className="mr-2 h-5 w-5" />}
            {isProcessing ? '處理中...' : '上傳並處理'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

const ResultsDisplay = ({
  generatedAnnotations, annotations, editingSuggestionIndex, setEditingSuggestionIndex,
  handleConfirmAnnotation, handleUpdateGeneratedAnnotation, handleUpdateGeneratedOption,
  handleReturnToSuggestions, handleDeleteAnnotation, handleExportAnnotationsToCSV,
  isSaving, resetState,
}: any) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center"><Wand2 className="mr-3 h-6 w-6" />AI 建議</CardTitle>
        <CardDescription>
          檢視並編輯建議。由...生成：
          {generatedAnnotations.length > 0 && <Badge variant="secondary" className="ml-2">{generatedAnnotations[0].modelName}</Badge>}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        <ScrollArea className="h-full p-4">
          {generatedAnnotations.length > 0 ? (
            <div className="space-y-4">
              {generatedAnnotations.map((genAnn: any, i: number) => (
                <AnnotationCard
                  isSuggestion
                  key={i}
                  annotation={{ ...genAnn, id: i, annotation: genAnn.question, text: genAnn.answer }}
                  isEditing={editingSuggestionIndex === i}
                  onEditToggle={() => setEditingSuggestionIndex(editingSuggestionIndex === i ? null : i)}
                  onConfirm={() => handleConfirmAnnotation(i)}
                  onUpdate={(field: any, value: any) => handleUpdateGeneratedAnnotation(i, field, value)}
                  onUpdateOption={(optIndex: any, value: any) => handleUpdateGeneratedOption(i, optIndex, value)}
                />
              ))}
            </div>
          ) : <p className="text-center text-muted-foreground">沒有建議。</p>}
        </ScrollArea>
      </CardContent>
    </Card>

    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center"><FileText className="mr-3 h-6 w-6" />我的標註</CardTitle>
        <CardDescription>您已確認的標註： <Badge variant="secondary">{annotations.length}</Badge></CardDescription>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        <ScrollArea className="h-full p-4">
          {annotations.length > 0 ? (
            <div className="space-y-3">
              {annotations.map((ann: any) => (
                <AnnotationCard key={ann.id} annotation={ann} onReturnToSuggestions={handleReturnToSuggestions} onDelete={handleDeleteAnnotation} />
              ))}
            </div>
          ) : <p className="text-center text-muted-foreground">沒有已確認的標註。</p>}
        </ScrollArea>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button className="w-full" onClick={handleExportAnnotationsToCSV} disabled={annotations.length === 0 || isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          儲存並匯出
        </Button>
        <Button className="w-full" variant="outline" onClick={resetState}>開始新的任務</Button>
      </CardFooter>
    </Card>
  </div>
);

const ManualAnnotationInterface = ({
  pdfUrl, operationType, manualQuestion, setManualQuestion, manualAnswer, setManualAnswer,
  manualKeywords, setManualKeywords, manualOptions, setManualOptions, manualCorrectOption,
  setManualCorrectOption, handleAddManualAnnotation, annotations, handleDeleteAnnotation,
  handleExportAnnotationsToCSV, isSaving, resetState,
}: any) => {
  const isMc = operationType === 'manual-multiple-choice';
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
      <Card className="h-full flex flex-col">
        <CardHeader><CardTitle>PDF 文件</CardTitle></CardHeader>
        <CardContent className="flex-grow overflow-hidden">
          {pdfUrl && <PdfViewer url={pdfUrl} />}
        </CardContent>
      </Card>
      <div className="h-full flex flex-col gap-8">
        <Card>
          <CardHeader><CardTitle>手動標註</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Textarea value={manualQuestion} onChange={(e) => setManualQuestion(e.target.value)} placeholder="問題" />
            {isMc ? (
              <RadioGroup value={String(manualCorrectOption)} onValueChange={(v) => setManualCorrectOption(parseInt(v))}>
                {manualOptions.map((opt: string, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <RadioGroupItem value={String(i)} id={`opt-${i}`} />
                    <Input value={opt} onChange={(e) => setManualOptions((o: string[]) => o.map((v, idx) => idx === i ? e.target.value : v))} placeholder={`選項 ${i + 1}`} />
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <Textarea value={manualAnswer} onChange={(e) => setManualAnswer(e.target.value)} placeholder="答案" />
            )}
            <Input value={manualKeywords} onChange={(e) => setManualKeywords(e.target.value)} placeholder="關鍵字（以逗號分隔）" />
          </CardContent>
          <CardFooter><Button className="w-full" onClick={handleAddManualAnnotation}><Plus className="mr-2 h-4 w-4" />新增標註</Button></CardFooter>
        </Card>
        <Card className="h-full flex flex-col flex-grow">
          <CardHeader><CardTitle>我的標註 ({annotations.length})</CardTitle></CardHeader>
          <CardContent className="flex-grow overflow-hidden">
            <ScrollArea className="h-full p-4">
              {annotations.map((ann: any) => (<AnnotationCard key={ann.id} annotation={ann} onDelete={handleDeleteAnnotation} />))}
            </ScrollArea>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button className="w-full" onClick={handleExportAnnotationsToCSV} disabled={annotations.length === 0 || isSaving}>{isSaving ? '匯出中...' : '儲存並匯出'}</Button>
            <Button className="w-full" variant="outline" onClick={resetState}>開始新的任務</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};


// --- Main Page Component ---

export default function Home() {
  // View and State Management
  const [view, setView] = useState<View>('form');
  const [operationType, setOperationType] = useState<OperationType>('arena');
  const [consentGiven, setConsentGiven] = useState(false);

  // File and Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfUrl, setPdfUrl] = useState('');
  
  // Operator and AI Config State
  const [operatorName, setOperatorName] = useState('');
  const [operatorEmail, setOperatorEmail] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [questionDirection, setQuestionDirection] = useState('');

  // Annotation Data State
  const [annotations, setAnnotations] = useState<ConfirmedAnnotation[]>([]);
  const [generatedAnnotations, setGeneratedAnnotations] = useState<GeneratedAnnotation[]>([]);
  const [editingSuggestionIndex, setEditingSuggestionIndex] = useState<number | null>(null);
  
  // Manual Annotation State
  const [manualQuestion, setManualQuestion] = useState('');
  const [manualAnswer, setManualAnswer] = useState('');
  const [manualKeywords, setManualKeywords] = useState('');
  const [manualOptions, setManualOptions] = useState(['', '', '', '']);
  const [manualCorrectOption, setManualCorrectOption] = useState(0);

  // Arena State
  const [arenaResult, setArenaResult] = useState<ArenaResult | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    // This dynamically imports pdfjs and sets the worker source.
    // It's done in useEffect to ensure it only runs on the client side.
    import('pdfjs-dist').then(pdfjs => {
      pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    });
  }, []);

  // Core Functions
  const resetState = useCallback(() => {
    setView('form');
    setOperationType('arena');
    setAnnotations([]);
    setGeneratedAnnotations([]);
    setEditingSuggestionIndex(null);
    setArenaResult(null);
    setIsProcessing(false);
    setIsSaving(false);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl('');
    setManualQuestion('');
    setManualAnswer('');
    setManualKeywords('');
    setManualOptions(['', '', '', '']);
    setManualCorrectOption(0);
    setQuestionDirection('');
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
    // Keep operator info and consent
  }, [pdfUrl]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const parseCsv = (text: string, isMultipleChoice: boolean): Array<Record<string, string>> => {
    const lines = text.trim().replace(/\r\n/g, '\n').split('\n');
    if (lines.length < 2) throw new Error("CSV 必須包含標頭和至少一列資料。");
    
    const headers = lines[0].split(',').map(h => h.trim());
    const requiredHeaders = ['Question', 'Answer', 'Keyword'];
    if (isMultipleChoice) requiredHeaders.push('Option1', 'Option2', 'Option3', 'Option4');

    for (const requiredHeader of requiredHeaders) {
      if (!headers.includes(requiredHeader)) throw new Error(`CSV 缺少必要的標頭： ${requiredHeader}`);
    }

    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      return headers.reduce((obj, header, index) => {
        obj[header] = values[index] || '';
        return obj;
      }, {} as Record<string, string>);
    });
  };

  // Event Handlers
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isCsvMode = operationType.startsWith('csv-');
    const isManualMode = operationType.startsWith('manual-');
    const isAiMode = !isCsvMode && !isManualMode;

    if (isCsvMode && !file.name.endsWith('.csv')) {
      toast({ variant: 'destructive', title: '無效的檔案類型', description: '請上傳 CSV 檔案。' });
      return;
    }
    if ((isAiMode || isManualMode) && file.type !== 'application/pdf') {
      toast({ variant: 'destructive', title: '無效的檔案類型', description: '請上傳 PDF 檔案。' });
      return;
    }
    
    setIsProcessing(true);

    try {
      if (isCsvMode) {
        const text = await file.text();
        const parsed = parseCsv(text, operationType === 'csv-multiple-choice');
        const annotations = parsed.map(row => ({
          question: row.Question || '',
          answer: row.Answer || '',
          answerkeyword: row.Keywords || '',
          options: operationType === 'csv-multiple-choice' ? [row.Option1, row.Option2, row.Option3, row.Option4].filter(Boolean) : undefined,
          modelName: 'csv-import',
        }));
        setGeneratedAnnotations(annotations);
        setView('results');
      } else if (isManualMode) {
        setPdfUrl(URL.createObjectURL(file));
        setView('manual-annotation');
      } else { // AI Mode
        const pdfjsLib = await import('pdfjs-dist');
        const fileBuffer = await file.arrayBuffer();
        const typedarray = new Uint8Array(fileBuffer);
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        
        const pageTexts = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          pageTexts.push(textContent.items.map(item => ('str' in item ? item.str : '')).join(' '));
        }
        const fullText = pageTexts.join('\n\n');
        
        if (operationType === 'arena') {
          const result = await runArenaEvaluationAction({ documentContent: fullText, numQuestions, questionDirection });
          if (result.success) {
            setArenaResult({ ...result.result, userPrompt: `產生 ${numQuestions} 個問題` });
            setView('arena-results');
          } else {
            toast({ variant: "destructive", title: "執行競技場時發生錯誤", description: result.error });
          }
        } else {
          const result = await generateAnnotationsFromDocument({ documentContent: fullText, numQuestions, questionType: operationType, questionDirection });
          if (result.success) {
            setGeneratedAnnotations(result.annotations.map(a => ({ ...a, modelName: result.modelName })));
            setView('results');
          } else {
            toast({ variant: "destructive", title: "生成標註時發生錯誤", description: result.error });
          }
        }
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "處理錯誤", description: error.message });
      resetState();
    } finally {
      setIsProcessing(false);
      if (event.target) event.target.value = "";
    }
  };

  const handleUpdateGeneratedAnnotation = (index: number, field: keyof GeneratedAnnotation, value: string) => {
    setGeneratedAnnotations(prev => prev.map((ann, i) => i === index ? { ...ann, [field]: value } : ann));
  };

  const handleUpdateGeneratedOption = (suggestionIndex: number, optionIndex: number, newText: string) => {
    setGeneratedAnnotations(prev => prev.map((ann, i) => {
      if (i !== suggestionIndex || !ann.options) return ann;
      const newOptions = [...ann.options];
      const oldOptionText = newOptions[optionIndex];
      newOptions[optionIndex] = newText;
      const newAnswer = ann.answer === oldOptionText ? newText : ann.answer;
      return { ...ann, options: newOptions, answer: newAnswer };
    }));
  };

  const handleConfirmAnnotation = (index: number) => {
    const ann = generatedAnnotations[index];
    setAnnotations(prev => [...prev, { ...ann, id: Date.now(), text: ann.answer, annotation: ann.question }]);
    setGeneratedAnnotations(prev => prev.filter((_, i) => i !== index));
    setEditingSuggestionIndex(null);
  };

  const handleReturnToSuggestions = (annotationToReturn: ConfirmedAnnotation) => {
    setGeneratedAnnotations(prev => [{
      question: annotationToReturn.annotation,
      answer: annotationToReturn.text,
      answerkeyword: annotationToReturn.answerkeyword,
      options: annotationToReturn.options,
      modelName: annotationToReturn.modelName,
    }, ...prev]);
    setAnnotations(prev => prev.filter(a => a.id !== annotationToReturn.id));
  };

  const handleDeleteAnnotation = (annotationId: number) => {
    setAnnotations(prev => prev.filter(ann => ann.id !== annotationId));
    toast({ title: "標註已刪除" });
  };

  const handleAddManualAnnotation = () => {
    const isMc = operationType === 'manual-multiple-choice';
    if (!manualQuestion.trim() || !manualKeywords.trim() || (isMc ? manualOptions.some(o => !o.trim()) : !manualAnswer.trim())) {
      toast({ variant: 'destructive', title: '缺少欄位', description: '請填寫所有必填欄位。' });
      return;
    }
    const newAnnotation: ConfirmedAnnotation = {
      id: Date.now(),
      annotation: manualQuestion.trim(),
      text: isMc ? manualOptions[manualCorrectOption].trim() : manualAnswer.trim(),
      answerkeyword: manualKeywords.trim(),
      options: isMc ? manualOptions.map(o => o.trim()) : undefined,
      modelName: operationType,
    };
    setAnnotations(prev => [...prev, newAnnotation]);
    setManualQuestion('');
    setManualAnswer('');
    setManualKeywords('');
    setManualOptions(['', '', '', '']);
    setManualCorrectOption(0);
  };

  const handleExportAnnotationsToCSV = async () => {
    if (annotations.length === 0) {
      toast({ variant: 'destructive', title: '沒有可匯出的標註' });
      return;
    }
    setIsSaving(true);
    try {
      const result = await saveAndGenerateCsvAction({ annotations, operatorName, operatorEmail });
      if (!result.success) {
        toast({ variant: 'destructive', title: '匯出失敗', description: result.error });
        return;
      }
      toast({ title: '已儲存至資料庫', description: '您的標註已儲存。' });
      const download = (filename: string, csv?: string) => {
        if (!csv) return;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
      };
      download('annotations_multiple_choice.csv', result.multipleChoiceCsv);
      download('annotations_open_ended.csv', result.openEndedCsv);
    } catch (error: any) {
      toast({ variant: 'destructive', title: '匯出錯誤', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Main Render Function
  const renderContent = () => {
    if (!consentGiven) {
      return <ConsentDialog onConsent={() => setConsentGiven(true)} />;
    }
    if (isProcessing) {
      return <ProcessingIndicator />;
    }
    
    const isCsvMode = operationType.startsWith('csv-');
    const acceptType = isCsvMode ? '.csv' : '.pdf';

    switch (view) {
      case 'form':
        return (
          <>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept={acceptType} />
            <UploadForm
              operatorName={operatorName} setOperatorName={setOperatorName}
              operatorEmail={operatorEmail} setOperatorEmail={setOperatorEmail}
              operationType={operationType} setOperationType={setOperationType}
              numQuestions={numQuestions} setNumQuestions={setNumQuestions}
              questionDirection={questionDirection} setQuestionDirection={setQuestionDirection}
              onUploadClick={handleUploadClick} isProcessing={isProcessing}
            />
          </>
        );
      case 'results':
        return <ResultsDisplay
          generatedAnnotations={generatedAnnotations} annotations={annotations}
          editingSuggestionIndex={editingSuggestionIndex} setEditingSuggestionIndex={setEditingSuggestionIndex}
          handleConfirmAnnotation={handleConfirmAnnotation} handleUpdateGeneratedAnnotation={handleUpdateGeneratedAnnotation}
          handleUpdateGeneratedOption={handleUpdateGeneratedOption} handleReturnToSuggestions={handleReturnToSuggestions}
          handleDeleteAnnotation={handleDeleteAnnotation} handleExportAnnotationsToCSV={handleExportAnnotationsToCSV}
          isSaving={isSaving} resetState={resetState}
        />;
      case 'manual-annotation':
        return <ManualAnnotationInterface
          pdfUrl={pdfUrl} operationType={operationType}
          manualQuestion={manualQuestion} setManualQuestion={setManualQuestion}
          manualAnswer={manualAnswer} setManualAnswer={setManualAnswer}
          manualKeywords={manualKeywords} setManualKeywords={setManualKeywords}
          manualOptions={manualOptions} setManualOptions={setManualOptions}
          manualCorrectOption={manualCorrectOption} setManualCorrectOption={setManualCorrectOption}
          handleAddManualAnnotation={handleAddManualAnnotation} annotations={annotations}
          handleDeleteAnnotation={handleDeleteAnnotation} handleExportAnnotationsToCSV={handleExportAnnotationsToCSV}
          isSaving={isSaving} resetState={resetState}
        />;
      case 'arena-results':
        return arenaResult ? <ArenaComparison result={arenaResult} onRestart={resetState} operatorName={operatorName} operatorEmail={operatorEmail} /> : <p>正在載入競技場結果...</p>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header onLogoClick={resetState} />
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        {renderContent()}
      </main>
    </div>
  );
}