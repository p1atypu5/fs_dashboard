# Последнее слово: dashboard

Статичное readonly-зеркало материалов сайта “Последнее слово” для GitHub Pages.

Репозиторий содержит только то, что нужно для сборки публичного сайта:

- Astro-приложение в `src/`
- контентные Markdown-файлы в `src/content/last-words/`
- зависимости и конфигурацию сборки

Локальные выгрузки WordPress, рабочие заметки и импортные скрипты не входят в публичный репозиторий.

## Команды

```sh
npm install
npm run dev
npm run build
npm run preview
```

Для GitHub Pages используется base path `/final-statement`, он задан в `astro.config.mjs`.
