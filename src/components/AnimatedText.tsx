'use client';

import { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';

interface AnimatedTextProps {
  text: string;
  className?: string;
}

export function AnimatedText({ text, className = '' }: AnimatedTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!containerRef.current || hasAnimated.current) return;
    hasAnimated.current = true;

    const container = containerRef.current;
    
    // Clear and create text spans
    container.innerHTML = '';
    const chars = text.split('');
    
    chars.forEach((char) => {
      const span = document.createElement('span');
      span.className = 'inline-block';
      if (char === ' ') {
        span.innerHTML = '&nbsp;';
        span.style.width = '0.3em';
      } else {
        span.textContent = char;
      }
      span.style.transform = 'translateY(100%)';
      container.appendChild(span);
    });

    // Animate the characters from bottom to final position
    animate(container.children, {
      y: '0%',
      duration: 750,
      ease: 'out(3)',
      delay: stagger(50),
    });
  }, [text]);

  return (
    <div ref={containerRef} className={`inline-flex overflow-hidden ${className}`}>
      {text}
    </div>
  );
}
