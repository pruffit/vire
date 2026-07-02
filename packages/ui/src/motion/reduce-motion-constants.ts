// Серверно-безопасные константы (без React-хуков) — layout импортирует
// REDUCE_MOTION_INIT_SCRIPT как обычную строку в Server Component. Хуки живут
// отдельно в reduce-motion.ts ('use client').

export const REDUCE_MOTION_STORAGE_KEY = 'vire-reduce-motion';
export const REDUCE_MOTION_CHANGE_EVENT = 'vire-reduce-motion-change';
export const REDUCE_MOTION_CLASS = 'vire-reduce-motion';

/**
 * Инлайн-скрипт для первого пейнта: ставит класс на <html> ДО гидрации, чтобы
 * CSS-keyframe-анимации (`animate-fade-up` и пр.) не мигнули у выбравших
 * приглушение движения.
 */
export const REDUCE_MOTION_INIT_SCRIPT =
  `try{if(localStorage.getItem('${REDUCE_MOTION_STORAGE_KEY}')==='1')document.documentElement.classList.add('${REDUCE_MOTION_CLASS}')}catch(e){}`;
