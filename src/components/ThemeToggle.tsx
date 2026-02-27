'use client';

import { useTheme } from 'next-themes';
import { use, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Use use() hook pattern to avoid hydration mismatch
  // This pattern is recommended by React for conditional rendering based on client state
  const resolvedMounted = typeof window !== 'undefined' ? true : mounted;

  if (!resolvedMounted) {
    return (
      <Button variant="ghost" size="sm" className="w-9 px-0">
        <Sun className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-9 px-0"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      title={theme === 'dark' ? 'Kalo në dritë' : 'Kalo në errësirë'}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </Button>
  );
}
