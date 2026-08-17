export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="card max-w-sm space-y-3">
        <div className="text-4xl">📡</div>
        <div className="font-bold text-lg">אין חיבור לאינטרנט</div>
        <div className="text-sm text-slate-600">התרגילים נבנים ונבדקים בשרת, אז צריך חיבור. כשיהיה – רענני את הדף.</div>
        <a href="/" className="btn-primary inline-block">נסי שוב</a>
      </div>
    </main>
  );
}
