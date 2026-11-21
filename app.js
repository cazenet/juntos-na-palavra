import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, addDoc, orderBy, limit, updateDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyATS5VOruDe2c_EVKuxErjR6ZKru_Y3NS8",
  authDomain: "juntos-na-palavra.firebaseapp.com",
  projectId: "juntos-na-palavra",
  storageBucket: "juntos-na-palavra.firebasestorage.app",
  messagingSenderId: "597988067497",
  appId: "1:597988067497:web:58321075d5034d5029c1b8"
};
const ADMIN_EMAIL = 'cazenet10@gmail.com';
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove('hidden');
const hide = (id) => $(id).classList.add('hidden');
const setMessage = (id, message, error=false) => { $(id).textContent = message; $(id).classList.toggle('error', error); };
let currentUser = null;

async function enterWithGoogle() {
  setMessage('auth-message', 'Abrindo o acesso do Google...');
  try { await signInWithPopup(auth, provider); }
  catch (error) {
    console.error(error);
    const messages = { 'auth/popup-closed-by-user':'A janela de login foi fechada antes da conclusão.', 'auth/unauthorized-domain':'Este domínio ainda não está autorizado no Firebase Authentication.' };
    setMessage('auth-message', messages[error.code] || `Não foi possível entrar (${error.code || 'erro'}). Tente novamente.`, true);
  }
}

async function ensureMember(user) {
  const ref = doc(db, 'members', user.uid);
  const snap = await getDoc(ref);
  const isPrimaryAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Participante',
      photoURL: user.photoURL || '',
      status: isPrimaryAdmin ? 'approved' : 'pending',
      role: isPrimaryAdmin ? 'admin' : 'participant',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { status: isPrimaryAdmin ? 'approved' : 'pending', role: isPrimaryAdmin ? 'admin' : 'participant' };
  }
  if (isPrimaryAdmin && (snap.data().role !== 'admin' || snap.data().status !== 'approved')) {
    await setDoc(ref, { status: 'approved', role: 'admin', updatedAt: serverTimestamp() }, { merge: true });
    return { ...snap.data(), status: 'approved', role: 'admin' };
  }
  return snap.data();
}

function showOnly(id) { ['welcome','pending','rejected','app-area'].forEach(x => hide(x)); show(id); }
async function handleUser(user) {
  currentUser = user;
  if (!user) { showOnly('welcome'); return; }
  showOnly('welcome');
  setMessage('auth-message', 'Verificando sua autorização...');
  try {
    const member = await ensureMember(user);
    if (member.status === 'approved') {
      showOnly('app-area');
      $('user-name').textContent = user.displayName || 'Participante';
      $('user-email').textContent = user.email || '';
      if (member.role === 'admin' || user.email?.toLowerCase() === ADMIN_EMAIL) {
        show('admin-tab');
        await loadAdminLists();
      } else hide('admin-tab');
      await loadSharedReflections();
    } else if (member.status === 'rejected') {
      showOnly('rejected');
    } else {
      showOnly('pending');
      $('pending-email').textContent = user.email || '';
    }
  } catch (error) {
    console.error(error);
    showOnly('welcome');
    setMessage('auth-message', `Não foi possível verificar seu acesso (${error.code || 'erro'}). Confira as regras do Firestore e tente novamente.`, true);
  }
}

async function refreshAccess() { if (auth.currentUser) await handleUser(auth.currentUser); }
async function doLogout() { try { await signOut(auth); } catch (e) { console.error(e); } }

function setupTabs() {
  document.querySelectorAll('nav [data-tab]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('nav [data-tab]').forEach(b => b.classList.toggle('active', b === button));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('hidden', p.id !== button.dataset.tab));
  }));
}

