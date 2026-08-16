# מכוונים גבוה – אפליקציית תרגול מתמטיקה לנגה

Next.js 16 + TypeScript + Tailwind + MathLive + KaTeX + Neon Postgres.

- `src/lib/math` – מנוע מתמטי: מחולל תרגילים (`generators.ts`), בודק שקילות/פתרונות (`check.ts`, `engine.ts`), פולינומים (`poly.ts`).
- `src/content/topics.ts` – עץ הנושאים, ההסברים בשפה של אבא, דוגמאות, סרטונים.
- `src/app/practice/[type]` – מסך התרגול המודרך (רמז מדורג, הצגת צעד, מקלדת מתמטית).
- `src/app/parent` – מסך הורה.

## הרצה מקומית
```
npm i
cp .env.example .env.local   # DATABASE_URL, PARENT_PIN
npm run dev
```
בלי DATABASE_URL הנתונים נשמרים בזיכרון בלבד.

## בדיקות
`npx vitest run`
