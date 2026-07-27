# UI/UX принципы VireMusic

Живой документ. Обновляется при добавлении новых паттернов.

---

## Философия

**75% Apple, 25% Teenage Engineering.**

Apple даёт жидкую органику, ощущение дороговизны и пространственную логику — вещи приходят откуда-то и уходят куда-то, у всего есть вес и траектория. Teenage Engineering добавляет пиксельную дисциплину, утилитарность и характер — спасает от превращения в безликий корпоративный шаблон.

---

## Движение

### Словарь пружин (`packages/ui/src/motion/tokens.ts`)

| Токен | stiffness / damping / mass | Применение |
|---|---|---|
| `spring.snappy` | 380 / 30 / 0.8 | Тактильный отклик: тапы, нажатия кнопок, toggle |
| `spring.smooth` | 300 / 32 / 0.9 | Layout-переходы, expand плеера, морфинг состояний |
| `spring.gentle` | 170 / 24 / 1 | Появления, scroll-reveal, мягкие входы |

### Правила

- **Никакого bounce/elastic** — устарело, привлекает внимание к анимации, а не к контенту
- **Easing**: только `ease-out-*` (deceleration) для входов; `cubic-bezier(0.22, 1, 0.36, 1)` = `--ease-soft` = `ease.soft` в токенах
- **Exit быстрее входа** — ~75% от времени входа
- **`prefers-reduced-motion`** — глобальное правило в `globals.css`: `0.01ms !important`. Каждая анимация работает без него.
- **Stagger** — только для одного уровня (карточки в сетке, строки в списке). Не применять ко всей странице секция за секцией.

### Приоритет бюджета анимации

1. Физический отклик кнопок (первый приоритет, везде)
2. Переходы состояний (open/close, like, follow)
3. Входы списков (stagger только когда контент появляется, не при каждой загрузке)
4. Пространственные переходы (shared-element, expand из точки)

---

## Компоненты взаимодействия

### Кнопки

`Button` из `@vire/ui` уже имеет:
- `whileTap={{ scale: 0.97 }}` + `whileHover={{ scale: 1.02 }}` через `spring.snappy`
- `active:scale-[0.97]` для `asChild` (Link-обёрток)

**Не добавлять** вручную `whileTap` поверх Button — двойное масштабирование.

Для кастомных кнопок вне Button: `whileTap={{ scale: 0.95, y: 1 }}` + `transition={spring.snappy}`.

### Optimistic UI

Правило по умолчанию: мутировать стейт немедленно, откатывать при ошибке fetch. Не делать `router.refresh()` для простого изменения состояния.

Уже оптимистичны: лайк, подписка, отписка, менеджер треков (rename/delete/reorder).

```ts
// Паттерн
function toggle() {
  const next = !state;
  setState(next);           // оптимистично
  startTransition(async () => {
    const res = await fetch(url, { method: next ? 'POST' : 'DELETE' });
    if (!res.ok) setState(!next); // откат
  });
}
```

### Shared-element переходы

Паттерн «компактное → богатое»: используем `layoutId` из `motion/react`.

```tsx
// Карточка
<motion.div layoutId={id} transition={spring.smooth}>
  <Image src={cover} ... />
</motion.div>

// Оверлей
<motion.div layoutId={id} transition={spring.smooth}>
  <Image src={cover} ... />
</motion.div>
```

Применено: обложки релизов (ReleaseQuickLook), обложки треков/релизов (ZoomableCover), фуллскрин плеер.

### Drag-dismiss

Для мобильных оверлеев — свайп вниз для закрытия:
```tsx
<motion.div
  drag="y"
  dragConstraints={{ top: 0, bottom: 0 }}
  dragElastic={{ top: 0, bottom: 0.6 }}
  onDragEnd={(_, info) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  }}
/>
```

---

## Цвет и токены

### Платформенная оболочка (`packages/ui/src/globals.css`)

OKLCH, тёплая подкраска (hue ~75, chroma ~0.006–0.009). Никакого pure gray.

