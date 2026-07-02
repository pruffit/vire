'use client';

import { useSyncExternalStore } from 'react';
import { REDUCE_MOTION_STORAGE_KEY, REDUCE_MOTION_CHANGE_EVENT } from './reduce-motion-constants';

function getSnapshot(): boolean {
  return localStorage.getItem(REDUCE_MOTION_STORAGE_KEY) === '1';
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(REDUCE_MOTION_CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(REDUCE_MOTION_CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

/** Пользовательский тумблер «приглушить движение» (localStorage). SSR — false. */
export function useReduceMotionPref(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Пишет значение и оповещает подписчиков этой вкладки (`storage` покрывает другие). */
export function setReduceMotionPref(next: boolean): void {
  localStorage.setItem(REDUCE_MOTION_STORAGE_KEY, next ? '1' : '0');
  window.dispatchEvent(new CustomEvent(REDUCE_MOTION_CHANGE_EVENT, { detail: next }));
}
