import { useEffect, useState } from 'react';
import { storage } from '../../state/store';

export function useFirstPlayControls(active: boolean): [boolean, () => void] {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (active && !storage.get('seenControls', false)) setShow(true);
  }, [active]);
  return [
    show,
    () => {
      storage.set('seenControls', true);
      setShow(false);
    },
  ];
}

export const isTouchDevice = (): boolean => {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
};
