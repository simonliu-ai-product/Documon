import { BotMessageSquare } from 'lucide-react';
import React from 'react';
import Link from 'next/link';

export function Header({ onLogoClick }: { onLogoClick?: () => void }) {
  return (
    <header className="border-b bg-card sticky top-0 z-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" onClick={onLogoClick} className="flex items-center gap-3">
            <BotMessageSquare className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Documon</h1>
          </Link>
          <p className="text-sm text-muted-foreground hidden md:block">
            Your AI-Powered Document Annotation & Evaluation Assistant
          </p>
        </div>
      </div>
    </header>
  );
}
