# HabitLife Web (GitHub Pages + Supabase)

Фронтенд на GitHub Pages, профили и данные — в Supabase (Auth + Postgres + RLS).

## Почему так
GitHub Pages = статичный хостинг. Поэтому хранение данных/профилей делаем через BaaS.
Supabase даёт Auth + БД + RLS (каждый видит только свои строки).

## 1) Supabase
1) Создай проект
2) Auth → включи Email/Password
3) SQL Editor → выполни `supabase_schema.sql`

## 2) Запуск локально (macOS)
```bash
npm install
cp .env.example .env.local
# заполни ключи
npm run dev
```

`.env.local`:
- VITE_SUPABASE_URL=...
- VITE_SUPABASE_ANON_KEY=...

⚠️ service_role ключ НЕ вставлять во фронтенд.

## 3) GitHub Pages
- Залей репо
- Settings → Pages → Source: GitHub Actions
- Добавь в Repo → Settings → Secrets and variables → Actions → Variables:
  - VITE_SUPABASE_URL
  - VITE_SUPABASE_ANON_KEY

Workflow уже в `.github/workflows/deploy.yml`.