| Токен | Значение | Назначение |
|---|---|---|
| `--background` | `oklch(0.085 0.006 75)` | Фон страниц |
| `--foreground` | `oklch(0.93 0.008 83)` | Основной текст (тёплый кремовый) |
| `--muted-foreground` | `oklch(0.57 0.009 80)` | Вторичный текст |
| `--card` | `oklch(0.115 0.006 75)` | Поверхность карточек |
| `--border` | `oklch(0.225 0.006 75)` | Бордеры |
| `--primary` | `oklch(0.93 0.008 83)` | CTA (инвертированный: тёплый кремовый на тёмном) |

### Темизация артиста

Страницы артиста инжектируют CSS-переменные из `artist_profiles.theme_tokens`:
```css
--artist-bg, --artist-text, --artist-accent
```
Компоненты пишутся через `bg-[var(--artist-bg)]`, `text-[var(--artist-accent)]`. Никаких форков кода.

### Запрещено

- `bg-[#0d0d0d]` — использовать `bg-background`
- `text-white` как базовый цвет — использовать `text-foreground`
- Gradient text (`background-clip: text`)
- Glassmorphism декоративно (blur только с функциональным смыслом: backdrop плеера, оверлей quick-look)
- Любой side-stripe border (`border-left` как акцент на карточках)

---

## Layout и скролл

### App-shell инвариант

```
body (h-full, overflow-hidden, flex flex-col)
  Nav                           — закреплён сверху
  div#main-content (flex-1, min-h-0, overflow-y-auto)  — ЕДИНСТВЕННАЯ скролл-область
    {children}
  Player                        — снизу, только когда играет
```

**Никогда** не добавлять `min-h-screen` или `h-screen` на страницах — это ломает app-shell и вызывает двойной скролл. Страницы используют `min-h-full` для растяжки фона. Инвариант защищён тестом `app/__tests__/layout-shell.test.ts`.

### Карточки

- Вложенные карточки — запрещены (Impeccable: «Nested cards are always wrong»)
- Карточка не обязательна — `overflow-hidden` + `rounded` + `bg-card` только когда реально нужна граница объекта
- Для рядов в списке: линия-разделитель или просто отступ, не карточка вокруг каждой строки

---

## Типографика

- Geist Sans (основной) + Geist Mono (данные: BPM, длительность, теги, индексы)
- Monospace — не для «dev-look», а для утилитарных данных (TE-принцип)
- Иерархия минимум 1.25× между уровнями
- `text-wrap: balance` на h1–h3
- Никаких all-caps на body text (только на коротких лейблах ≤4 слова)
- Em-dash запрещён (Impeccable) — заменять запятой, двоеточием или скобками

---

## Страницы dashboard vs публичные

| Область | Стиль | Принцип |
|---|---|---|
| Публичные (`/`, `/artists/*`, `/feed`) | Богатый, анимированный, фирменный | Бренд = продукт |
| Dashboard (`/dashboard/*`) | Функциональный, плотный | Дизайн служит задаче |
| Admin (`/admin/*`) | Максимально утилитарный | Скорость > красота |

Dashboard и Admin используют те же design tokens (не хардкоженный `#0d0d0d`) — разница только в плотности и уровне анимации.

---

## Пустые состояния и ошибки

- Пустые состояния объясняют интерфейс: «Нет релизов» + кнопка создания
- Никаких generic «Something went wrong» — конкретное сообщение
- Inline confirm вместо modal для деструктивных действий (Impeccable: «Modal as first thought. Modals are usually laziness»)
- Скелетон вместо spinner в центре контента

---

## Доступность

- `:focus-visible` — глобально настроен, кольцо `color-mix(foreground, 65%)`
- `aria-label` на иконках без видимого текста
- `prefers-reduced-motion` — нулевые анимации (`0.01ms`)
- Skip-link в `app/layout.tsx`
- Клавиши: `/` открывает поиск в nav, `⌘K` открывает палитру, `Esc` закрывает оверлеи
