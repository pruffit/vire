# icons/brand-glyph

Компактные **квадратные** глифы-логотипы площадок (только знак, без текста-вордмарка)
для мелких строк редактора ссылок (дашборд: профиль, смартлинк-форма).

- Вордмарки (полные лого с названием) живут в `icons/social` и `icons/streaming`
  и используются на **лендингах смартлинков** — их НЕ трогаем.
- Сюда кладём именно компактные знаки. Имя файла = ключ бренда (см. список ниже),
  lowercase, kebab-case, `.svg`. Квадратный `viewBox` (например `0 0 24 24`).
  Цвет — на усмотрение (рендерятся на белом боксе).

После добавления файлов:

```
node scripts/build-icons.mjs   # или: pnpm icons:build
```

Имена файлов (по ключам площадок):
spotify, apple-music, youtube-music, youtube, yandex-music, vk-music, vk, zvuk,
soundcloud, bandcamp, deezer, tidal, amazon-music, bandlab, telegram, instagram,
tiktok, x, facebook, bluesky, discord, twitch, bandsintown
