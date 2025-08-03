import { useEffect, useState } from 'react';

const getInitialScheme = () => {
  const storedScheme = localStorage.getItem('theme');
  if (storedScheme === 'light' || storedScheme === 'dark') {
    return storedScheme;
  }
  return 'auto';
};

const applySchemeToDOM = (scheme: 'light' | 'dark') => {
  document.documentElement.classList.toggle('dark', scheme === 'dark');
};

export const useColorScheme = () => {
  const [selectedScheme, setSelectedScheme] = useState<'light' | 'dark' | 'auto'>(getInitialScheme());
  const [effectiveScheme, setEffectiveScheme] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    if (selectedScheme === 'auto') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');

      const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
        const _effectiveScheme = e.matches ? 'dark' : 'light';
        applySchemeToDOM(_effectiveScheme);
        setEffectiveScheme(_effectiveScheme);
      };
      handleChange(mql);

      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    } else {
      applySchemeToDOM(selectedScheme);
      setEffectiveScheme(selectedScheme);
    }
  }, [selectedScheme]);

  const updateScheme = (s: 'light' | 'dark' | 'auto') => {
    if (s === 'auto') {
      localStorage.removeItem('theme');
    } else {
      localStorage.setItem('theme', s);
    }
    setSelectedScheme(s);
  };

  return { effective: effectiveScheme, selected: selectedScheme, update: updateScheme } as const;
};
