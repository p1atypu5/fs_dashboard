# Разбор пачки WordPress REST API: 20 последних постов

Источник:

- API: `https://posledneeslovo.com/wp-json/wp/v2/posts?per_page=20&_embed=1`
- Сырые данные: `data/wp-samples/posts.latest-20.raw.json`
- Summary по полям: `data/wp-samples/posts.latest-20.summary.json`
- Summary по медиа: `data/wp-samples/posts.latest-20.media-summary.json`

## 1. Сравнение структуры 20 постов

Проверено 20 последних опубликованных постов.

Общие верхнеуровневые поля совпадают с одиночным примером:

- `id`;
- `date`;
- `modified`;
- `slug`;
- `status`;
- `type`;
- `link`;
- `title.rendered`;
- `content.rendered`;
- `excerpt.rendered`;
- `acf`;
- `categories`;
- `tags`;
- `years`;
- `_embedded.wp:term`;
- `yoast_head_json`.

Вывод: стандартный endpoint `wp/v2/posts?_embed=1` подходит как базовый источник импорта.

## 2. ACF-поля

Из 20 постов:

| field | заполнено |
| --- | ---: |
| `acf.opisanie_cheloveka` | 19 / 20 |
| `acf.opisanie_proczessa` | 20 / 20 |
| `acf.vremya_chteniya` | 20 / 20 |

Вывод:

- `opisanie_proczessa` и `vremya_chteniya` выглядят стабильными;
- `opisanie_cheloveka` нужно считать optional;
- сборка не должна падать, если `opisanie_cheloveka` пустое.

## 3. Фото и медиа

Из 20 постов:

| check | результат |
| --- | ---: |
| `featured_media` заполнен | 18 / 20 |
| `_embedded.wp:featuredmedia` есть | 18 / 20 |
| attachments через `wp/v2/media?parent=<postId>` есть | 17 / 20 |
| всего attachments | 32 |

Посты без `featured_media` и без attachments:

- `19397` / `shustanova-galina-aleksandrovna`;
- `19148` / `lazarev-dmitrij-konstantinovich`.

Вывод:

- основной источник фото: `featured_media` + `_embedded.wp:featuredmedia`;
- attachments можно использовать как дополнительный источник;
- фото должно быть optional.

## 4. Языки и переводы

В 20 постах не найдено явных верхнеуровневых полей:

- `language`;
- `translations`;
- `pll_*`;
- `wpml_*`;
- `hreflang`;
- `alternate`.

`yoast_head_json.og_locale` во всех 20 постах: `ru_RU`.

Запрос `wp-json/wp/v2/taxonomies` вернул HTTP 429 и HTML-челлендж Deflect, а не JSON.
Поэтому список всех публичных taxonomies пока нельзя считать надежно доступным через этот
endpoint.

Вывод:

- публичный REST API пока не дает готовой модели переводов;
- язык оригинала и связи переводов, скорее всего, придется вести локально;
- для переводов нужен наш `translationGroupId`;
- `language`, `originalLanguage`, `isOriginal` должны быть локальными полями в content layer.

## 5. HTML или Markdown

`content.rendered` приходит как WordPress HTML.

Решение для первой версии: сохранять HTML как исходный контент.

Почему:

- это минимально и надежно;
- не теряется форматирование Gutenberg-блоков;
- не нужно сразу решать все edge cases конвертации HTML в Markdown;
- можно быстрее собрать зеркало.

Позже можно добавить отдельный слой нормализации:

- чистка лишних классов WordPress;
- удаление пустых `<p>`;
- конвертация безопасного subset HTML в Markdown;
- извлечение даты, суда, города и источников из хвоста текста.

## 6. Черновая схема Astro Content Collection

Предлагаемая схема должна разделять поля из WordPress и локальные поля.

Поля из WordPress:

```ts
wordpressId: z.number(),
wpSlug: z.string(),
sourceUrl: z.string().url(),
publishedAt: z.string(),
modifiedAt: z.string(),
title: z.string(),
person: z.string(),
personDescription: z.string().optional(),
caseDescription: z.string().optional(),
readingTime: z.string().optional(),
country: z.string().optional(),
period: z.string().optional(),
tags: z.array(z.string()).default([]),
featuredImage: z
  .object({
    url: z.string().url(),
    alt: z.string().optional(),
  })
  .optional(),
```

Локальные поля:

```ts
localSlug: z.string(),
translationGroupId: z.string(),
language: z.string(),
originalLanguage: z.string(),
isOriginal: z.boolean(),
court: z.string().optional(),
city: z.string().optional(),
statementDate: z.string().optional(),
relatedWordIds: z.array(z.number()).default([]),
```

Важно:

- `wordpressId` обязателен для связи с WordPress;
- `localSlug` отвечает за локальный URL;
- `translationGroupId` обязателен, даже если переводов пока нет;
- `language` и `originalLanguage` нельзя надежно получить из текущей пачки API, поэтому на
  первом этапе их нужно задавать локально или дефолтить в импорт-скрипте.

## Практический вывод

Для первой версии достаточно:

1. Импортировать посты из `wp/v2/posts?_embed=1`.
2. Сохранять `content.rendered` как HTML.
3. Переносить ACF, taxonomies и featured media в frontmatter.
4. Считать фото, `personDescription`, суд, город, дату произнесения, язык и связи optional.
5. Добавить локальные поля для переводов и связей.
6. Валидировать все через Astro Content Collection.
