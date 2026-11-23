import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, getDocs, addDoc, orderBy, limit, updateDoc, deleteDoc, where, query } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

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
let currentUser = null, currentMember = null, plans = [], selectedPlan = null, selectedWeek = 0, completed = new Set(), meetingSettings = null;
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
      $('dashboard-greeting').textContent=`Olá, ${(user.displayName||'irmão').split(' ')[0]}!`; if(user.photoURL){$('dashboard-photo').src=user.photoURL;show('dashboard-photo');}
      await loadMeetingSettings(); await loadPlans(); await loadSharedReflections(); await loadDashboardLatest();
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
 try{const snap=await getDocs(collection(db,'plans'));plans=snap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.type!=='appSettings' && p.active!==false).sort((a,b)=>(a.startDate||'').localeCompare(b.startDate||''));
  target.replaceChildren();if(!plans.length){target.textContent='Ainda não há planos de leitura cadastrados.';renderDashboard();return;}
  plans.forEach(p=>{const b=document.createElement('button');b.className='plan-choice'+(selectedPlan?.id===p.id?' active':'');b.textContent=p.title;b.onclick=()=>selectPlan(p);target.append(b);});
  if(!selectedPlan||!plans.some(p=>p.id===selectedPlan.id))await selectPlan(plans[0]);else await selectPlan(plans.find(p=>p.id===selectedPlan.id));
 }catch(e){console.error(e);target.textContent=`Não foi possível carregar os planos (${e.code||'erro'}).`;$('reading-detail').textContent='Confira as regras do Firestore.';}
}
async function selectPlan(plan){selectedPlan=plan;selectedWeek=0;completed=new Set();document.querySelectorAll('.plan-choice').forEach(b=>b.classList.toggle('active',b.textContent===plan.title));
 try{const snap=await getDoc(doc(db,'plans',plan.id,'progress',currentUser.uid));if(snap.exists())completed=new Set(snap.data().completed||[]);}catch(e){console.error(e);}
 renderPlan();
}
function getWeekItems(plan=selectedPlan, week=selectedWeek){const chapters=buildChapterList(plan?.bookCounts||[]),perWeek=Math.max(1,Number(plan?.chaptersPerWeek)||3);return chapters.slice(week*perWeek,(week+1)*perWeek);}
function isWeekComplete(plan=selectedPlan, week=selectedWeek){const items=getWeekItems(plan,week);return items.length>0 && items.every(item=>completed.has(`${item.book}|${item.chapter}`));}
function renderPlan(){
 const p=selectedPlan;if(!p)return;const chapters=buildChapterList(p.bookCounts||[]),perWeek=Math.max(1,Number(p.chaptersPerWeek)||3),totalWeeks=Math.ceil(chapters.length/perWeek);selectedWeek=Math.min(selectedWeek,Math.max(0,totalWeeks-1));
 $('reading-title').textContent=p.title;$('reading-description').textContent=p.description||'';$('reading-meta').textContent=`${perWeek} capítulos por semana · ${totalWeeks} semanas · início ${formatDate(new Date(`${p.startDate}T12:00:00Z`))}`;
 $('week-label').textContent=`Semana ${String(selectedWeek+1).padStart(2,'0')} · ${weekRange(p.startDate,selectedWeek)}`;
 const items=chapters.slice(selectedWeek*perWeek,(selectedWeek+1)*perWeek),list=$('chapter-list');list.replaceChildren();
 if(!items.length){list.textContent='Não há capítulos nesta semana.';return;}
 items.forEach(item=>{const key=`${item.book}|${item.chapter}`,label=document.createElement('label'),cb=document.createElement('input'),txt=document.createElement('span');cb.type='checkbox';cb.checked=completed.has(key);txt.textContent=`${item.book} ${item.chapter}`;if(cb.checked)txt.className='done';cb.addEventListener('change',()=>toggleChapter(key,cb.checked));label.append(cb,txt);list.append(label);});
 const done=completed.size,total=chapters.length;$('progress-label').textContent=`${done} de ${total} capítulos concluídos`; $('progress-bar').style.width=`${total?Math.min(100,done/total*100):0}%`;
 $('week-prev').disabled=selectedWeek===0;const atLastWeek=selectedWeek>=totalWeeks-1,weekDone=isWeekComplete(p,selectedWeek);$('week-next').disabled=atLastWeek||!weekDone;$('week-next').title=(!atLastWeek&&!weekDone)?'Conclua todos os capítulos desta semana para avançar.':'';renderDashboard();
}
async function toggleChapter(key,checked){const before=new Set(completed);if(checked)completed.add(key);else completed.delete(key);renderPlan();try{await setDoc(doc(db,'plans',selectedPlan.id,'progress',currentUser.uid),{uid:currentUser.uid,completed:[...completed],updatedAt:serverTimestamp()},{merge:true});if(!isWeekComplete())setMessage('reflection-message','Conclua os três capítulos da semana para liberar sua reflexão.');}catch(e){completed=before;renderPlan();console.error(e);alert(`Não foi possível salvar seu progresso (${e.code||'erro'}).`);}}
const MEETING_DOC = '_app_settings';
function localISODate(date=new Date()){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}`;}
function renderDashboard(){
 if(!selectedPlan){$('dashboard-plan-title').textContent='Nenhum plano ativo';$('dashboard-week').textContent='Aguarde o administrador cadastrar um plano.';$('dashboard-progress-label').textContent='';$('dashboard-progress-bar').style.width='0%';return;}
 const chapters=buildChapterList(selectedPlan.bookCounts||[]),perWeek=Math.max(1,Number(selectedPlan.chaptersPerWeek)||3),totalWeeks=Math.ceil(chapters.length/perWeek),items=chapters.slice(selectedWeek*perWeek,(selectedWeek+1)*perWeek),doneWeek=items.filter(x=>completed.has(`${x.book}|${x.chapter}`)).length;
 $('dashboard-plan-title').textContent=selectedPlan.title;$('dashboard-week').textContent=`Semana ${selectedWeek+1} · ${weekRange(selectedPlan.startDate,selectedWeek)} · ${items.length} capítulos`;$('dashboard-progress-label').textContent=`${doneWeek} de ${items.length} capítulos desta semana concluídos`;$('dashboard-progress-bar').style.width=`${items.length?doneWeek/items.length*100:0}%`;
}
async function loadMeetingSettings(){
 try{const snap=await getDoc(doc(db,'plans',MEETING_DOC));meetingSettings=snap.exists()?snap.data():null;
  if(!meetingSettings){const next=new Date();const days=(5-next.getDay()+7)%7||7;next.setDate(next.getDate()+days);meetingSettings={date:localISODate(next),time:'20:00',title:'Casa do José Carlos e da Ilma',address:'Rua Dempachi Nakayama, 634 — Jardim Esperança, Barueri - SP'};}
  $('meeting-date').value=meetingSettings.date||'';$('meeting-time').value=meetingSettings.time||'20:00';$('meeting-title').value=meetingSettings.title||'';$('meeting-address').value=meetingSettings.address||'';renderMeeting();
 }catch(e){console.error(e);setMessage('meeting-message',`Não foi possível carregar o encontro (${e.code||'erro'}).`,true);}
}
function renderMeeting(){const m=meetingSettings||{};const date=m.date?new Date(`${m.date}T12:00:00`):null;$('meeting-date-display').textContent=date?`${new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long'}).format(date)} · ${m.time||'20:00'}`:`Sexta-feira · ${m.time||'20:00'}`;$('meeting-location-display').textContent=m.title||'Local a confirmar';$('meeting-address-display').textContent=m.address||'';}
async function saveMeeting(event){event.preventDefault();if(!isAdmin())return;const data={type:'appSettings',date:$('meeting-date').value,time:$('meeting-time').value,title:$('meeting-title').value.trim(),address:$('meeting-address').value.trim(),updatedAt:serverTimestamp(),updatedBy:currentUser.uid};if(!data.date||!data.time||!data.title||!data.address){setMessage('meeting-message','Preencha todos os campos.',true);return;}const btn=$('meeting-save');btn.disabled=true;try{await setDoc(doc(db,'plans',MEETING_DOC),data,{merge:true});meetingSettings=data;renderMeeting();setMessage('meeting-message','Informações do encontro atualizadas!');}catch(e){console.error(e);setMessage('meeting-message',`Não foi possível salvar (${e.code||'erro'}).`,true);}finally{btn.disabled=false;}}
async function loadDashboardLatest(){const target=$('dashboard-latest');try{const q=query(collection(db,'reflections'),where('visibility','==','shared'),orderBy('updatedAt','desc'),limit(3));const snap=await getDocs(q);target.replaceChildren();if(!snap.size){target.textContent='Ainda não há reflexões compartilhadas.';return;}snap.docs.forEach(d=>{const x=d.data(),card=document.createElement('article');card.className='latest-reflection';const author=document.createElement('b'),body=document.createElement('p');author.textContent=x.ownerName||'Participante';body.textContent=x.noticed||x.learned||x.application||'Compartilhou uma reflexão da caminhada.';card.append(author,body);target.append(card);});}catch(e){console.error(e);target.textContent='Não foi possível carregar as últimas reflexões.';}}
$('dashboard-continue').addEventListener('click',()=>document.querySelector('nav [data-tab="leitura"]').click());
$('dashboard-reflection').addEventListener('click',()=>document.querySelector('nav [data-tab="reflexoes"]').click());
$('dashboard-community').addEventListener('click',()=>document.querySelector('nav [data-tab="reflexoes"]').click());
$('meeting-form').addEventListener('submit',saveMeeting);

async function createPlan(event){event.preventDefault();if(!isAdmin())return;const btn=$('create-plan');btn.disabled=true;setMessage('plan-message','Salvando plano...');
 try{const bookCounts=parseBookLines($('plan-books').value);if(!bookCounts.length)throw new Error('Informe ao menos um livro e sua quantidade de capítulos.');const startDate=$('plan-start').value;if(!startDate)throw new Error('Informe a data de início.');const chaptersPerWeek=Number($('plan-rate').value);if(!Number.isInteger(chaptersPerWeek)||chaptersPerWeek<1||chaptersPerWeek>30)throw new Error('Informe de 1 a 30 capítulos por semana.');
 const data={title:$('plan-title').value.trim(),description:$('plan-description').value.trim(),startDate,chaptersPerWeek,bookCounts,active:true,createdBy:currentUser.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()};if(!data.title)throw new Error('Informe o nome do plano.');await addDoc(collection(db,'plans'),data);setMessage('plan-message','Plano criado com sucesso!');$('create-plan-form').reset();$('plan-rate').value='3';await loadPlans();
 }catch(e){console.error(e);setMessage('plan-message',e.message||`Não foi possível criar (${e.code||'erro'}).`,true);}finally{btn.disabled=false;}}
function fillNTTemplate(){ $('plan-title').value='Novo Testamento 2027';$('plan-description').value='Uma caminhada pelo Novo Testamento, de Mateus a Apocalipse. Três capítulos por semana, no ritmo de cada participante.';$('plan-start').value='2027-01-11';$('plan-rate').value='3';$('plan-books').value=NT_BOOKS.map(([n,c])=>`${n}: ${c}`).join('\n'); }
$('plan-template').addEventListener('click',fillNTTemplate);
$('create-plan-form').addEventListener('submit',createPlan);
$('week-prev').addEventListener('click',()=>{selectedWeek=Math.max(0,selectedWeek-1);renderPlan();});$('week-next').addEventListener('click',()=>{if(!isWeekComplete()){alert('Para avançar, marque todos os capítulos desta semana como lidos.');return;}selectedWeek++;renderPlan();if(!document.getElementById('reflexoes').classList.contains('hidden'))loadMyReflection();});

function reflectionDocId(){return `${currentUser.uid}_${selectedPlan?.id||'sem-plano'}_${selectedWeek+1}`;}
let editingReflectionId=null;
function reflectionFields(){return ['reflection-noticed','reflection-learned','reflection-apply'];}
function closeReflectionEditor(){hide('reflection-editor');show('reflection-start');editingReflectionId=null;$('save').textContent='Publicar reflexão';}
function openReflectionEditor(data={},id=null){
 editingReflectionId=id;
 $('reflection-noticed').value=data.noticed||'';$('reflection-learned').value=data.learned||'';$('reflection-apply').value=data.application||'';
 const privacy=document.querySelector(`[name="privacy"][value="${data.visibility||'private'}"]`);if(privacy)privacy.checked=true;
 $('save').textContent=id?'Salvar alterações':'Publicar reflexão';hide('reflection-start');show('reflection-editor');$('reflection-noticed').focus();
}
async function deleteReflection(reflectionId){
 if(!confirm('Tem certeza de que deseja excluir esta reflexão? Esta ação não poderá ser desfeita.'))return;
 try{
  const reflectionRef=doc(db,'reflections',reflectionId),reflectionSnap=await getDoc(reflectionRef);
  if(!reflectionSnap.exists())throw new Error('Reflexão não encontrada.');
  if(reflectionSnap.data().ownerUid!==currentUser.uid&&!isAdmin())throw new Error('Você não tem permissão para excluir esta reflexão.');
  if(reflectionSnap.data().visibility==='shared'){
   const comments=await getDocs(collection(db,'reflections',reflectionId,'comments'));
   for(const comment of comments.docs) await deleteDoc(comment.ref);
  }
  await deleteDoc(reflectionRef);
  if(reflectionId===reflectionDocId()){ $('my-reflection-current').replaceChildren();closeReflectionEditor(); }
  setMessage('reflection-message','Reflexão excluída.');await loadMyReflection();await loadSharedReflections();await loadDashboardLatest();
 }catch(e){console.error(e);alert(`Não foi possível excluir a reflexão (${e.code||'erro'}).`);}
}
async function loadMyReflection(){
 const weekLabel=$('reflection-week'),current=$('my-reflection-current');current.replaceChildren();closeReflectionEditor();
 if(!selectedPlan){weekLabel.textContent='Selecione um plano na aba Leitura';hide('reflection-start');return;}
 weekLabel.textContent=`${selectedPlan.title} · Semana ${selectedWeek+1}`;
 const weekDone=isWeekComplete();$('reflection-start').disabled=!weekDone;$('reflection-start').textContent=weekDone?'Escrever minha reflexão':'Conclua os 3 capítulos para liberar a reflexão';
 if(!weekDone){hide('reflection-editor');show('reflection-start');setMessage('reflection-message','Sua reflexão será liberada depois que você marcar todos os capítulos desta semana como lidos.');}
 try{
  const snap=await getDoc(doc(db,'reflections',reflectionDocId()));
  if(!snap.exists()){show('reflection-start');if(weekDone)setMessage('reflection-message','Você ainda não publicou sua reflexão desta semana.');return;}
  const data=snap.data();hide('reflection-start');
  const heading=document.createElement('b');heading.textContent='Sua reflexão desta semana';
  const privacy=document.createElement('small');privacy.textContent=data.visibility==='shared'?'Compartilhada com os irmãos':'Visível somente para você';privacy.style.display='block';privacy.style.color='#64748b';current.append(heading,privacy);
  [['O que chamou minha atenção',data.noticed],['O que aprendi',data.learned],['Como posso aplicar',data.application]].forEach(([label,value])=>{if(value){const q=document.createElement('b'),a=document.createElement('p');q.textContent=label;a.textContent=value;a.style.margin='4px 0 10px';current.append(q,a);}});
  const actions=document.createElement('div');actions.className='form-actions';const edit=document.createElement('button'),remove=document.createElement('button');edit.type='button';edit.textContent='Editar';remove.type='button';remove.textContent='Excluir';remove.className='secondary';edit.onclick=()=>openReflectionEditor(data,snap.id);remove.onclick=()=>deleteReflection(snap.id);actions.append(edit,remove);current.append(actions);
  setMessage('reflection-message','Sua reflexão já está registrada. Você pode editá-la ou excluí-la.');
 }catch(e){console.error(e);setMessage('reflection-message',`Não foi possível carregar sua reflexão (${e.code||'erro'}).`,true);}
}
async function saveReflection(){
 if(!selectedPlan){setMessage('reflection-message','Selecione um plano na aba Leitura antes de registrar a reflexão.',true);return;}
 if(!editingReflectionId&&!isWeekComplete()){setMessage('reflection-message','Marque todos os capítulos desta semana como lidos antes de publicar sua reflexão.',true);return;}
 const noticed=$('reflection-noticed').value.trim(),learned=$('reflection-learned').value.trim(),application=$('reflection-apply').value.trim();
 if(!noticed&&!learned&&!application){setMessage('reflection-message','Preencha pelo menos uma das três perguntas.',true);return;}
 const visibility=document.querySelector('[name="privacy"]:checked').value;$('save').disabled=true;
 try{
  const ref=doc(db,'reflections',editingReflectionId||reflectionDocId());
  await setDoc(ref,{ownerUid:currentUser.uid,ownerName:currentUser.displayName||'Participante',noticed,learned,application,visibility,planId:selectedPlan.id,planTitle:selectedPlan.title,week:selectedWeek+1,updatedAt:serverTimestamp()},{merge:true});
  closeReflectionEditor();setMessage('reflection-message',visibility==='private'?'Reflexão salva em modo privado.':'Reflexão compartilhada com os participantes aprovados.');
  await loadMyReflection();await loadSharedReflections();await loadDashboardLatest();
 }catch(e){console.error(e);setMessage('reflection-message',`Não foi possível salvar (${e.code||'erro'}).`,true);}finally{$('save').disabled=false;}
}
async function loadComments(reflectionId, container){
 container.textContent='Carregando comentários...';
 try{
  const commentsQuery=query(collection(db,'reflections',reflectionId,'comments'),orderBy('createdAt','asc'));
  const snap=await getDocs(commentsQuery);container.replaceChildren();
  if(!snap.size){const empty=document.createElement('small');empty.textContent='Ainda não há comentários. Seja o primeiro a contribuir.';empty.style.color='#64748b';container.append(empty);return;}
  snap.docs.forEach(commentDoc=>{
   const data=commentDoc.data(),row=document.createElement('div');
   row.style.padding='10px 0';row.style.borderTop='1px solid #e2e8f0';
   const head=document.createElement('div');head.style.display='flex';head.style.alignItems='center';head.style.gap='9px';
   const avatar=document.createElement('div');avatar.style.width='36px';avatar.style.height='36px';avatar.style.minWidth='36px';avatar.style.borderRadius='50%';avatar.style.overflow='hidden';avatar.style.background='#e2e8f0';avatar.style.display='flex';avatar.style.alignItems='center';avatar.style.justifyContent='center';avatar.style.fontWeight='700';avatar.style.color='#475569';
   const ownerName=data.ownerName||'Participante';
   if(data.photoURL){const photo=document.createElement('img');photo.src=data.photoURL;photo.alt=`Foto de ${ownerName}`;photo.referrerPolicy='no-referrer';photo.style.width='100%';photo.style.height='100%';photo.style.objectFit='cover';photo.onerror=()=>{avatar.replaceChildren();avatar.textContent=ownerName.trim().charAt(0).toUpperCase()||'P';};avatar.append(photo);}else{avatar.textContent=ownerName.trim().charAt(0).toUpperCase()||'P';}
   const identity=document.createElement('div');identity.style.display='flex';identity.style.flexDirection='column';identity.style.gap='2px';
   const name=document.createElement('b'),date=document.createElement('small');name.textContent=ownerName;date.textContent=data.createdAt?.toDate?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(data.createdAt.toDate()):'';date.style.color='#64748b';identity.append(name,date);head.append(avatar,identity);
   const body=document.createElement('p');body.textContent=data.text||'';body.style.margin='7px 0 5px 45px';row.append(head,body);
   if(data.ownerUid===currentUser.uid||isAdmin()){
    const remove=document.createElement('button');remove.type='button';remove.textContent='Excluir';remove.className='secondary';remove.style.fontSize='12px';remove.style.padding='5px 9px';
    remove.addEventListener('click',async()=>{if(!confirm('Excluir este comentário?'))return;try{await deleteDoc(doc(db,'reflections',reflectionId,'comments',commentDoc.id));await loadComments(reflectionId,container);}catch(e){console.error(e);alert(`Não foi possível excluir o comentário (${e.code||'erro'}).`);}});row.append(remove);
   }
   container.append(row);
  });
 }catch(e){console.error(e);container.textContent=`Não foi possível carregar os comentários (${e.code||'erro'}).`;}
}
async function loadSharedReflections(){
 const target=$('shared-reflections');target.textContent='Carregando reflexões...';
 try{
  const q=query(collection(db,'reflections'),where('visibility','==','shared'),orderBy('updatedAt','desc'),limit(30));
  const results=await getDocs(q);target.replaceChildren();
  if(!results.size){target.textContent='Ainda não há reflexões compartilhadas.';return;}
  const groups=new Map();
  results.docs.forEach(d=>{
   const data=d.data(),planId=data.planId||data.planTitle||'plano-sem-identificacao',weekNumber=Number(data.week)||0,key=`${planId}__${weekNumber}`;
   if(!groups.has(key))groups.set(key,{planTitle:data.planTitle||'Plano de leitura',week:weekNumber,entries:[]});
   groups.get(key).entries.push({id:d.id,data});
  });
  const orderedGroups=[...groups.values()].sort((a,b)=>a.planTitle.localeCompare(b.planTitle,'pt-BR')||b.week-a.week);
  orderedGroups.forEach(group=>{
   const section=document.createElement('section');section.className='reflection-week-group';section.style.marginBottom='18px';
   const heading=document.createElement('h3');heading.textContent=group.week?`Semana ${group.week}`:'Semana não identificada';heading.style.margin='0 0 6px';section.append(heading);
   const planMeta=document.createElement('small');planMeta.textContent=group.planTitle;planMeta.style.display='block';planMeta.style.marginBottom='10px';planMeta.style.color='#64748b';section.append(planMeta);
   group.entries.forEach((entryData,index)=>{
    const {id:reflectionId,data}=entryData,entry=document.createElement('article');entry.className='reflection-entry';entry.style.padding='12px 4px';
    if(index>0)entry.style.borderTop='1px solid #e2e8f0';
    const author=document.createElement('b');author.textContent=data.ownerName||'Participante';author.style.display='block';author.style.marginBottom='9px';entry.append(author);
    [['O que chamou minha atenção',data.noticed],['O que aprendi',data.learned],['Como vou aplicar',data.application]].forEach(([label,value])=>{if(value){const question=document.createElement('b'),answer=document.createElement('p');question.textContent=label;answer.textContent=value;answer.style.margin='4px 0 10px';entry.append(question,answer);}});
    if(data.ownerUid===currentUser.uid){const ownActions=document.createElement('div');ownActions.className='form-actions';ownActions.style.margin='8px 0';const editOwn=document.createElement('button'),deleteOwn=document.createElement('button');editOwn.type='button';editOwn.textContent='Editar minha reflexão';editOwn.className='secondary';editOwn.onclick=()=>{const plan=plans.find(p=>p.id===data.planId);if(plan){selectedPlan=plan;selectedWeek=Math.max(0,(Number(data.week)||1)-1);renderPlan();}document.querySelectorAll('nav [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab==='reflexoes'));document.querySelectorAll('.panel').forEach(panel=>panel.classList.toggle('hidden',panel.id!=='reflexoes'));$('reflection-week').textContent=`${data.planTitle||'Plano de leitura'} · Semana ${data.week||1}`;openReflectionEditor(data,reflectionId);};deleteOwn.type='button';deleteOwn.textContent='Excluir minha reflexão';deleteOwn.className='secondary';deleteOwn.onclick=()=>deleteReflection(reflectionId);ownActions.append(editOwn,deleteOwn);entry.append(ownActions);}
    const commentsArea=document.createElement('div');commentsArea.style.marginTop='12px';
    const commentsTitle=document.createElement('b');commentsTitle.textContent='Comentários';commentsTitle.style.display='block';commentsTitle.style.marginBottom='5px';
    const commentsList=document.createElement('div');commentsList.style.marginBottom='8px';
    const form=document.createElement('form');form.style.display='flex';form.style.gap='8px';form.style.alignItems='stretch';
    const input=document.createElement('input');input.type='text';input.maxLength=1000;input.placeholder='Escreva um comentário...';input.required=true;input.setAttribute('aria-label','Escreva um comentário');input.style.flex='1';input.style.minWidth='0';
    const send=document.createElement('button');send.type='submit';send.textContent='Enviar';
    form.append(input,send);form.addEventListener('submit',async event=>{event.preventDefault();const text=input.value.trim();if(!text)return;send.disabled=true;try{await addDoc(collection(db,'reflections',reflectionId,'comments'),{ownerUid:currentUser.uid,ownerName:currentUser.displayName||currentMember?.displayName||'Participante',photoURL:currentUser.photoURL||currentMember?.photoURL||'',text,createdAt:serverTimestamp()});input.value='';await loadComments(reflectionId,commentsList);}catch(e){console.error(e);alert(`Não foi possível enviar o comentário (${e.code||'erro'}). Verifique as regras do Firestore.`);}finally{send.disabled=false;}});
    commentsArea.append(commentsTitle,commentsList,form);entry.append(commentsArea);section.append(entry);
    loadComments(reflectionId,commentsList);
   });
   target.append(section);
  });
 }catch(e){console.error(e);target.textContent=`Não foi possível carregar as reflexões (${e.code||'erro'}).`;}
}
$('login').addEventListener('click',enterWithGoogle);$('logout').addEventListener('click',doLogout);$('pending-logout').addEventListener('click',doLogout);$('rejected-logout').addEventListener('click',doLogout);$('pending-refresh').addEventListener('click',refreshAccess);$('save').addEventListener('click',saveReflection);$('reflection-start').addEventListener('click',()=>{if(!isWeekComplete()){setMessage('reflection-message','Marque os três capítulos da semana como lidos antes de escrever sua reflexão.',true);return;}openReflectionEditor();});$('reflection-cancel').addEventListener('click',()=>{closeReflectionEditor();setMessage('reflection-message','Edição cancelada.');});document.querySelectorAll('nav [data-tab]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.tab==='reflexoes')loadMyReflection();}));$('week-prev').addEventListener('click',()=>{if(document.getElementById('reflexoes').classList.contains('hidden')===false)loadMyReflection();});$('week-next').addEventListener('click',()=>{if(document.getElementById('reflexoes').classList.contains('hidden')===false)loadMyReflection();});setupTabs();onAuthStateChanged(auth,handleUser);
