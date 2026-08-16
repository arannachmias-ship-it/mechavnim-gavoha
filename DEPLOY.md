# מכוונים גבוה – פריסה

האפליקציה חיה בכתובת **https://mechavnim-gavoha.vercel.app**

- פרויקט Vercel: `mechavnim-gavoha`
- מסד נתונים: Neon Postgres
- משתני סביבה: `DATABASE_URL`, `PARENT_PIN`

## להעלות גרסה חדשה מהמחשב
```bash
npm install
npx vercel login
npx vercel link      # בוחרים את הפרויקט mechavnim-gavoha
npx vercel --prod
```

## לשנות את קוד ההורה
Vercel -> mechavnim-gavoha -> Settings -> Environment Variables -> PARENT_PIN -> Redeploy.
