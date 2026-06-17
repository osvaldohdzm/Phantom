'use client';

import { useCallback, useRef, useState } from 'react';
import { EMPTY_FINDING_FORM, type FindingFormValues } from '@/components/finding-form-editor';
import {
  AI_FILL_ORDER,
  type AiFormFieldKey,
  fieldHasValue,
  getFilledFieldKeys,
  sleep,
  typewriterReveal,
} from '@/lib/ai-form-fields';

export function useAiFormFill() {
  const [displayForm, setDisplayForm] = useState<FindingFormValues>(EMPTY_FINDING_FORM);
  const [animatingField, setAnimatingField] = useState<AiFormFieldKey | null>(null);
  const [aiSuggested, setAiSuggested] = useState<Set<AiFormFieldKey>>(new Set());
  const [isFilling, setIsFilling] = useState(false);
  const [fillProgress, setFillProgress] = useState(0);
  const [currentFieldLabel, setCurrentFieldLabel] = useState<string | null>(null);
  const abortRef = useRef(false);

  const resetAiState = useCallback(() => {
    abortRef.current = true;
    setAnimatingField(null);
    setIsFilling(false);
    setFillProgress(0);
    setCurrentFieldLabel(null);
    setAiSuggested(new Set());
  }, []);

  const markFieldSuggested = useCallback((key: AiFormFieldKey) => {
    setAiSuggested((prev) => new Set([...prev, key]));
  }, []);

  const animateSingleField = useCallback(
    async (
      key: AiFormFieldKey,
      value: FindingFormValues[AiFormFieldKey],
      opts?: { typewriter?: boolean }
    ) => {
      setAnimatingField(key);
      setCurrentFieldLabel(key);

      if (key === 'severidad') {
        setDisplayForm((prev) => ({ ...prev, severidad: value as FindingFormValues['severidad'] }));
        await sleep(350);
      } else if (key === 'componentes_afectados') {
        setDisplayForm((prev) => ({
          ...prev,
          componentes_afectados: value as string[],
        }));
        await sleep(400);
      } else if (typeof value === 'string' && opts?.typewriter !== false && value.length < 500) {
        await typewriterReveal(value, (partial) => {
          setDisplayForm((prev) => ({ ...prev, [key]: partial }));
        });
      } else if (typeof value === 'string') {
        setDisplayForm((prev) => ({ ...prev, [key]: '' }));
        await sleep(200);
        setDisplayForm((prev) => ({ ...prev, [key]: value }));
        await sleep(300);
      }

      markFieldSuggested(key);
      setAnimatingField(null);
      setCurrentFieldLabel(null);
    },
    [markFieldSuggested]
  );

  const animateFill = useCallback(
    async (target: FindingFormValues, filledKeys?: string[]) => {
      abortRef.current = false;
      setIsFilling(true);
      setFillProgress(0);
      setDisplayForm(EMPTY_FINDING_FORM);
      setAiSuggested(new Set());

      const keys = getFilledFieldKeys(target, filledKeys);
      if (!keys.length) {
        setDisplayForm(target);
        setIsFilling(false);
        return target;
      }

      let current: FindingFormValues = { ...EMPTY_FINDING_FORM };

      for (let i = 0; i < keys.length; i++) {
        if (abortRef.current) break;
        const key = keys[i];
        const value = target[key];
        setAnimatingField(key);
        setCurrentFieldLabel(key);
        setFillProgress((i + 0.15) / keys.length);

        if (key === 'severidad') {
          current = { ...current, severidad: value as FindingFormValues['severidad'] };
          setDisplayForm({ ...current });
          await sleep(280);
        } else if (key === 'componentes_afectados') {
          current = { ...current, componentes_afectados: value as string[] };
          setDisplayForm({ ...current });
          await sleep(320);
        } else if (typeof value === 'string') {
          const useTw = value.length <= 120;
          if (useTw) {
            await typewriterReveal(value, (partial) => {
              setDisplayForm((prev) => ({ ...prev, [key]: partial }));
            }, 900);
            current = { ...current, [key]: value };
          } else {
            setDisplayForm((prev) => ({ ...prev, [key]: '' }));
            await sleep(180);
            current = { ...current, [key]: value };
            setDisplayForm({ ...current });
            await sleep(280);
          }
        }

        setAiSuggested((prev) => new Set([...prev, key]));
        setFillProgress((i + 1) / keys.length);
        setAnimatingField(null);
        await sleep(80);
      }

      setDisplayForm(target);
      setAnimatingField(null);
      setCurrentFieldLabel(null);
      setFillProgress(1);
      setIsFilling(false);
      return target;
    },
    []
  );

  return {
    displayForm,
    setDisplayForm,
    animatingField,
    aiSuggested,
    isFilling,
    fillProgress,
    currentFieldLabel,
    animateFill,
    animateSingleField,
    markFieldSuggested,
    resetAiState,
    fieldHasValue,
  };
}

export { AI_FILL_ORDER };
