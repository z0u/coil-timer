import { useEffect, useState } from 'react';

export type Scheme = 'light' | 'dark' | 'auto';

const getInitialScheme = (): Scheme => {
  const storedScheme = localStorage.getItem('theme');
  if (storedScheme === 'light' || storedScheme === 'dark') {
    return storedScheme;
  }
  return 'auto';
};

const applySchemeToDOM = (scheme: Scheme) => {
  document.documentElement.classList.toggle(
    'dark',
    scheme === 'dark' || (scheme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches),
  );
};

export const useColorScheme = () => {
  const [selectedScheme, setSelectedScheme] = useState<Scheme>(getInitialScheme());
  const [effectiveScheme, setEffectiveScheme] = useState<Scheme>(getInitialScheme());

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

  const updateScheme = (s: Scheme) => {
    if (s === 'auto') {
      localStorage.removeItem('theme');
    } else {
      localStorage.setItem('theme', s);
    }
    setSelectedScheme(s);
  };

  return { effective: effectiveScheme, selected: selectedScheme, update: updateScheme } as const;
};
