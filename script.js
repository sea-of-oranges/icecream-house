const root=document.documentElement;
const $=id=>document.getElementById(id);
const authScreen=$('authScreen'),authForm=$('authForm'),authError=$('authError'),authSubmit=$('authSubmit'),usernameInput=$('usernameInput'),emailInput=$('emailInput'),passwordInput=$('passwordInput'),hintField=$('hintField'),hintInput=$('hintInput');
const session=()=>localStorage.getItem('icecreamHouseSession')||'guest';
const key=name=>`icecreamHouse:${session()}:${name}`;
const get=(name,fallback='')=>localStorage.getItem(key(name))??fallback;
let cloudSyncTimer=null;
const save=(name,value)=>{localStorage.setItem(key(name),value);queueCloudSync();};
const clearSessionData=()=>{
 localStorage.removeItem('icecreamHouseSession');
};
const normalizeUsername=value=>String(value||'').trim().replace(/\s+/g,' ').slice(0,30);
const localToday=()=>{const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;};
const authMessage=reason=>reason==='Email logins are disabled'?'Enable Authentication > Providers > Email in your Supabase project.':reason==='Invalid login credentials'?'Username or password does not match.':reason;
const supabaseEnabled=()=>Boolean(window.supabase&&window.ICECREAM_SUPABASE_READY);
const getSupabaseClient=()=>supabaseEnabled()?window.supabase.createClient(window.ICECREAM_SUPABASE_URL,window.ICECREAM_SUPABASE_ANON_KEY,window.ICECREAM_SUPABASE_OPTIONS):null;
const localAccountData=()=>Object.fromEntries(Object.keys(localStorage).filter(item=>item.startsWith(`icecreamHouse:${session()}:`)).map(item=>[item.slice(`icecreamHouse:${session()}:`.length),localStorage.getItem(item)]));
async function syncToCloud(){
 const client=getSupabaseClient();
 if(!client||session()==='guest')return;
 const {data:{session:authSession}}=await client.auth.getSession();
 if(!authSession)return;
 const {error}=await client.from('user_data').upsert({user_id:authSession.user.id,data:localAccountData(),updated_at:new Date().toISOString()});
 if(error)console.warn('Could not sync account data:',error.message);
}
function queueCloudSync(){
 if(cloudSyncTimer)clearTimeout(cloudSyncTimer);
 cloudSyncTimer=setTimeout(()=>{cloudSyncTimer=null;syncToCloud();},500);
}
async function syncFromCloud(){
 const client=getSupabaseClient();
 if(!client||session()==='guest')return;
 const {data:{session:authSession}}=await client.auth.getSession();
 if(!authSession)return;
 const {data,error}=await client.from('user_data').select('data').eq('user_id',authSession.user.id).maybeSingle();
 if(error){console.warn('Could not load account data:',error.message);return;}
 if(data?.data){
   for(const [name,value] of Object.entries(data.data))localStorage.setItem(key(name),String(value));
 }else await syncToCloud();
}
async function enterApp(){
 await syncFromCloud();
 authScreen.classList.add('is-hidden');
 init();
}
async function signInWithSupabase(email,password,username){
 const client=getSupabaseClient();
 if(!client)return {ok:false,reason:'SUPABASE_NOT_CONFIGURED'};
 const {data,error}=await client.auth.signInWithPassword({email,password});
 if(error)return {ok:false,reason:error.message};
 localStorage.setItem('icecreamHouseSession',normalizeUsername(username||data.user.user_metadata?.username||email));
 return {ok:true,session:data.session};
}
async function signUpWithSupabase(username,email,password,hint=''){
 const client=getSupabaseClient();
 if(!client)return {ok:false,reason:'SUPABASE_NOT_CONFIGURED'};
 const {data,error}=await client.auth.signUp({email,password,options:{data:{username:normalizeUsername(username),password_hint:hint}}});
 if(error)return {ok:false,reason:error.message};
 if(!data.session)return {ok:false,reason:'ACCOUNT_CONFIRMATION_REQUIRED'};
 localStorage.setItem('icecreamHouseSession',normalizeUsername(username));
 return {ok:true,session:data.session};
}
let selectedDate=new Date().toISOString().slice(0,10),viewDate=new Date(new Date().getFullYear(),new Date().getMonth(),1),timerSeconds=1500,timerInterval=null,customClock=null;
const dailyDateDisplay=$('dailyDatePicker');
dailyDateDisplay.type='text';
dailyDateDisplay.readOnly=false;
dailyDateDisplay.placeholder='YYYY/MM/DD';
dailyDateDisplay.inputMode='numeric';
dailyDateDisplay.pattern='\\d{4}/\\d{2}/\\d{2}';
dailyDateDisplay.setAttribute('aria-label','Selected planning date');
const daysOff=[['2026-09-04','Professional activity day','PD day'],['2026-09-07','Labour Day','Holiday'],['2026-10-12','Thanksgiving Day','Holiday'],['2026-10-23','Professional activity day','PD day'],['2026-11-27','Professional activity day','PD day'],['2026-12-25','Christmas Day','Holiday'],['2027-01-01','New Year’s Day','Holiday'],['2027-01-29','Professional activity day','PD day'],['2027-02-15','Family Day','Holiday'],['2027-03-15','March break begins','Break'],['2027-04-02','Good Friday','Holiday'],['2027-04-23','Professional activity day','PD day'],['2027-05-24','Victoria Day','Holiday'],['2027-06-29','Professional activity day','PD day']];
const categoryPalette={Personal:{bg:'rgba(139,92,246,0.18)',color:'#8b5cf6'},Birthday:{bg:'rgba(244,114,182,0.18)',color:'#ec4899'},'School event':{bg:'rgba(59,130,246,0.18)',color:'#2563eb'},'Club event':{bg:'rgba(16,185,129,0.18)',color:'#10b981'},Health:{bg:'rgba(34,197,94,0.18)',color:'#22c55e'},Lessons:{bg:'rgba(250,226,142,0.28)',color:'#b08a16'},Homework:{bg:'rgba(251,191,36,0.18)',color:'#f59e0b'},Study:{bg:'rgba(168,85,247,0.18)',color:'#a855f7'},Social:{bg:'rgba(249,115,22,0.18)',color:'#f97316'},Appointment:{bg:'rgba(239,68,68,0.18)',color:'#ef4444'},Holiday:{bg:'rgba(139,92,246,0.18)',color:'#8b5cf6'}};
const escape=s=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const getEvents=()=>{try{return JSON.parse(get('events','[]'));}catch{return [];}};
const getEventId=(event)=>String(event.id||`${event.date||selectedDate}-${event.name||'event'}-${event.category||'Personal'}`).replace(/^event:/,'');
const dateParts=date=>{const [year,month,day]=String(date).split('-').map(Number);return new Date(Date.UTC(year,month-1,day));};
const eventOccursOnDate=(event,date)=>{
 const start=dateParts(event.date),target=dateParts(date),difference=Math.round((target-start)/86400000),repeat=event.repeat||'none';
 if(!event.date||difference<0||event.deletedDates?.includes(date)||(event.deletedFrom&&date>=event.deletedFrom))return false;
 if(repeat==='none'||event.repeatEnabled===false)return difference===0;
 const day=target.getUTCDay(),interval=Math.max(1,Number(event.repeatInterval)||1);
 const matches=repeat==='daily'&&difference%interval===0||repeat==='weekends'&&[0,6].includes(day)||repeat==='weekdays'&&day>=1&&day<=5||repeat==='weekly'&&difference%(7*interval)===0||['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][day]===repeat;
 if(!matches)return false;
 let occurrence=0;
 for(let offset=0;offset<=difference;offset++){
   const current=new Date(start.getTime()+offset*86400000),currentDay=current.getUTCDay();
   if(repeat==='daily'&&offset%interval===0||repeat==='weekends'&&[0,6].includes(currentDay)||repeat==='weekdays'&&currentDay>=1&&currentDay<=5||repeat==='weekly'&&offset%(7*interval)===0||['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][currentDay]===repeat)occurrence++;
 }
 if((repeat==='weekends'||repeat==='weekdays'||['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].includes(repeat))&&interval>1&&(occurrence-1)%interval!==0)return false;
 return event.repeatInfinite||occurrence<=(Math.max(1,Number(event.repeatCount)||1));
};
const getDailyTaskItems=(date=selectedDate)=>{
 const saved=JSON.parse(get(`dailyTasks:${date}`,'[]'));
 const upcoming=getExplicitUpcomingTasks().filter(task=>task.dueDate===date).map(task=>({...task,id:`upcoming:${task.id}`,label:task.title,source:'upcoming',category:task.category}));
 const calendarEvents=getEvents().filter(event=>eventOccursOnDate(event,date)).map(event=>({
   id:`event:${getEventId(event)}`,
   label:event.name,
   done:Boolean(event.done),
   source:'event',
   category:event.category||'Personal'
 }));
 return [...calendarEvents, ...upcoming, ...saved.filter(task => task.source !== 'event' && task.source !== 'upcoming')];
};
const getUpcomingTasks=()=>{
 const explicit=getExplicitUpcomingTasks().filter(task=>task.dueDate>localToday()).map(task=>({...task,kind:'upcoming'}));
 const daily=[];
 const prefix=`icecreamHouse:${session()}:dailyTasks:`;
 Object.keys(localStorage).filter(item=>item.startsWith(prefix)&&item.slice(prefix.length)>localToday()).forEach(item=>{
   const dueDate=item.slice(prefix.length);
   try{JSON.parse(localStorage.getItem(item)||'[]').filter(task=>task.source!=='event'&&task.source!=='upcoming').forEach(task=>daily.push({...task,id:`daily:${dueDate}:${task.id}`,title:task.label,dueDate,category:task.category||'Personal',kind:'daily'}));}catch{}
 });
 const calendar=[];
 const start=dateParts(localToday());
 for(let offset=1;offset<=366;offset++){
   const date=new Date(start.getTime()+offset*86400000).toISOString().slice(0,10);
   getEvents().filter(event=>eventOccursOnDate(event,date)).forEach(event=>calendar.push({id:`event:${getEventId(event)}:${date}`,title:event.name,dueDate:date,category:event.category||'Personal',done:Boolean(event.done),kind:'event',eventId:getEventId(event)}));
 }
 return [...explicit,...daily,...calendar];
};
const getExplicitUpcomingTasks=()=>{try{return JSON.parse(get('upcomingTasks','[]')).filter(task=>task.kind!=='daily'&&task.kind!=='event');}catch{return [];}};
const formatDueDate=date=>String(date).split('-').join('/');
function renderUpcoming(){
 const tasks=getUpcomingTasks().sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
 const list=$('upcomingTaskList');
 list.innerHTML=tasks.map(task=>`<li><input type="checkbox" data-upcoming-id="${task.id}" data-upcoming-kind="${task.kind}" data-upcoming-date="${task.dueDate}" data-upcoming-event="${task.eventId||''}" ${task.done?'checked':''}><div class="upcoming-task-copy"><strong>${escape(task.title)}</strong><span>Due ${formatDueDate(task.dueDate)} · ${escape(task.category)}</span></div><button class="delete-task" data-upcoming-delete="${task.id}" data-upcoming-kind="${task.kind}" data-upcoming-date="${task.dueDate}" data-upcoming-event="${task.eventId||''}" aria-label="Delete ${escape(task.title)}">×</button></li>`).join('');
 $('upcomingEmpty').hidden=tasks.length>0;
 $('upcomingCount').textContent=`${tasks.filter(task=>!task.done).length} upcoming`;
}
const eventTag=(name,category='Personal')=>{const palette=categoryPalette[category]||categoryPalette.Personal;return `<span class="day-event"><span class="day-event-tag" style="--tag-bg:${palette.bg};--tag-color:${palette.color};">${escape(category)}</span><span class="day-event-name">${escape(name)}</span></span>`;};
function setupEventControls(){
 const weekdayHeader=document.querySelector('.calendar-weekdays');
 if(weekdayHeader)weekdayHeader.innerHTML='<span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>';
 const category=$('eventCategory');
 if(category&&!Array.from(category.options).some(option=>option.value==='Lessons'))category.add(new Option('Lessons','Lessons'));
 const legacyRepeatFields=$('repeatCustomFields');
 if(legacyRepeatFields)legacyRepeatFields.remove();
 const repeat=$('eventRepeat');
 if(!repeat||$('eventRepeatEnabled'))return;
 repeat.innerHTML='<option value="daily">Every day</option><option value="weekends">Every weekend</option><option value="weekdays">Every weekday</option><option value="weekly">Every week</option><option value="monday">Every Monday</option><option value="tuesday">Every Tuesday</option><option value="wednesday">Every Wednesday</option><option value="thursday">Every Thursday</option><option value="friday">Every Friday</option><option value="saturday">Every Saturday</option><option value="sunday">Every Sunday</option>';
 const oldLabel=repeat.closest('label'),form=oldLabel.parentElement,options=document.createElement('div'),toggle=document.createElement('label');
 options.className='repeat-options';options.id='repeatOptions';options.hidden=true;
 oldLabel.firstChild.textContent='Repeat date';
   const countLabel=document.createElement('label');countLabel.innerHTML='Repeat times <span class="repeat-count-row"><input id="eventRepeatCount" type="number" min="1" value="1"><span class="repeat-infinite"><input id="eventRepeatInfinite" type="checkbox"> Infinite</span></span>';
   const everyLabel=document.createElement('label');everyLabel.innerHTML='Every <input id="eventRepeatInterval" type="number" min="1" value="1">';
   const unitLabel=document.createElement('label');unitLabel.innerHTML='Unit <select id="eventRepeatUnit"><option value="day">day(s)</option><option value="week">week(s)</option><option value="month">month(s)</option></select>';
   const repeatDateLabel=oldLabel;
   toggle.className='repeat-toggle';toggle.innerHTML='<span>Repeat</span><span><input id="eventRepeatEnabled" type="checkbox"> On</span>';
   form.insertBefore(toggle,oldLabel);options.append(countLabel,everyLabel,unitLabel,repeatDateLabel);form.insertBefore(options,toggle.nextSibling);
 $('eventRepeatEnabled').onchange=event=>{options.hidden=!event.target.checked;};
 $('eventRepeatInfinite').onchange=event=>{$('eventRepeatCount').disabled=event.target.checked;};
}
function renderSchool(){ $('calendarList').innerHTML=daysOff.map(d=>`<li><div><strong>${d[1]}</strong><span>${d[0]}</span></div><em>${d[2]}</em></li>`).join(''); }
function renderMonth(){const y=viewDate.getFullYear(),m=viewDate.getMonth(),start=(new Date(y,m,1).getDay()+6)%7; $('monthLabel').textContent=viewDate.toLocaleDateString([],{month:'long',year:'numeric'});const events=getEvents();$('monthGrid').innerHTML=Array.from({length:42},(_,i)=>{const d=new Date(y,m,i-start+1),k=d.toISOString().slice(0,10),out=d.getMonth()!==m,ev=[...daysOff.map(x=>({date:x[0],name:x[1],category:'Holiday'})),...events].filter(x=>x.category==='Holiday'?x.date===k:eventOccursOnDate(x,k)).sort((a,b)=>String(a.name).localeCompare(String(b.name)));return `<button class="calendar-day ${out?'muted':''} ${k===selectedDate?'selected':''}" data-date="${k}"><span class="day-number">${d.getDate()}</span><span class="day-events">${ev.slice(0,2).map(x=>eventTag(x.name,x.category||'Holiday')).join('')}</span></button>`}).join('');document.querySelectorAll('.calendar-day:not(.muted)').forEach(b=>b.onclick=()=>selectDate(b.dataset.date));}
const displayDate=date=>String(date).replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$1/$2/$3');
const parseTypedDate=value=>{const match=String(value).trim().match(/^(\d{4})\/(\d{2})\/(\d{2})$/);if(!match)return null;const candidate=`${match[1]}-${match[2]}-${match[3]}`,parsed=dateParts(candidate);return parsed.toISOString().slice(0,10)===candidate?candidate:null;};
function selectDate(date){selectedDate=date||selectedDate;dailyDateDisplay.value=displayDate(selectedDate);$('dailyDateLabel').textContent=selectedDate===localToday()?'Today':new Date(`${selectedDate}T12:00`).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'});renderTasks('daily');document.querySelectorAll('.calendar-day').forEach(b=>b.classList.toggle('selected',b.dataset.date===selectedDate));}
function renderTasks(group){const storage=group==='daily'?`dailyTasks:${selectedDate}`:'weeklyTasks',tasks=group==='daily'?getDailyTaskItems(selectedDate):JSON.parse(get(storage,'[]'));const list=$(group==='daily'?'dailyTaskList':'weeklyTaskList');list.innerHTML=tasks.map(t=>`<li><input type="checkbox" data-id="${t.id}" data-source="${t.source||'task'}" ${t.done?'checked':''}><span class="${t.done?'done':''}">${escape(t.label)}</span><button class="delete-task" data-delete="${t.id}" data-source="${t.source||'task'}" data-date="${selectedDate}">×</button></li>`).join('');$(group==='daily'?'dailyCount':'weeklyCount').textContent=`${tasks.filter(t=>!t.done).length} left`;}
function addTask(group){const input=$(group==='daily'?'dailyTaskInput':'weeklyTaskInput'),storage=group==='daily'?`dailyTasks:${selectedDate}`:'weeklyTasks',tasks=JSON.parse(get(storage,'[]'));if(!input.value.trim())return;if(group==='daily'&&selectedDate>localToday()){const upcoming=getExplicitUpcomingTasks();upcoming.push({id:Date.now(),title:input.value.trim(),dueDate:selectedDate,category:'Personal',done:false});save('upcomingTasks',JSON.stringify(upcoming));renderUpcoming();}else{tasks.push({id:Date.now(),label:input.value.trim(),done:false});save(storage,JSON.stringify(tasks));}input.value='';renderTasks(group);}
function weatherInfo(code){if([95,96,99].includes(code))return['⛈️','Storm watch','Stormy conditions are possible today.'];if([51,53,55,61,63,65,80,81,82].includes(code))return['🌧️','Rain likely','Rain is in the forecast today.'];if([71,73,75,85,86].includes(code))return['❄️','Snow likely','Snow is in the forecast today.'];if(code>2)return['☁️','Cloudy','A peaceful cloudy day.'];return['☀️','Clear skies','A peaceful day. Enjoy the light.'];}
async function loadWeather(){try{const p=new URLSearchParams({latitude:43.45,longitude:-79.68,timezone:'America/Toronto',forecast_days:1,current:'temperature_2m,weather_code',daily:'weather_code,temperature_2m_max,sunrise,sunset'}),r=await fetch(`https://api.open-meteo.com/v1/forecast?${p}`),x=await r.json(),d=x.daily,c=weatherInfo(x.current.weather_code);$('weatherIcon').textContent=c[0];$('weatherTemperature').textContent=`${Math.round(x.current.temperature_2m)}°C`;$('weatherSummary').textContent=`${c[1]} · high ${Math.round(d.temperature_2m_max[0])}°C`;$('sunriseTime').textContent=new Date(d.sunrise[0]).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});$('sunsetTime').textContent=new Date(d.sunset[0]).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});$('weatherNote').textContent=c[2];}catch{$('weatherSummary').textContent='Weather unavailable';$('weatherNote').textContent='A peaceful day while we reconnect.';}}
function updateClock(){let d=new Date();if(customClock){d.setHours(...customClock.split(':').map(Number));}let s=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:$('clockFormat').value==='12'});$('flipClock').textContent=s;$('flipClock').classList.add('flip');setTimeout(()=>$('flipClock').classList.remove('flip'),300);$('dateDisplay').textContent=new Date().toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'});}
function showPage(page){document.querySelectorAll('main>section:not(.app-page)').forEach(s=>s.hidden=page!=='home');document.querySelectorAll('.app-page').forEach(s=>s.hidden=s.id!==(page==='timer'?'timerPage':'quickNotePage')||page==='home');window.scrollTo({top:0,behavior:'smooth'});}
function init(){renderSchool();renderMonth();selectDate(selectedDate);renderTasks('weekly');loadWeather();$('clockFormat').value=get('clockFormat','12');customClock=get('clockTime')||null;updateClock();$('quickNoteInput').value=get('quickNote');$('backgroundUrl').value=get('background','').startsWith('http')?get('background'):'';let bg=get('background');if(bg)root.style.setProperty('--custom-bg-image',`url("${bg}")`);root.dataset.accent=get('accent','purple');root.dataset.theme=get('theme','dark');$('modeToggle').textContent=root.dataset.theme==='light'?'Day':'Night';const pulseOn=localStorage.getItem('icecreamHousePulse')==='on';const parallaxOn=localStorage.getItem('icecreamHouseParallax')!=='off';document.body.classList.toggle('pulse-active',pulseOn);document.body.classList.toggle('parallax-off',!parallaxOn);const parallaxButton=$('parallaxButton');if(parallaxButton) parallaxButton.textContent=parallaxOn?'Parallax mode':'Parallax off';document.querySelectorAll('.tool-card,.widget,.content-section,.custom-panel,.app-page,.quote-panel,.insight-panel').forEach((el,index)=>{el.classList.add('scroll-reveal');el.style.setProperty('--reveal-delay',`${index * 60}ms`);});const revealObserver=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');}else{entry.target.classList.remove('is-visible');}});},{threshold:0.12});document.querySelectorAll('.scroll-reveal').forEach(el=>revealObserver.observe(el));const range=$('focusRange');const focusValue=$('focusValue');if(range&&focusValue){const updateFocus=()=>{focusValue.textContent=`${range.value}%`;document.documentElement.style.setProperty('--focus-level',range.value);};updateFocus();range.oninput=updateFocus;}}
document.querySelectorAll('.swatch').forEach(b=>b.onclick=()=>{root.dataset.accent=b.dataset.accent;save('accent',b.dataset.accent);});$('modeToggle').onclick=()=>{let t=root.dataset.theme==='light'?'dark':'light';root.dataset.theme=t;save('theme',t);$('modeToggle').textContent=t==='light'?'Day':'Night';};
if($('pulseButton')){$('pulseButton').onclick=()=>{const enabled=document.body.classList.toggle('pulse-active');localStorage.setItem('icecreamHousePulse',enabled?'on':'off');};}
if($('parallaxButton')){$('parallaxButton').onclick=()=>{const enabled=document.body.classList.toggle('parallax-off');localStorage.setItem('icecreamHouseParallax',enabled?'off':'on');$('parallaxButton').textContent=enabled?'Parallax off':'Parallax mode';};}
window.addEventListener('scroll',()=>{const shift=window.scrollY*0.5;root.style.setProperty('--scroll-shift',`${shift}px`);}, {passive:true});
 $('dailyTaskForm').onsubmit=e=>{e.preventDefault();addTask('daily');};$('weeklyTaskForm').onsubmit=e=>{e.preventDefault();addTask('weekly');};$('dailyDatePicker').onchange=e=>{const date=parseTypedDate(e.target.value);if(date)selectDate(date);else{e.target.value=displayDate(selectedDate);e.target.setCustomValidity('Use a valid date in YYYY/MM/DD format.');e.target.reportValidity();}};$('dailyDatePicker').oninput=e=>e.target.setCustomValidity('');document.querySelectorAll('.main-nav a,[data-page]').forEach(e=>e.onclick=()=>showPage(e.dataset.page||'home'));$('previousMonth').onclick=()=>{viewDate.setMonth(viewDate.getMonth()-1);renderMonth();};$('nextMonth').onclick=()=>{viewDate.setMonth(viewDate.getMonth()+1);renderMonth();};$('weatherRefresh').onclick=loadWeather;
document.querySelectorAll('.editable-task-list').forEach(list=>list.onclick=e=>{const group=list.id==='dailyTaskList'?'daily':'weekly',storage=group==='daily'?`dailyTasks:${selectedDate}`:'weeklyTasks',trigger=e.target.closest('[data-delete]')||e.target.closest('[data-id]');if(!trigger)return;const idString=trigger.dataset.id||trigger.dataset.delete,source=trigger.dataset.source||'task';if(source==='upcoming'){e.stopImmediatePropagation();let upcoming=getUpcomingTasks(),id=String(idString).replace(/^upcoming:/,'');if(trigger.dataset.delete)upcoming=upcoming.filter(task=>String(task.id)!==id);else upcoming=upcoming.map(task=>String(task.id)===id?{...task,done:!task.done}:task);save('upcomingTasks',JSON.stringify(upcoming));renderUpcoming();renderTasks('daily');return;}if(trigger.dataset.delete){if(source==='event'){const eventId=String(idString).replace(/^event:/,'');let events=getEvents(),event=events.find(item=>getEventId(item)===eventId);if(event?.repeatEnabled!==false&&event?.repeat&&event.repeat!=='none'){const choice=window.prompt('Delete this repeating event:\n1 = only this occurrence\n2 = this and all future occurrences\nCancel = keep it','1');if(choice==='1'){event.deletedDates=[...(event.deletedDates||[]),selectedDate];}else if(choice==='2'){event.deletedFrom=selectedDate;}else{return;}save('events',JSON.stringify(events));}else{save('events',JSON.stringify(events.filter(item=>getEventId(item)!==eventId)));}}else{const taskList=JSON.parse(get(storage,'[]')).filter(task=>String(task.id)!==String(idString));save(storage,JSON.stringify(taskList));}renderTasks(group);renderMonth();return;}if(trigger.dataset.id){if(source==='event'){const eventId=String(idString).replace(/^event:/,'');const events=getEvents().map(event=>getEventId(event)===eventId?{...event,done:!Boolean(event.done)}:event);save('events',JSON.stringify(events));}else{const taskList=JSON.parse(get(storage,'[]'));let t=taskList.find(x=>String(x.id)===String(idString));if(t){t.done=!t.done;save(storage,JSON.stringify(taskList));}}renderTasks(group);renderMonth();}});
document.querySelectorAll('.editable-task-list').forEach(list=>list.addEventListener('click',event=>{const trigger=event.target.closest('[data-id]');if(!trigger||trigger.dataset.source!=='upcoming')return;event.stopImmediatePropagation();const id=String(trigger.dataset.id).replace(/^upcoming:/,'');let upcoming=getUpcomingTasks().map(task=>String(task.id)===id?{...task,done:!task.done}:task);save('upcomingTasks',JSON.stringify(upcoming));renderUpcoming();renderTasks('daily');},{capture:true}));
$('upcomingForm').onsubmit=e=>{e.preventDefault();const title=$('upcomingTitle').value.trim(),dueDate=$('upcomingDate').value,category=$('upcomingCategory').value;if(!title||!dueDate)return;if(dueDate<=localToday()){$('upcomingMessage').textContent='Choose a future date for Upcoming.';return;}const upcoming=getUpcomingTasks();upcoming.push({id:Date.now(),title,dueDate,category,done:false});save('upcomingTasks',JSON.stringify(upcoming));e.target.reset();$('upcomingMessage').textContent='Upcoming task added.';renderUpcoming();if(selectedDate===dueDate)renderTasks('daily');};
 $('upcomingTaskList').onclick=e=>{const trigger=e.target.closest('[data-upcoming-delete]')||e.target.closest('[data-upcoming-id]');if(!trigger)return;const id=String(trigger.dataset.upcomingId||trigger.dataset.upcomingDelete),kind=trigger.dataset.upcomingKind,dueDate=trigger.dataset.upcomingDate;if(kind==='daily'){const storage=`dailyTasks:${dueDate}`,tasks=JSON.parse(get(storage,'[]'));const taskId=id.replace(`daily:${dueDate}:`,'');save(storage,JSON.stringify(trigger.dataset.upcomingDelete?tasks.filter(task=>String(task.id)!==taskId):tasks.map(task=>String(task.id)===taskId?{...task,done:!task.done}:task)));}else if(kind==='event'){let events=getEvents(),event=events.find(item=>getEventId(item)===trigger.dataset.upcomingEvent);if(event){if(trigger.dataset.upcomingDelete){if(event.repeat&&event.repeat!=='none')event.deletedDates=[...(event.deletedDates||[]),dueDate];else events=events.filter(item=>getEventId(item)!==trigger.dataset.upcomingEvent);}else event.done=!event.done;save('events',JSON.stringify(events));}}else{let upcoming=getExplicitUpcomingTasks();upcoming=trigger.dataset.upcomingDelete?upcoming.filter(task=>String(task.id)!==id):upcoming.map(task=>String(task.id)===id?{...task,done:!task.done}:task);save('upcomingTasks',JSON.stringify(upcoming));}renderUpcoming();renderTasks('daily');};
setupEventControls();
$('eventForm').onsubmit=e=>{e.preventDefault();const repeatEnabled=$('eventRepeatEnabled').checked,repeat=repeatEnabled?$('eventRepeat').value:'none',events=getEvents();events.push({id:`event-${Date.now()}`,date:$('eventDate').value,name:$('eventTitle').value,category:$('eventCategory').value,repeat,repeatEnabled,repeatCount:Math.max(1,Number($('eventRepeatCount').value)||1),repeatInfinite:$('eventRepeatInfinite').checked,repeatInterval:Math.max(1,Number($('eventRepeatInterval').value)||1),repeatUnit:$('eventRepeatUnit').value,done:false,deletedDates:[]});save('events',JSON.stringify(events));e.target.reset();$('repeatOptions').hidden=true;$('eventRepeatCount').disabled=false;renderMonth();renderTasks('daily');};$('eventFullDay').onchange=e=>$('timeFields').hidden=e.target.checked;
$('setClockButton').onclick=()=>{customClock=$('customTime').value;save('clockTime',customClock);updateClock();};$('resetClockButton').onclick=()=>{customClock=null;localStorage.removeItem(key('clockTime'));updateClock();};$('clockFormat').onchange=()=>{save('clockFormat',$('clockFormat').value);updateClock();};
$('applyBackgroundUrl').onclick=()=>{let u=$('backgroundUrl').value.trim();try{new URL(u);root.style.setProperty('--custom-bg-image',`url("${u}")`);save('background',u);$('backgroundMessage').textContent='Background saved.';}catch{$('backgroundMessage').textContent='Enter a valid image URL.';}};$('backgroundFile').onchange=e=>{let r=new FileReader();r.onload=()=>{root.style.setProperty('--custom-bg-image',`url("${r.result}")`);save('background',r.result);};r.readAsDataURL(e.target.files[0]);};$('clearBackground').onclick=()=>{root.style.setProperty('--custom-bg-image','none');localStorage.removeItem(key('background'));};
$('startTimer').onclick=()=>{if(timerInterval){clearInterval(timerInterval);timerInterval=null;$('startTimer').textContent='Start';return;}timerSeconds=Math.max(1,Number($('customMinutes').value)||25)*60;$('startTimer').textContent='Pause';timerInterval=setInterval(()=>{timerSeconds--;let m=String(Math.floor(timerSeconds/60)).padStart(2,'0'),s=String(timerSeconds%60).padStart(2,'0');$('timerDisplay').textContent=`${m}:${s}`;if(timerSeconds<=0){clearInterval(timerInterval);timerInterval=null;$('startTimer').textContent='Start';$('timerMessage').textContent='Focus sprint complete.';}},1000);};$('resetTimer').onclick=()=>{$('timerDisplay').textContent=`${String(Number($('customMinutes').value)||25).padStart(2,'0')}:00`;};document.querySelectorAll('.timer-preset').forEach(b=>b.onclick=()=>{$('customMinutes').value=b.dataset.minutes;$('timerDisplay').textContent=`${b.dataset.minutes}:00`;});
$('saveNote').onclick=()=>{save('quickNote',$('quickNoteInput').value);$('noteSavedStatus').textContent='Saved just now';};
function authMode(create){$('signInTab').classList.toggle('active',!create);$('createTab').classList.toggle('active',create);hintField.hidden=!create;authSubmit.textContent=create?'Create account':'Sign in';} $('signInTab').onclick=()=>authMode(false);$('createTab').onclick=()=>authMode(true);authForm.onsubmit=async e=>{
 e.preventDefault();
 const u=normalizeUsername(usernameInput.value);
 const email=emailInput.value.trim().toLowerCase();
 const p=passwordInput.value;
 const hint=hintInput.value.trim();
 if(!u || !email || !p){authError.textContent='Please enter a username, email, and password.';return;}
 if(hintField.hidden){
   if(supabaseEnabled()){
     const result=await signInWithSupabase(email,p,u);
     if(!result.ok){authError.textContent=authMessage(result.reason);return;}
    await enterApp();
     return;
   }
   const a=JSON.parse(localStorage.getItem('icecreamHouseAccount')||'null');
  if(!a){authError.textContent='Create an account first.';return;}
  if(a.username!==u||a.email!==email||a.password!==p){authError.textContent='Username, email, or password does not match.';return;}
   localStorage.setItem('icecreamHouseSession',u);
  await enterApp();
   return;
 }
 if(supabaseEnabled()){
  const result=await signUpWithSupabase(u,email,p,hint);
  if(!result.ok){authError.textContent=result.reason==='ACCOUNT_CONFIRMATION_REQUIRED'?'Check your email and click the Supabase verification link, then sign in here.':result.reason.includes('already')||result.reason.includes('exists')?'That username is already in use.':authMessage(result.reason);return;}
   authScreen.classList.add('is-hidden');
   init();
   return;
 }
 const existing=JSON.parse(localStorage.getItem('icecreamHouseAccount')||'null');
 if(existing && existing.username.toLowerCase()===u.toLowerCase()){authError.textContent='That account name already exists on this device.';return;}
 localStorage.setItem('icecreamHouseAccount',JSON.stringify({username:u,email,password:p,hint}));
 localStorage.setItem('icecreamHouseSession',u);
 authScreen.classList.add('is-hidden');
 init();
};
$('logoutButton').onclick=()=>{
 clearSessionData();
 const client=getSupabaseClient();
 if(client)client.auth.signOut();
 authForm.reset();
 authError.textContent='';
 usernameInput.value='';
 emailInput.value='';
 passwordInput.value='';
 hintInput.value='';
 authMode(false);
 authScreen.classList.remove('is-hidden');
};
$('forgotButton').onclick=()=>{
 const a=JSON.parse(localStorage.getItem('icecreamHouseAccount')||'null');
 authError.textContent=a?.hint?`Hint: ${a.hint}`:'No saved hint on this device.';
};
async function restoreSession(){
 const client=getSupabaseClient();
 if(client){
   const {data:{session}}=await client.auth.getSession();
   if(session){await enterApp();return;}
 }
 if(localStorage.getItem('icecreamHouseSession')){authScreen.classList.add('is-hidden');init();}
}
restoreSession();
renderUpcoming();
