'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Undo2, Trash2, Plus, Pencil, Save } from 'lucide-react';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import type { ConfirmedAnnotation, GeneratedAnnotation } from '@/app/types';

type AnnotationCardProps = {
  annotation: ConfirmedAnnotation | GeneratedAnnotation;
  isSuggestion?: boolean;
  isEditing?: boolean;
  onConfirm?: () => void;
  onDelete?: (id: number) => void;
  onReturnToSuggestions?: (annotation: ConfirmedAnnotation) => void;
  onEditToggle?: () => void;
  onUpdate?: (field: keyof GeneratedAnnotation, value: any) => void;
  onUpdateOption?: (optionIndex: number, value: string) => void;
};

export function AnnotationCard({
  annotation,
  isSuggestion = false,
  isEditing = false,
  onConfirm,
  onDelete,
  onReturnToSuggestions,
  onEditToggle,
  onUpdate,
  onUpdateOption,
}: AnnotationCardProps) {
  const cardClass = isSuggestion ? "bg-secondary/50" : "bg-primary/5 border-primary/20";
  const confirmedAnnotation = annotation as ConfirmedAnnotation;
  const generatedAnnotation = annotation as GeneratedAnnotation;

  const renderContent = () => {
    if (isSuggestion && isEditing && onUpdate && onUpdateOption) {
      // Editable Suggestion Card
      return (
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">問題</Label>
            <Textarea
              value={generatedAnnotation.question}
              onChange={(e) => onUpdate('question', e.target.value)}
              className="text-sm bg-background"
            />
          </div>

          {generatedAnnotation.options ? (
            <div className="space-y-2">
              <Label className="text-xs font-semibold">選項與答案</Label>
              <RadioGroup
                value={generatedAnnotation.answer}
                onValueChange={(newAnswer) => onUpdate('answer', newAnswer)}
                className="space-y-3 pt-1"
              >
                {generatedAnnotation.options.map((option, optIndex) => (
                  <div key={optIndex} className="flex items-start gap-3">
                    <div className="flex items-center h-full pt-2">
                      <RadioGroupItem value={option} id={`q-${(annotation as any).id}-opt-${optIndex}`} />
                    </div>
                    <Textarea
                      value={option}
                      onChange={(e) => onUpdateOption(optIndex, e.target.value)}
                      className="text-sm bg-background"
                    />
                  </div>
                ))}
              </RadioGroup>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs font-semibold">答案</Label>
              <Textarea
                value={generatedAnnotation.answer}
                onChange={(e) => onUpdate('answer', e.target.value)}
                className="text-sm bg-background"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs font-semibold">關鍵字</Label>
            <Input
              value={generatedAnnotation.answerkeyword}
              onChange={(e) => onUpdate('answerkeyword', e.target.value)}
              className="text-sm bg-background"
            />
          </div>
        </CardContent>
      );
    }

    // Display-only Card (for confirmed annotations and non-editing suggestions)
    return (
      <CardContent className="p-3 pt-0">
        {annotation.options && annotation.options.length > 0 ? (
          <div className="text-sm space-y-1.5">
            {annotation.options.map((option, index) => (
              <div key={index} className={`flex items-start ${option === annotation.text ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                <span className="mr-2 font-mono text-xs leading-relaxed">{String.fromCharCode(65 + index)}.</span>
                <span className="leading-relaxed">{option}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm italic text-muted-foreground">"{annotation.text}"</p>
        )}
        <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">關鍵字： {annotation.answerkeyword}</p>
      </CardContent>
    );
  };

  return (
    <div className="group relative animate-in fade-in-50">
      <Card className={cardClass}>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm font-medium">{annotation.annotation}</CardTitle>
        </CardHeader>
        {renderContent()}
        {isSuggestion && (
          <CardFooter className="p-3 pt-0">
            <Button size="sm" className="w-full" onClick={onConfirm}>
              <Plus className="mr-2 h-4 w-4" /> 新增至我的標註
            </Button>
          </CardFooter>
        )}
      </Card>
      <div className="absolute top-1 right-1 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isSuggestion && onEditToggle && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEditToggle}>
            {isEditing ? <Save className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </Button>
        )}
        {!isSuggestion && onReturnToSuggestions && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onReturnToSuggestions(confirmedAnnotation)} title="退回建議">
            <Undo2 className="h-4 w-4" />
          </Button>
        )}
        {!isSuggestion && onDelete && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/80" onClick={() => onDelete(confirmedAnnotation.id)} title="刪除標註">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
