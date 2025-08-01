import * as math from '@thi.ng/math';
import * as v from '@thi.ng/vectors';
import clsx from 'clsx';
import { useRef } from 'react';

export interface JogEvent {
  deltaAngle: number;
  wasDragged: boolean;
}

export interface JogDialProps {
  /** CSS class names to apply to the button */
  className?: string;
  /** Accessibility label */
  'aria-label'?: string;
  /** Tooltip title */
  title?: string;
  /** Called when pointer is pressed down */
  onJogStart?: () => void;
  /** Called during pointer movement with angle delta */
  onJogMove?: (event: JogEvent) => void;
  /** Called when pointer is released */
  onJogEnd?: (event: JogEvent) => void;
  /** Distance threshold in pixels to distinguish tap from drag */
  dragTolerance?: number;
  /** Child elements to render inside the button */
  children?: React.ReactNode;
}

interface JogState {
  startPos: v.Vec2Like;
  lastPos: v.Vec2Like;
  wasDragged: boolean;
}

const TAP_DRAG_TOLERANCE = 12; // px

/** Combination button and knob. */
export const JogDial: React.FC<JogDialProps> = ({
  className,
  'aria-label': ariaLabel,
  title,
  onJogStart,
  onJogMove,
  onJogEnd,
  dragTolerance = TAP_DRAG_TOLERANCE,
  children,
}) => {
  const interactionRef = useRef<JogState | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const pos: v.Vec2Like = [e.clientX, e.clientY];
    const element = e.target as HTMLElement;

    interactionRef.current = { startPos: pos, lastPos: pos, wasDragged: false };

    element.setPointerCapture(e.pointerId);
    onJogStart?.();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!interactionRef.current) return;

    const interaction = interactionRef.current;
    const pos: v.Vec2Like = [e.clientX, e.clientY];

    if (!interaction.wasDragged && v.dist(pos, interaction.startPos) > dragTolerance) {
      interaction.wasDragged = true;
    }

    if (interaction.wasDragged) {
      const lastAngle = getAngleFromPoint(interaction.lastPos, e.target as HTMLElement);
      const currentAngle = getAngleFromPoint(pos, e.target as HTMLElement);
      const deltaAngle = math.wrapOnce(currentAngle - lastAngle, -Math.PI, Math.PI);
      onJogMove?.({ deltaAngle, wasDragged: interaction.wasDragged });
      interaction.lastPos = pos;
    }
  };

  const handleLostPointerCapture = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!interactionRef.current) return;

    const wasDragged = interactionRef.current.wasDragged;
    onJogEnd?.({ deltaAngle: 0, wasDragged });

    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    interactionRef.current = null;
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
  };

  return (
    <button
      aria-label={ariaLabel}
      title={title}
      className={clsx(
        'touch-none cursor-pointer', // Prevent reload on drag on mobile
        className,
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onLostPointerCapture={handleLostPointerCapture}
      onClick={handleClick}
    >
      {children}
    </button>
  );
};

const getAngleFromPoint = (pos: v.Vec2Like, element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  const center = [rect.left + rect.width / 2, rect.top + rect.height / 2];
  const vec = v.sub2([], pos, center);
  return v.heading(vec);
};
