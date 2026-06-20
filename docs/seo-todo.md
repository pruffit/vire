# SEO / GEO — что осталось сделать

Чеклист по итогам аудита `seogeoaudit` (2026-06-20). Код-часть (OG-картинки,
favicon, canonical, sitemap, FAQ/Article-разметка) уже сделана в ветке
`claude/intelligent-carson-j2p463`. Ниже — то, что **нельзя сделать кодом** и
требует действий вручную.

## 🔴 Критично — индексация в Google

- [ ] Завести сайт в [Google Search Console](https://search.google.com/search-console).
- [ ] Способ верификации: HTML-tag → скопировать значение `content`.
- [ ] Прокинуть токен в прод как `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`
      (это build-time переменная — добавить в build-args Docker, по аналогии с
      `S3_PUBLIC_ENDPOINT` в `apps/web/Dockerfile` и `.github/workflows/deploy.yml`).
- [ ] После деплоя в GSC: отправить sitemap `https://viremusic.ru/sitemap.xml`.
- [ ] Запросить индексацию главной и нескольких страниц артистов («Проверка URL» → «Запросить индексирование»).

## 🟠 Проверка разметки после деплоя

- [ ] Прогнать главную, `/about`, страницу артиста, релиз и смартлинк через
      [validator.schema.org](https://validator.schema.org/) — убедиться, что
      WebSite, FAQPage, MusicGroup, MusicAlbum, Article распознаются без ошибок.
- [ ] Яндекс.Вебмастер → «Информация о сайте» → «Микроразметка» — проверить FAQ и Article.
- [ ] Проверить OG-картинку (дефолтную и по релизам) через
      [opengraph.xyz](https://www.opengraph.xyz/) или дебаггер VK/Telegram.

## 🟡 Favicon в выдаче

- [ ] Явные `<link rel="icon">` уже добавлены в код. Дождаться переобхода
      роботами; в Яндекс.Вебмастере можно ускорить через «Переобход страниц».

## 🟢 Контент и ранжирование (влияет на позиции, не на индексацию)

- [ ] Уникализировать шаблонные описания релизов (сейчас часть вида
      «Untouchable — релиз X на Vire») — живые тексты ранжируются лучше.
- [ ] Заполнить `bio` у артистов без описания (используется в meta description и JSON-LD).
- [ ] Запрос «vire» — короткий и высококонкурентный (vire.su, перевод и т.п.).
      Реалистичная цель — топ по «viremusic», «vire музыка», «vire площадка».
      Для продвижения по «vire»: внешние ссылки (соцсети артистов, каталоги),
      поведенческие факторы, возраст домена. Чисто SEO-настройками не решается.

## Справочно — что уже сделано кодом

- Дефолтная OG-картинка (`app/opengraph-image.tsx`) + fallback на страницах без своей.
- Явные иконки/favicon, canonical на главной, поддержка Google-верификации через env.
- Sitemap: добавлены треки, смартлинки, `/about`.
- Смартлинки: canonical + `MusicAlbum` JSON-LD.
- `/about`: видимый FAQ-блок + `FAQPage` JSON-LD (`lib/faq.ts` — единый источник).
- Посты артистов: `Article` JSON-LD + якоря `#post-{id}`.
