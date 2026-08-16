# העלאה לאוויר – 3 פקודות

הפרויקט ב-Vercel (**znk-noga**) כבר קיים, עם משתני הסביבה (DATABASE_URL של Neon, PARENT_PIN=110309@), והתיקייה הזאת כבר "מקושרת" אליו (`.vercel/project.json`).

בטרמינל, בתוך התיקייה:

```bash
npm install
npx vercel login          # פעם אחת – מתחברים עם המייל של Vercel (arannachmias@gmail.com)
npx vercel --prod         # מעלה ובונה. בסוף מקבלים כתובת https://znk-noga-....vercel.app
```

זהו. הכתובת עובדת מהטלפון של נגה ומהמחשב שלך.

## אופציה ב' – דרך GitHub
1. דחוף את התיקייה לריפו ב-GitHub שלך.
2. ב-Vercel → Project znk-noga → Settings → Git → Connect → בחר את הריפו. כל push יעלה גרסה חדשה.

## לשנות את קוד ההורה
Vercel → znk-noga → Settings → Environment Variables → PARENT_PIN → ואז Redeploy.

## הרצה מקומית
```bash
cp .env.example .env.local   # ומלא DATABASE_URL (יש לך אותו ב-Vercel) או השאר ריק לזיכרון בלבד
npm run dev
```