async function loadAdminLists() {
  if (!currentUser || currentUser.email?.toLowerCase() !== ADMIN_EMAIL) return;
  const pending = $('pending-list'); const approved = $('approved-list');
  pending.textContent = 'Carregando...'; approved.textContent = 'Carregando...';
  try {
    const all = await getDocs(collection(db, 'members'));
    pending.replaceChildren(); approved.replaceChildren();
    let pendingCount = 0, approvedCount = 0;
    all.forEach(memberDoc => {
      const m = memberDoc.data();
      const row = document.createElement('div'); row.className = 'person-row';
      const info = document.createElement('div');
      const name = document.createElement('b'); name.textContent = m.displayName || 'Sem nome';
      const email = document.createElement('small'); email.textContent = m.email || '';
      info.append(name, email); row.append(info);
      if (m.status === 'pending') {
        pendingCount++;
        const actions = document.createElement('div'); actions.className = 'actions';
        const approve = document.createElement('button'); approve.textContent = 'Aprovar'; approve.addEventListener('click', () => updateMemberStatus(memberDoc.id, 'approved'));
        const reject = document.createElement('button'); reject.textContent = 'Rejeitar'; reject.className = 'secondary'; reject.addEventListener('click', () => updateMemberStatus(memberDoc.id, 'rejected'));
        actions.append(approve, reject); row.append(actions); pending.append(row);
      } else if (m.status === 'approved') { approvedCount++; const role = document.createElement('small'); role.textContent = m.role === 'admin' ? 'Administrador' : 'Participante aprovado'; row.append(role); approved.append(row); }
    });
    if (!pendingCount) pending.textContent = 'Nenhuma solicitação pendente.';
    if (!approvedCount) approved.textContent = 'Nenhum participante aprovado.';
  } catch (error) { console.error(error); pending.textContent = `Erro ao carregar (${error.code || 'erro'}).`; approved.textContent = 'Verifique as regras do Firestore.'; }
}

async function updateMemberStatus(uid, status) {
  try {
    await updateDoc(doc(db, 'members', uid), { status, updatedAt: serverTimestamp() });
    await loadAdminLists();
  } catch (error) { console.error(error); alert(`Não foi possível atualizar (${error.code || error.message || 'erro'}).`); }
}

async function saveReflection() {
  const text = $('reflection').value.trim();
  if (!text) { setMessage('reflection-message', 'Escreva sua reflexão antes de salvar.', true); return; }
  const visibility = document.querySelector('[name="privacy"]:checked').value;
  $('save').disabled = true;
  try {
    await addDoc(collection(db, 'reflections'), { ownerUid: currentUser.uid, ownerName: currentUser.displayName || 'Participante', text, visibility, planId: 'novo-testamento-2027', week: 1, createdAt: serverTimestamp() });
    $('reflection').value = '';
    setMessage('reflection-message', visibility === 'private' ? 'Reflexão privada salva com segurança.' : 'Reflexão compartilhada com os participantes aprovados.');
    await loadSharedReflections();
  } catch (error) { console.error(error); setMessage('reflection-message', `Não foi possível salvar (${error.code || 'erro'}).`, true); }
  finally { $('save').disabled = false; }
}

async function loadSharedReflections() {
  const target = $('shared-reflections'); target.textContent = 'Carregando reflexões...';
  try {
    const q = query(collection(db, 'reflections'), where('visibility', '==', 'shared'), orderBy('createdAt', 'desc'), limit(30));
    const results = await getDocs(q); target.replaceChildren();
    if (results.empty) { target.textContent = 'Ainda não há reflexões compartilhadas.'; return; }
    results.forEach(item => { const data = item.data(); const card = document.createElement('article'); card.className = 'reflection-card'; const author = document.createElement('b'); author.textContent = data.ownerName || 'Participante'; const body = document.createElement('p'); body.textContent = data.text || ''; card.append(author, body); target.append(card); });
  } catch (error) { console.error(error); target.textContent = `Não foi possível carregar as reflexões (${error.code || 'erro'}).`; }
}

$('login').addEventListener('click', enterWithGoogle);
$('logout').addEventListener('click', doLogout); $('pending-logout').addEventListener('click', doLogout); $('rejected-logout').addEventListener('click', doLogout);
$('pending-refresh').addEventListener('click', refreshAccess); $('save').addEventListener('click', saveReflection);
setupTabs();
onAuthStateChanged(auth, handleUser);
