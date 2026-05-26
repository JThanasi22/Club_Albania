'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

type StickyHorizontalScrollProps = React.ComponentProps<'div'>;

function StickyHorizontalScroll({
  className,
  children,
  ...props
}: StickyHorizontalScrollProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const topRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const isSyncingRef = React.useRef(false);
  const [scrollWidth, setScrollWidth] = React.useState(0);
  const [canScrollX, setCanScrollX] = React.useState(false);

  React.useEffect(() => {
    const contentEl = contentRef.current;
    const topEl = topRef.current;
    if (!contentEl || !topEl) return;

    const updateMetrics = () => {
      setScrollWidth(contentEl.scrollWidth);
      setCanScrollX(contentEl.scrollWidth > topEl.clientWidth + 1);
    };

    updateMetrics();

    const resizeObserver = new ResizeObserver(updateMetrics);
    resizeObserver.observe(contentEl);
    resizeObserver.observe(topEl);

    return () => resizeObserver.disconnect();
  }, [children]);

  const syncScroll = (source: 'top' | 'bottom') => {
    if (isSyncingRef.current || !topRef.current || !bottomRef.current) return;

    isSyncingRef.current = true;
    if (source === 'top') {
      bottomRef.current.scrollLeft = topRef.current.scrollLeft;
    } else {
      topRef.current.scrollLeft = bottomRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingRef.current = false;
    });
  };

  return (
    <div className={cn('relative', className)} {...props}>
      <div
        ref={topRef}
        className="overflow-x-auto overflow-y-visible scrollbar-hide-x"
        onScroll={() => syncScroll('top')}
      >
        <div ref={contentRef} className="min-w-max">
          {children}
        </div>
      </div>
      <div
        ref={bottomRef}
        aria-hidden={!canScrollX}
        className={cn(
          'sticky bottom-0 z-10 overflow-x-auto custom-scrollbar-x border-t border-border/50 bg-card/95 py-1 backdrop-blur-sm',
          !canScrollX && 'hidden',
        )}
        onScroll={() => syncScroll('bottom')}
      >
        <div style={{ width: scrollWidth, height: 1 }} />
      </div>
    </div>
  );
}

export { StickyHorizontalScroll };
