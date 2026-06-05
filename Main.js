// Script principal pour l'interactivité du site
import { db, storage, auth } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const SHEETDB_URL = import.meta.env.VITE_SHEETDB_URL;

// Helper to hash string for security
async function hashString(str) {
  if (!str) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// XSS Prevention
function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// MOBILE MENU
function openMobile() {
  document.getElementById('mobileMenu').classList.add('open');
}
function closeMobile() {
  document.getElementById('mobileMenu').classList.remove('open');
}

// SCROLL — NAV STYLE
window.addEventListener('scroll', () => {
  const nav = document.getElementById('mainNav');
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 60);
});

// LOGO 3D
function initLogo3D() {
  const wrapper = document.querySelector('.hero-logo-3d-wrapper');
  if (!wrapper) return;
  const img = wrapper.querySelector('img');
  if (!img) return;

  let curX = 0, curY = 0, tgtX = 0, tgtY = 0;

  wrapper.addEventListener('mousemove', (e) => {
    const r = wrapper.getBoundingClientRect();
    tgtX = ((e.clientY - r.top  - r.height / 2) / (r.height / 2)) * -22;
    tgtY = ((e.clientX - r.left - r.width  / 2) / (r.width  / 2)) *  22;
  });
  wrapper.addEventListener('mouseleave', () => { tgtX = 0; tgtY = 0; });

  (function tick() {
    curX += (tgtX - curX) * 0.1;
    curY += (tgtY - curY) * 0.1;
    img.style.transform = `perspective(600px) rotateX(${curX}deg) rotateY(${curY}deg)`;
    requestAnimationFrame(tick);
  })();
}

// LIQUID GLASS
function initLiquidBg() {
  const orbs = document.querySelectorAll('.liquid-orb');
  if (!orbs.length) return;
  document.addEventListener('mousemove', (e) => {
    const mx = (e.clientX / window.innerWidth - 0.5) * 2;
    const my = (e.clientY / window.innerHeight - 0.5) * 2;
    orbs.forEach((orb, i) => {
      const factor = (i + 1) * 8;
      orb.style.transform = `translate(${mx * factor}px, ${my * factor}px)`;
    });
  });
}

// REVEAL
function observeReveal() {
  const els = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });
  els.forEach(el => io.observe(el));
}

// COUNTERS
function startCounters() {
  document.querySelectorAll('.counter').forEach(el => {
    const target = parseInt(el.dataset.target);
    let current = 0;
    const step = Math.max(1, Math.floor(target / 60));
    const interval = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current >= 1000 ? (current / 1000).toFixed(1) + 'k+' : current + '+';
      if (current >= target) clearInterval(interval);
    }, 30);
  });
}

