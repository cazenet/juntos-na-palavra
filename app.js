import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, getDocs, addDoc, orderBy, limit, updateDoc, where, query } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

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
const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');
const setMessage = (id, message, error=false) => { $(id).textContent = message; $(id).classList.toggle('error', error); };
let currentUser = null, currentMember = null, plans = [], selectedPlan = null, selectedWeek = 0, completed = new Set();
const isAdmin = () => currentUser && (currentUser.email?.toLowerCase() === ADMIN_EMAIL || currentMember?.role === 'admin');

const NT_BOOKS = [
 ['Mateus',28],['Marcos',16],['Lucas',24],['João',21],['Atos',28],['Romanos',16],['1 Coríntios',16],['2 Coríntios',13],['Gálatas',6],['Efésios',6],['Filipenses',4],['Colossenses',4],['1 Tessalonicenses',5],['2 Tessalonicenses',3],['1 Timóteo',6],['2 Timóteo',4],['Tito',3],['Filemom',1],['Hebreus',13],['Tiago',5],['1 Pedro',5],['2 Pedro',3],['1 João',5],['2 João',1],['3 João',1],['Judas',1],['Apocalipse',22]
];

async function enterWithGoogle() {
  setMessage('auth-message', 'Abrindo o acesso do Google...');
  try { await signInWithPopup(auth, provider); }
  catch (error) { console.error(error); const messages = {'auth/popup-closed-by-user':'A janela de login foi fechada antes da conclusão.','auth/unauthorized-domain':'Este domínio ainda não está autorizado no Firebase Authentication.'}; setMessage('auth-message', messages[error.code] || `Não foi possível entrar (${error.code || 'erro'}). Tente novamente.`, true); }
}
async function ensureMember(user) {
  const ref = doc(db,'members',user.uid), snap = await getDoc(ref), primary = user.email?.toLowerCase() === ADMIN_EMAIL;
  if (!snap.exists()) {
    const data = {uid:user.uid,email:user.email||'',displayName:user.displayName||'Participante',photoURL:user.photoURL||'',status:primary?'approved':'pending',role:primary?'admin':'participant',createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
    await setDoc(ref,data); return data;
  }
  if (primary && (snap.data().role !== 'admin' || snap.data().status !== 'approved')) { await setDoc(ref,{status:'approved',role:'admin',updatedAt:serverTimestamp()},{merge:true}); return {...snap.data(),status:'approved',role:'admin'}; }
  return snap.data();
}
function showOnly(id) { ['welcome','pending','rejected','app-area'].forEach(hide); show(id); }
async function handleUser(user) {
  currentUser=user; currentMember=null;
  if (!user) { showOnly('welcome'); return; }
  showOnly('welcome'); setMessage('auth-message','Verificando sua autorização...');
  try {
    currentMember=await ensureMember(user);
    if (currentMember.status==='approved') {
      showOnly('app-area'); $('user-name').textContent=user.displayName||'Participante'; $('user-email').textContent=user.email||'';
      if (isAdmin()) { show('admin-tab'); await loadAdminLists(); } else hide('admin-tab');
      await loadPlans(); await loadSharedReflections();
    } else if (currentMember.status==='rejected') showOnly('rejected');
    else { showOnly('pending'); $('pending-email').textContent=user.email||''; }
  } catch(error) { console.error(error); showOnly('welcome'); setMessage('auth-message',`Não foi possível verificar seu acesso (${error.code||'erro'}). Confira as regras do Firestore.`,true); }
}
async function refreshAccess(){if(auth.currentUser) await handleUser(auth.currentUser);}
async function doLogout(){try{await signOut(auth);}catch(e){console.error(e);}}
function setupTabs(){document.querySelectorAll('nav [data-tab]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('nav [data-tab]').forEach(b=>b.classList.toggle('active',b===button));document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('hidden',p.id!==button.dataset.tab));}));}

async function loadAdminLists(){
 if(!isAdmin())return; const pending=$('pending-list'),approved=$('approved-list'); pending.textContent='Carregando...';approved.textContent='Carregando...';
 try{const all=await getDocs(collection(db,'members'));pending.replaceChildren();approved.replaceChildren();let pc=0,ac=0;
 all.forEach(memberDoc=>{const m=memberDoc.data(),row=document.createElement('div');row.className='person-row';const info=document.createElement('div'),name=document.createElement('b'),email=document.createElement('small');name.textContent=m.displayName||'Sem nome';email.textContent=m.email||'';info.append(name,email);row.append(info);
 if(m.status==='pending'){pc++;const actions=document.createElement('div');actions.className='actions';const a=document.createElement('button'),r=document.createElement('button');a.textContent='Aprovar';r.textContent='Rejeitar';r.className='secondary';a.onclick=()=>updateMemberStatus(memberDoc.id,'approved');r.onclick=()=>updateMemberStatus(memberDoc.id,'rejected');actions.append(a,r);row.append(actions);pending.append(row);}
 else if(m.status==='approved'){ac++;const role=document.createElement('small');role.textContent=m.role==='admin'?'Administrador':'Participante aprovado';row.append(role);approved.append(row);}});
 if(!pc)pending.textContent='Nenhuma solicitação pendente.';if(!ac)approved.textContent='Nenhum participante aprovado.';
 }catch(e){console.error(e);pending.textContent=`Erro ao carregar (${e.code||'erro'}).`;approved.textContent='Verifique as regras do Firestore.';}
}
async function updateMemberStatus(uid,status){try{await updateDoc(doc(db,'members',uid),{status,updatedAt:serverTimestamp()});await loadAdminLists();}catch(e){console.error(e);alert(`Não foi possível atualizar (${e.code||e.message||'erro'}).`);}}

function parseBookLines(value){return value.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{const parts=line.split(':');const name=parts[0]?.trim(),chapters=Number(parts[1]);if(!name||!Number.isInteger(chapters)||chapters<1||chapters>150)throw new Error(`Linha inválida: "${line}". Use Livro: número de capítulos.`);return {name,chapters};});}
function buildChapterList(bookCounts){const list=[];bookCounts.forEach(book=>{for(let n=1;n<=book.chapters;n++)list.push({book:book.name,chapter:n});});return list;}
function formatDate(date){return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(date);}
function weekRange(startDate,index){const start=new Date(`${startDate}T12:00:00Z`);start.setUTCDate(start.getUTCDate()+index*7);const end=new Date(start);end.setUTCDate(end.getUTCDate()+6);return `${formatDate(start)} a ${formatDate(end)}`;}
async function loadPlans(){
 const target=$('plans-list');target.textContent='Carregando planos...';
 try{const snap=await getDocs(collection(db,'plans'));plans=snap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.active!==false).sort((a,b)=>(a.startDate||'').localeCompare(b.startDate||''));
  target.replaceChildren();if(!plans.length){target.textContent='Ainda não há planos de leitura cadastrados.';return;}
  plans.forEach(p=>{const b=document.createElement('button');b.className='plan-choice'+(selectedPlan?.id===p.id?' active':'');b.textContent=p.title;b.onclick=()=>selectPlan(p);target.append(b);});
  if(!selectedPlan||!plans.some(p=>p.id===selectedPlan.id))await selectPlan(plans[0]);else await selectPlan(plans.find(p=>p.id===selectedPlan.id));
 }catch(e){console.error(e);target.textContent=`Não foi possível carregar os planos (${e.code||'erro'}).`;$('reading-detail').textContent='Confira as regras do Firestore.';}
}
async function selectPlan(plan){selectedPlan=plan;selectedWeek=0;completed=new Set();document.querySelectorAll('.plan-choice').forEach(b=>b.classList.toggle('active',b.textContent===plan.title));
 try{const snap=await getDoc(doc(db,'plans',plan.id,'progress',currentUser.uid));if(snap.exists())completed=new Set(snap.data().completed||[]);}catch(e){console.error(e);}
 renderPlan();
}
function renderPlan(){
 const p=selectedPlan;if(!p)return;const chapters=buildChapterList(p.bookCounts||[]),perWeek=Math.max(1,Number(p.chaptersPerWeek)||3),totalWeeks=Math.ceil(chapters.length/perWeek);selectedWeek=Math.min(selectedWeek,Math.max(0,totalWeeks-1));
 $('reading-title').textContent=p.title;$('reading-description').textContent=p.description||'';$('reading-meta').textContent=`${perWeek} capítulos por semana · ${totalWeeks} semanas · início ${formatDate(new Date(`${p.startDate}T12:00:00Z`))}`;
 $('week-label').textContent=`Semana ${String(selectedWeek+1).padStart(2,'0')} · ${weekRange(p.startDate,selectedWeek)}`;
 const items=chapters.slice(selectedWeek*perWeek,(selectedWeek+1)*perWeek),list=$('chapter-list');list.replaceChildren();
 if(!items.length){list.textContent='Não há capítulos nesta semana.';return;}
 items.forEach(item=>{const key=`${item.book}|${item.chapter}`,label=document.createElement('label'),cb=document.createElement('input'),txt=document.createElement('span');cb.type='checkbox';cb.checked=completed.has(key);txt.textContent=`${item.book} ${item.chapter}`;if(cb.checked)txt.className='done';cb.addEventListener('change',()=>toggleChapter(key,cb.checked));label.append(cb,txt);list.append(label);});
 const done=completed.size,total=chapters.length;$('progress-label').textContent=`${done} de ${total} capítulos concluídos`; $('progress-bar').style.width=`${total?Math.min(100,done/total*100):0}%`;
 $('week-prev').disabled=selectedWeek===0;$('week-next').disabled=selectedWeek>=totalWeeks-1;
}
async function toggleChapter(key,checked){if(checked)completed.add(key);else completed.delete(key);renderPlan();try{await setDoc(doc(db,'plans',selectedPlan.id,'progress',currentUser.uid),{uid:currentUser.uid,completed:[...completed],updatedAt:serverTimestamp()},{merge:true});}catch(e){console.error(e);alert(`Não foi possível salvar seu progresso (${e.code||'erro'}).`);}}
async function createPlan(event){event.preventDefault();if(!isAdmin())return;const btn=$('create-plan');btn.disabled=true;setMessage('plan-message','Salvando plano...');
 try{const bookCounts=parseBookLines($('plan-books').value);if(!bookCounts.length)throw new Error('Informe ao menos um livro e sua quantidade de capítulos.');const startDate=$('plan-start').value;if(!startDate)throw new Error('Informe a data de início.');const chaptersPerWeek=Number($('plan-rate').value);if(!Number.isInteger(chaptersPerWeek)||chaptersPerWeek<1||chaptersPerWeek>30)throw new Error('Informe de 1 a 30 capítulos por semana.');
 const data={title:$('plan-title').value.trim(),description:$('plan-description').value.trim(),startDate,chaptersPerWeek,bookCounts,active:true,createdBy:currentUser.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()};if(!data.title)throw new Error('Informe o nome do plano.');await addDoc(collection(db,'plans'),data);setMessage('plan-message','Plano criado com sucesso!');$('create-plan-form').reset();$('plan-rate').value='3';await loadPlans();
 }catch(e){console.error(e);setMessage('plan-message',e.message||`Não foi possível criar (${e.code||'erro'}).`,true);}finally{btn.disabled=false;}}
function fillNTTemplate(){ $('plan-title').value='Novo Testamento 2027';$('plan-description').value='Uma caminhada pelo Novo Testamento, de Mateus a Apocalipse. Três capítulos por semana, no ritmo de cada participante.';$('plan-start').value='2027-01-11';$('plan-rate').value='3';$('plan-books').value=NT_BOOKS.map(([n,c])=>`${n}: ${c}`).join('\n'); }
$('plan-template').addEventListener('click',fillNTTemplate);
$('create-plan-form').addEventListener('submit',createPlan);
$('week-prev').addEventListener('click',()=>{selectedWeek=Math.max(0,selectedWeek-1);renderPlan();});$('week-next').addEventListener('click',()=>{selectedWeek++;renderPlan();});

async function saveReflection(){const text=$('reflection').value.trim();if(!text){setMessage('reflection-message','Escreva sua reflexão antes de salvar.',true);return;}const visibility=document.querySelector('[name="privacy"]:checked').value;$('save').disabled=true;try{await addDoc(collection(db,'reflections'),{ownerUid:currentUser.uid,ownerName:currentUser.displayName||'Participante',text,visibility,planId:selectedPlan?.id||'',week:selectedWeek+1,createdAt:serverTimestamp()});$('reflection').value='';setMessage('reflection-message',visibility==='private'?'Reflexão privada salva com segurança.':'Reflexão compartilhada com os participantes aprovados.');await loadSharedReflections();}catch(e){console.error(e);setMessage('reflection-message',`Não foi possível salvar (${e.code||'erro'}).`,true);}finally{$('save').disabled=false;}}
async function loadSharedReflections(){const target=$('shared-reflections');target.textContent='Carregando reflexões...';try{const q=query(collection(db,'reflections'),where('visibility','==','shared'),orderBy('createdAt','desc'),limit(30));const results=await getDocs(q);target.replaceChildren();const shared=results.docs.map(d=>d.data());if(!shared.length){target.textContent='Ainda não há reflexões compartilhadas.';return;}shared.forEach(data=>{const card=document.createElement('article');card.className='reflection-card';const author=document.createElement('b'),body=document.createElement('p');author.textContent=data.ownerName||'Participante';body.textContent=data.text||'';card.append(author,body);target.append(card);});}catch(e){console.error(e);target.textContent=`Não foi possível carregar as reflexões (${e.code||'erro'}).`;}}

$('login').addEventListener('click',enterWithGoogle);$('logout').addEventListener('click',doLogout);$('pending-logout').addEventListener('click',doLogout);$('rejected-logout').addEventListener('click',doLogout);$('pending-refresh').addEventListener('click',refreshAccess);$('save').addEventListener('click',saveReflection);setupTabs();onAuthStateChanged(auth,handleUser);
