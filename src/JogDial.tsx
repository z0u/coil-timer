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
  onInteractionStart?: () => void;
  /** Called during pointer movement with angle delta */
  onInteractionMove?: (interaction: JogEvent) => void;
  /** Called when pointer is released */
  onInteractionEnd?: (interaction: JogEvent) => void;
  /** Called on tap (click without drag) */
  onTap?: () => void;
  /** Distance threshold in pixels to distinguish tap from drag */
  dragTolerance?: number;
  /** Child elements to render inside the button */
  children?: React.ReactNode;
}

interface JogState {
  startPos: { x: number; y: number };
  lastPos: { x: number; y: number };
  wasDragged: boolean;
  element: HTMLElement;
}

const TAP_DRAG_TOLERANCE = 12; // px

/** Combination button and knob. */
export const JogDial: React.FC<JogDialProps> = ({
  className,
  'aria-label': ariaLabel,
  title,
  onInteractionStart,
  onInteractionMove,
  onInteractionEnd,
  onTap,
  dragTolerance = TAP_DRAG_TOLERANCE,
  children,
}) => {
  const interactionRef = useRef<JogState | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const pos = { x: e.clientX, y: e.clientY };
    const element = e.target as HTMLElement;

    interactionRef.current = {
      startPos: pos,
      lastPos: pos,
      wasDragged: false,
      element,
    };

    element.setPointerCapture(e.pointerId);
    onInteractionStart?.();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!interactionRef.current) return;

    const interaction = interactionRef.current;
    const currentPos = { x: e.clientX, y: e.clientY };

    // Check if we've moved far enough to be considered a drag
    const distFromStart = Math.sqrt(
      (currentPos.x - interaction.startPos.x) ** 2 + (currentPos.y - interaction.startPos.y) ** 2,
    );

    if (!interaction.wasDragged && distFromStart > dragTolerance) {
      interaction.wasDragged = true;
    }

    if (interaction.wasDragged) {
      const lastAngle = getAngleFromPoint(interaction.lastPos, interaction.element);
      const currentAngle = getAngleFromPoint(currentPos, interaction.element);
      let deltaAngle = currentAngle - lastAngle;

      // Handle angle wrapping
      if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
      if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;

      onInteractionMove?.({
        deltaAngle,
        wasDragged: interaction.wasDragged,
      });

      interaction.lastPos = currentPos;
    }
  };

  const handleLostPointerCapture = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!interactionRef.current) return;

    const interaction = interactionRef.current;
    const wasDragged = interaction.wasDragged;

    onInteractionEnd?.({
      deltaAngle: 0, // Not used in end callback
      wasDragged,
    });

    if (!wasDragged) {
      onTap?.();
    }

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

const getAngleFromPoint = (pos: { x: number; y: number }, element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = pos.x - centerX;
  const dy = pos.y - centerY;
  let angle = Math.atan2(dy, dx) + Math.PI / 2;
  if (angle < 0) angle += 2 * Math.PI;
  return angle;
};