// NAVIGATION
function navigate(page) {
  if (page === 'admin' && !sessionStorage.getItem('amc_admin_session')) {
    page = 'admin-login';
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
  
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  observeReveal();
  if (page === 'admin') adminRefresh();
  if (page === 'partenaires') loadArtistes();
}

// ═══════════════════════════════════════════════════════════
//  ADHÉSIONS
// ═══════════════════════════════════════════════════════════
async function submitAdhesion() {
  const nom    = document.getElementById('nom')?.value?.trim();
  const email  = document.getElementById('email')?.value?.trim();
  const profil = document.getElementById('profil')?.value;
  const tel    = document.getElementById('tel')?.value?.trim();
  const ville  = document.getElementById('ville')?.value?.trim();
  const dob    = document.getElementById('dateNaissance')?.value;
  const msg    = document.getElementById('message')?.value?.trim();
  const rgpd   = document.getElementById('rgpd')?.checked;

  if (!nom || !email || !profil || !rgpd) {
    alert('Merci de remplir tous les champs obligatoires.');
    return;
  }

  const adherentData = {
    dateInscription: new Date().toLocaleDateString('fr-FR'),
    createdAt: serverTimestamp ? serverTimestamp() : new Date(),
    nom, email, tel: tel || '—', ville: ville || '—', dateNaissance: dob || '—',
    profil, message: msg || 'Aucun message', statut: 'En attente de paiement'
  };

  const btn = document.querySelector('.form-submit .btn-primary');
  const originalText = btn.textContent;
  btn.textContent = 'Envoi en cours...';
  btn.disabled = true;

  try {
    if (import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_API_KEY !== 'votre_api_key') {
      await addDoc(collection(db, "adherents"), adherentData);
    } else {
      await fetch(SHEETDB_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: adherentData })
      });
    }

    document.getElementById('adhesionForm').style.display = 'none';
    document.getElementById('adhesionSuccess').style.display = 'block';
    setTimeout(() => { navigate('paiement'); }, 3000);

  } catch (error) {
    console.error(error);
    alert("Erreur d'envoi. Veuillez réessayer.");
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════
//  ADMIN CMS LOGIC
// ═══════════════════════════════════════════════════════════
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
const ADMIN_HASH  = import.meta.env.VITE_ADMIN_HASH;

async function adminLogin() {
  const email = document.getElementById('adminEmail')?.value?.trim();
  const pwd   = document.getElementById('adminPassword')?.value;
  const pwdHash = await hashString(pwd);

  if (email === ADMIN_EMAIL && pwdHash === ADMIN_HASH) {
    sessionStorage.setItem('amc_admin_session', '1');
    navigate('admin');
  } else {
    alert("Identifiants incorrects.");
  }
}

function adminLogout() {
  sessionStorage.removeItem('amc_admin_session');
  navigate('accueil');
}

async function adminRefresh() {
  const tbody = document.getElementById('adminTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Chargement...</td></tr>';

  try {
    let list = [];
    if (import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_API_KEY !== 'votre_api_key') {
      const q = query(collection(db, "adherents"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    } else {
      const res = await fetch(SHEETDB_URL);
      list = await res.json();
      if(Array.isArray(list)) list = list.reverse();
    }

    document.getElementById('admin-stat-total').textContent = list.length;

    tbody.innerHTML = list.map(a => `
      <tr>
        <td>${escHtml(a.nom)}</td>
        <td>${escHtml(a.profil)}</td>
        <td><span class="admin-badge ${a.statut === 'En attente de paiement' ? 'pending' : 'active'}">${escHtml(a.statut)}</span></td>
        <td style="text-align:right;">
          <button onclick="deleteMember('${escHtml(a.id || a.email)}')" style="background:none; border:none; color:#e55; cursor:pointer;">🗑️</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6">Erreur BDD</td></tr>';
  }
}

async function deleteMember(id) {
  if (!confirm("Supprimer ce membre ?")) return;
  try {
    if (import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_API_KEY !== 'votre_api_key') {
      await deleteDoc(doc(db, "adherents", id));
    } else {
      await fetch(`${SHEETDB_URL}/email/${encodeURIComponent(id)}`, { method: 'DELETE' });
    }
    adminRefresh();
  } catch (e) { alert("Erreur."); }
}

function switchAdminTab(tabId, btn) {
  document.querySelectorAll('.admin-cms-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-cms-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tabId)?.classList.add('active');
  btn?.classList.add('active');
  if (tabId === 'members') adminRefresh();
  if (tabId === 'artistes') loadArtistes();
}

async function cmsAddArtiste() {
  const name = document.getElementById('cms-art-name')?.value;
  const job  = document.getElementById('cms-art-job')?.value;
  const bio  = document.getElementById('cms-art-bio')?.value;
  const file = document.getElementById('cms-art-img')?.files[0];
  if (!name || !job) return alert("Nom et Job requis.");

  try {
    let url = "logo.png";
    if (file) {
      try {
        const sRef = ref(storage, `artistes/${Date.now()}_${file.name}`);
        const snap = await uploadBytes(sRef, file);
        url = await getDownloadURL(snap.ref);
      } catch (e) { console.warn("Storage non configuré."); }
    }
    await addDoc(collection(db, "artistes"), { name, job, bio, imageUrl: url, createdAt: serverTimestamp() });
    alert("Artiste ajouté !");
    loadArtistes();
  } catch (error) { alert("Erreur Firebase."); }
}

async function loadArtistes() {
  const container = document.getElementById('cms-artistes-container');
  if (!container) return;
  try {
    const q = query(collection(db, "artistes"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    if (snap.empty) return container.innerHTML = '<p style="color:var(--muted); text-align:center; grid-column:1/-1;">Aucun artiste pour le moment.</p>';
    container.innerHTML = snap.docs.map(d => {
      const art = d.data();
      return `<div class="artiste-card reveal visible"><div class="artiste-img"><img src="${escHtml(art.imageUrl || 'logo.png')}"><div class="artiste-overlay"></div></div><div class="artiste-body"><h3>${escHtml(art.name)}</h3><p class="artiste-discipline">${escHtml(art.job)}</p><p class="artiste-bio">${escHtml(art.bio)}</p></div></div>`;
    }).join('');
  } catch (e) { container.innerHTML = '<p>Erreur lors du chargement des artistes.</p>'; }
}

function exportCSV() {
  // Simple localStorage/Mock export for now, but linked to the actual data if needed
  alert("Export CSV en cours de génération (Admin uniquement)...");
}

// ═══════════════════════════════════════════════════════════
//  PAYPAL
// ═══════════════════════════════════════════════════════════
function initPayPal() {
  if (!window.paypal) { console.warn("PayPal SDK non chargé."); return; }
  
  // DONATIONS
  const donBox = document.getElementById('paypal-button-container-don');
  if (donBox && !donBox.firstChild) {
    window.paypal.Buttons({
      style: { shape: 'rect', color: 'gold', layout: 'vertical' },
      createOrder: (data, actions) => {
        const val = document.getElementById('customMontant')?.value || window.selectedMontant || 50;
        return actions.order.create({ purchase_units: [{ amount: { currency_code: "EUR", value: val.toString() } }] });
      },
      onApprove: (data, actions) => actions.order.capture().then(d => { alert('Merci pour votre don !'); navigate('accueil'); })
    }).render('#paypal-button-container-don');
  }

  // ADHESIONS
  const adhBox = document.getElementById('paypal-button-container-adhesion');
  if (adhBox && !adhBox.firstChild) {
    window.paypal.Buttons({
      style: { shape: 'rect', color: 'gold', layout: 'vertical' },
      createOrder: (data, actions) => {
        return actions.order.create({ purchase_units: [{ amount: { currency_code: "EUR", value: "30.00" } }] });
      },
      onApprove: (data, actions) => actions.order.capture().then(d => { alert('Adhésion confirmée !'); navigate('accueil'); })
    }).render('#paypal-button-container-adhesion');
  }

  // FESTIVAL
  const festBox = document.getElementById('paypal-button-container-festival');
  if (festBox && !festBox.firstChild) {
    window.paypal.Buttons({
      style: { shape: 'rect', color: 'gold', layout: 'vertical' },
      createOrder: (data, actions) => {
        const val = document.getElementById('fest-pass')?.value || "0";
        if (val === "0") { alert("Réservation gratuite."); return; }
        return actions.order.create({ purchase_units: [{ amount: { currency_code: "EUR", value: val } }] });
      },
      onApprove: (data, actions) => actions.order.capture().then(d => { alert('Réservation confirmée !'); navigate('accueil'); })
    }).render('#paypal-button-container-festival');
  }
}

// ═══════════════════════════════════════════════════════════
//  FESTIVAL COUNTDOWN
// ═══════════════════════════════════════════════════════════
function initFestivalCountdown() {
  const target = new Date('July 11, 2026 10:00:00').getTime();
  const update = () => {
    const diff = target - new Date().getTime();
    if (diff <= 0) return;
    const d = document.getElementById('cd-days'), h = document.getElementById('cd-hours'), m = document.getElementById('cd-mins'), s = document.getElementById('cd-secs');
    if (d) d.textContent = String(Math.floor(diff / 86400000)).padStart(2, '0');
    if (h) h.textContent = String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0');
    if (m) m.textContent = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    if (s) s.textContent = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
  };
  setInterval(update, 1000); update();
}

// ═══════════════════════════════════════════════════════════
//  GALERIE — CATEGORIES FILTER
// ═══════════════════════════════════════════════════════════
function filterGalerie(cat, btn) {
  document.querySelectorAll('.galerie-cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.galerie-full-item').forEach(item => {
    item.style.opacity = '0';
    item.style.transform = 'scale(0.95)';
    setTimeout(() => {
      item.style.display = (cat === 'tous' || item.dataset.cat === cat) ? 'block' : 'none';
      if (item.style.display !== 'none') {
        setTimeout(() => {
          item.style.opacity = '1';
          item.style.transform = 'scale(1)';
          item.style.transition = 'opacity .3s, transform .3s';
        }, 20);
      }
    }, 150);
  });
}

// ═══════════════════════════════════════════════════════════
//  UTILS & EXPOSURE
// ═══════════════════════════════════════════════════════════
window.navigate = navigate;
window.adminLogin = adminLogin;
window.adminLogout = adminLogout;
window.adminRefresh = adminRefresh;
window.deleteMember = deleteMember;
window.switchAdminTab = switchAdminTab;
window.cmsAddArtiste = cmsAddArtiste;
window.submitAdhesion = submitAdhesion;
window.exportCSV = exportCSV;
window.filterGalerie = filterGalerie;
window.toggleTheme = () => {
  const isLight = document.body.classList.toggle('light-theme');
  localStorage.setItem('amc_theme', isLight ? 'light' : 'dark');
};
window.openMobile = openMobile;
window.closeMobile = closeMobile;
window.openFestivalModal = () => { const m = document.getElementById('festivalModal'); if (m) m.style.display = 'block'; };
window.closeFestivalModal = () => { const m = document.getElementById('festivalModal'); if (m) m.style.display = 'none'; };
window.openLightbox = (el) => {
  const lb = document.getElementById('lightbox'), img = document.getElementById('lightboxImg'), cap = document.getElementById('lightboxCaption');
  if (!lb || !img) return;
  const src = el.tagName === 'IMG' ? el : el.querySelector('img');
  img.src = src.src; if (cap) cap.textContent = src.alt;
  lb.style.display = 'flex'; document.body.style.overflow = 'hidden';
};
window.closeLightbox = () => { document.getElementById('lightbox').style.display = 'none'; document.body.style.overflow = ''; };

let selectedMontant = 50;
window.selectMontant = (btn, val) => {
  document.querySelectorAll('.montant-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window.selectedMontant = val;
};

document.addEventListener('DOMContentLoaded', () => {
  initLogo3D(); initLiquidBg(); observeReveal(); initFestivalCountdown();
  setTimeout(initPayPal, 2000);
  if (localStorage.getItem('amc_theme') === 'light') document.body.classList.add('light-theme');
});
