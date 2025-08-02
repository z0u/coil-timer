import { useEffect, useState } from 'react';

export const useColorScheme = () => {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const updateColorScheme = () => {
      setColorScheme(mql.matches ? 'dark' : 'light');
    };
    mql.addEventListener('change', updateColorScheme);
    return () => mql.removeEventListener('change', updateColorScheme);
  }, []);

  return colorScheme;
};
