'use client';

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';

export interface ReactionOverlayRef {
  addReaction: (emoji: string) => void;
}

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
}

export const ReactionOverlay = forwardRef<ReactionOverlayRef, {}>((_, ref) => {
  const [reactions, setReactions] = useState<FloatingEmoji[]>([]);

  const addReaction = useCallback((emoji: string) => {
    const id = `react-${Date.now()}-${Math.random()}`;
    // Random horizontal position around 15% - 85%
    const x = Math.floor(Math.random() * 70) + 15;
    setReactions((prev) => [...prev, { id, emoji, x }]);

    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2500);
  }, []);

  useImperativeHandle(ref, () => ({
    addReaction,
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {reactions.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-24 text-4xl animate-float-fade"
          style={{
            left: `${r.x}%`,
          }}
        >
          {r.emoji}
        </div>
      ))}
    </div>
  );
});

ReactionOverlay.displayName = 'ReactionOverlay';
