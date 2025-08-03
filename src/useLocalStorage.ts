import { useEffect, useState } from 'react';
import z, { ZodType } from 'zod';

const load = <S extends ZodType>(key: string, schema: S) => {
  const value = localStorage.getItem(key);
  if (value == null) return undefined;

  const parsed = schema.safeParse(JSON.parse(value));
  if (!parsed.success) {
    console.warn(`Failed to load ${key} from storage: Validation failed: ${parsed.error}`);
    return undefined;
  }
  console.debug(`Loaded ${key}`);
  return parsed.data;
};

const save = <S extends ZodType>(key: string, schema: S, value: z.infer<S>) => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    console.warn(`Failed to save ${key} to storage: Validation failed: ${parsed.error}`);
    return;
  }

  localStorage.setItem(key, JSON.stringify(parsed.data));
  console.debug(`Saved ${key}`);
};

export const useLocalStorage = <S extends ZodType>(key: string, schema: S, initial: z.infer<S>) => {
  const [state, setState] = useState<z.infer<S>>(() => {
    try {
      return load(key, schema) ?? initial;
    } catch (e) {
      console.warn(`Failed to get state: ${e}`);
      return initial;
    }
  });

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== key) return;

      const newState = load(key, schema);
      setState(newState ?? initial);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [initial, key, schema]);

  const saveState = (value: z.infer<S>) => {
    save(key, schema, value);
    setState(value);
  };

  return [state, (value: z.infer<S>) => saveState(value)] as const;
};
