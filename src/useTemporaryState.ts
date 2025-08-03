import { SetStateAction, useCallback, useState } from 'react';
import { useTimeoutRef } from './useTimeoutRef';

export function useTemporaryState<S>(
  initialState: S | (() => S),
  duration?: number,
): [S, (tempState: SetStateAction<S>, duration?: number) => void] {
  const [state, _setState] = useState(initialState);
  const { set: _setTimeout } = useTimeoutRef();
  const _duration = duration ?? 0;

  const setState = useCallback(
    (tempState: SetStateAction<S>, duration?: number) => {
      _setState(tempState);
      _setTimeout(() => _setState(initialState), duration ?? _duration);
    },
    [initialState, _setTimeout, _duration],
  );

  return [state, setState];
}
