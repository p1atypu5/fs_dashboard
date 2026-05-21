# Последнее слово: dashboard

Статичное readonly-зеркало материалов сайта “Последнее слово” для GitHub Pages.

Репозиторий содержит только то, что нужно для сборки публичного сайта:

- Astro-приложение в `src/`
- контентные Markdown-файлы в `src/content/last-words/`
- минимальные скрипты импорта в `scripts/`
- зависимости и конфигурацию сборки

Локальные выгрузки WordPress не входят в публичный репозиторий.

## Команды

```sh
npm install
npm run dev
npm run build
npm run preview
npm run fetch:wp
npm run import:wp
```

## Обновление базы

GitHub Actions обновляет контент автоматически:

- ежедневно: incremental sync по `modified_after`
- раз в неделю: full sync с удалением локальных Markdown-файлов, которых больше нет среди опубликованных WordPress-постов
- вручную: workflow `Update WordPress content` можно запустить в режиме `incremental` или `full`

Сырые WordPress JSON сохраняются только во временный ignored-каталог `data/` и не коммитятся.

Дата последней синхронизации хранится в `src/data/wpExportMeta.json`. Главная страница считает
“Последние добавления за неделю” как 7 полных дней перед датой этой синхронизации.

Для GitHub Pages используется base path `/fs_dashboard`, он задан в `astro.config.mjs`.
