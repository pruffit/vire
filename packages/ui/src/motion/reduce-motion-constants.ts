// Без React-хуков — layout импортирует REDUCE_MOTION_INIT_SCRIPT строкой в Server Component

export const REDUCE_MOTION_STORAGE_KEY = 'vire-reduce-motion';
export const REDUCE_MOTION_CHANGE_EVENT = 'vire-reduce-motion-change';
export const REDUCE_MOTION_CLASS = 'vire-reduce-motion';

// Ставит класс на <html> ДО гидрации, чтобы CSS-keyframe-анимации не мигнули на первом пейнте
export const REDUCE_MOTION_INIT_SCRIPT =
  `try{if(localStorage.getItem('${REDUCE_MOTION_STORAGE_KEY}')==='1')document.documentElement.classList.add('${REDUCE_MOTION_CLASS}')}catch(e){}`;
