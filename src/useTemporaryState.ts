import { SetStateAction, useCallback, useState } from 'react';
import { useTimeoutRef } from './useTimeoutRef';

export function useTemporaryState<S>(
  initialState: S | (() => S),
  duration: number,
): [S, (tempState: SetStateAction<S>, duration?: number) => void] {
  const [state, _setState] = useState(initialState);
  const timeout = useTimeoutRef();
  const _duration = duration;

  const setState = useCallback(
    (tempState: SetStateAction<S>, duration?: number) => {
      _setState(tempState);
      timeout.set(() => _setState(initialState), duration ?? _duration);
    },
    [initialState, _duration],
  );

  return [state, setState];
}
