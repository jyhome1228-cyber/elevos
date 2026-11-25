// Public Firebase web application config only. Never put service account keys here.
window.ELEVOS_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAWGgjPvJaSaiM5fTjjX9galYzS1NjrLbY",
  authDomain: "elevos-d5d69.firebaseapp.com",
  projectId: "elevos-d5d69",
  storageBucket: "elevos-d5d69.firebasestorage.app",
  messagingSenderId: "954318876623",
  appId: "1:954318876623:web:34b2fd94baeb632e152cba"
};

// Public-site daily unique browser count. Never affects game or authentication.
if (/^\/(?:home|about|guide|events|hall|notice|community|studio|login|register)\.html$/.test(location.pathname) || location.pathname === '/') {
  (async () => {
    try {
      const date = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
      const part = type => date.find(p=>p.type===type).value;
      const day = part('year')+'-'+part('month')+'-'+part('day');
      if (localStorage.getItem('elevos-visitor-day') === day) return;
      let id = localStorage.getItem('elevos-visitor-id');
      if (!/^[a-f0-9]{32}$/.test(id||'')) {
        id = Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
        localStorage.setItem('elevos-visitor-id',id);
      }
      const [app,store] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js')
      ]);
      const db = store.getFirestore(app.initializeApp(window.ELEVOS_FIREBASE_CONFIG));
      await store.setDoc(store.doc(db,'siteVisitors',day+'_'+id),{createdAt:store.serverTimestamp()});
      localStorage.setItem('elevos-visitor-day',day);
    } catch (_) { /* Analytics must not interrupt visitors. */ }
  })();
}
