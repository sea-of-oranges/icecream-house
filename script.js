const root=document.documentElement;
const $=id=>document.getElementById(id);
const authScreen=$('authScreen'),authForm=$('authForm'),authError=$('authError'),authSubmit=$('authSubmit'),usernameInput=$('usernameInput'),emailInput=$('emailInput'),passwordInput=$('passwordInput'),hintField=$('hintField'),hintInput=$('hintInput');
const session=()=>localStorage.getItem('icecreamHouseSession')||'guest';
const key=name=>`icecreamHouse:${session()}:${name}`;
const get=(name,fallback='')=>localStorage.getItem(key(name))??fallback;
let cloudSyncTimer=null;
let hdsbCalendarRefreshTimer=null;
const save=(name,value)=>{localStorage.setItem(key(name),value);queueCloudSync();};
const clearSessionData=()=>{
 localStorage.removeItem('icecreamHouseSession');
};
const normalizeUsername=value=>String(value||'').trim().replace(/\s+/g,' ').slice(0,30);
const localToday=()=>{const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;};
const authMessage=reason=>reason==='Email logins are disabled'?'Enable Authentication > Providers > Email in your Supabase project.':reason==='Invalid login credentials'?'Username or password does not match.':reason;
const supabaseEnabled=()=>Boolean(window.supabase&&window.ICECREAM_SUPABASE_READY);
let supabaseClient=null;
const getSupabaseClient=()=>{
 if(!supabaseEnabled())return null;
 if(!supabaseClient)supabaseClient=window.supabase.createClient(window.ICECREAM_SUPABASE_URL,window.ICECREAM_SUPABASE_ANON_KEY,window.ICECREAM_SUPABASE_OPTIONS);
 return supabaseClient;
};
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
const hdsbSecondaryEvents=[
 {date:'2026-09-02',title:'PA day',type:'PA Day'},
 {date:'2026-09-03',title:'PA day',type:'PA Day'},
 {date:'2026-09-07',title:'Labour Day',type:'Holiday'},
 {date:'2026-09-08',title:'First day of instruction',type:'Secondary'},
 {date:'2026-10-09',title:'PA day',type:'PA Day'},
 {date:'2026-10-12',title:'Thanksgiving Day',type:'Holiday'},
 {date:'2026-11-27',title:'PA day',type:'PA Day'},
 {date:'2026-12-21',endDate:'2027-01-01',title:'Winter Break',type:'School holiday'},
 {date:'2027-01-28',endDate:'2027-02-03',title:'Semester 1 - Secondary Final Evaluation Block',type:'Secondary'},
 {date:'2027-02-05',title:'PA day',type:'PA Day'},
 {date:'2027-02-15',title:'Family Day',type:'Holiday'},
 {date:'2027-03-15',endDate:'2027-03-19',title:'March Break',type:'School holiday'},
 {date:'2027-03-26',title:'Good Friday',type:'Holiday'},
 {date:'2027-03-29',title:'Easter Monday',type:'Holiday'},
 {date:'2027-04-19',title:'PA day',type:'PA Day'},
 {date:'2027-05-24',title:'Victoria Day',type:'Holiday'},
 {date:'2027-06-22',endDate:'2027-06-28',title:'Semester 2 - Secondary Final Evaluation Block',type:'Secondary'},
 {date:'2027-06-29',title:'Last day of instruction for secondary students',type:'Secondary'}
];
const hdsbEventsOnDate=date=>hdsbSecondaryEvents.filter(event=>event.date<=date&&(event.endDate||event.date)>=date).map(event=>({label:event.title,category:event.type}));
const categoryPalette={Personal:{bg:'rgba(139,92,246,0.18)',color:'#8b5cf6'},Birthday:{bg:'rgba(244,114,182,0.18)',color:'#ec4899'},'School event':{bg:'rgba(59,130,246,0.18)',color:'#2563eb'},'Club event':{bg:'rgba(16,185,129,0.18)',color:'#10b981'},Health:{bg:'rgba(34,197,94,0.18)',color:'#22c55e'},Lessons:{bg:'rgba(250,226,142,0.28)',color:'#b08a16'},Homework:{bg:'rgba(251,191,36,0.18)',color:'#f59e0b'},Study:{bg:'rgba(168,85,247,0.18)',color:'#a855f7'},Social:{bg:'rgba(249,115,22,0.18)',color:'#f97316'},Appointment:{bg:'rgba(239,68,68,0.18)',color:'#ef4444'},Holiday:{bg:'rgba(139,92,246,0.18)',color:'#8b5cf6'},'PA Day':{bg:'rgba(59,130,246,0.18)',color:'#2563eb'},'School holiday':{bg:'rgba(239,68,68,0.18)',color:'#ef4444'},Secondary:{bg:'rgba(16,185,129,0.18)',color:'#10b981'}};
  categoryPalette['Exams/tests']={bg:'rgba(222,158,55,0.2)',color:'#c88322'};
const escape=s=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const siteUpdates=[{version:'1.1',date:'October 17, 2026',items:[
 'Added a daily mood check-in with illustrated faces and mood markers in the monthly calendar.',
 'Added a Songs player for the supplied audio files, with a playlist and playback controls.',
 'Added a full-width white noise player to Home.',
 'Moved theme colors above Songs and White noise, and placed those sections above Background Studio and Personalize.',
 'On wide landscape screens, the clock and weather stay on the left while the welcome text and HDSB calendar sit on the right.',
 'Removed the two welcome-screen buttons and enlarged the greeting and description without changing the headline size.',
 'Made the Home background glow match each selected theme color.',
 'Added a Study workspace with course pages, notes, assessment records, grade estimates, and a multi-course progress chart.',
 'Updated the HDSB secondary calendar, added daily refresh, and made monthly calendar task lists scrollable.',
 'Prioritized Exams/tests tasks in daily tasks and the monthly calendar.',
 'Opened Quick Note and the Pomodoro timer as separate screens with a Back home option.',
 'Added an Updates panel for website changes and fixes.'
]}];
function renderUpdates(){
 $('updatesContent').innerHTML=siteUpdates.map(update=>`<article class="update-entry"><div class="update-entry-heading"><strong>Version ${escape(update.version)}</strong><time>${escape(update.date)}</time></div><ul>${update.items.map(item=>`<li>${escape(item)}</li>`).join('')}</ul></article>`).join('');
}
function setUpdatesOpen(open,restoreFocus=false){
 $('updatesPopover').hidden=!open;
 $('updatesTrigger').setAttribute('aria-expanded',String(open));
 if(open)$('updatesClose').focus();
 else if(restoreFocus)$('updatesTrigger').focus();
}
const moodChoices=[
 ['happy','Happy','mood-faces/happy.png'],
 ['overwhelmed','Overwhelmed','mood-faces/overwhelmed.png'],
 ['excited','Excited','mood-faces/excited.png'],
 ['surprised','Surprised','mood-faces/surprised.png'],
 ['silly','Silly','mood-faces/silly.png'],
 ['playful','Playful','mood-faces/playful.png'],
 ['calm','Calm','mood-faces/calm.png'],
 ['nervous','Nervous','mood-faces/nervous.png'],
 ['worried','Worried','mood-faces/worried.png'],
 ['content','Content','mood-faces/content.png'],
 ['frustrated','Frustrated','mood-faces/frustrated.png']
];
const songFiles=[
 'Milky Day _ Denise Julia - Let Me_L.ogg',
 'f0rest - Spring_L.ogg',
 '林拿巴 - 怎么了 (Live中韩双语版)_L.ogg',
 '周深 - 星昼_L.ogg',
 'John Concepcion _ Vinsint - HITMYLINE (Explicit)_L.ogg',
 'Jigoooo Radio - It’s Okay Today_L.ogg',
 'Holly Humberstone - London Is Lonely_L.ogg',
 '周深 - 相爱恨早_L.ogg',
 'Feeloka - Washed Away_L.ogg',
 '玉香超级甜 - 江皓南 (般配)_L.ogg',
 'Justin Peng - For Good (Chinese Version)_L.ogg',
 'Zy - love beat (爱的心跳)_L.ogg',
 '周深 - 今天的我们_L.ogg',
 'Anson Seabra - Broken_L.ogg',
 '周深 - 情非得已 (2025 9_29Hz世界巡回演唱会·多伦多站现场)_L.ogg',
 'Galdive - Dormer_L.ogg',
 'midnight - Absolute Reprise_L.ogg'
];
const songs=songFiles.map(file=>{
 const name=file.replace(/_L\.ogg$/,'');
 const separator=name.indexOf(' - ');
 return {file,title:separator>=0?name.slice(separator+3):name,artist:separator>=0?name.slice(0,separator):''};
});
let currentSongIndex=0;
function setMoodOpen(open,restoreFocus=false){
 $('moodPopover').hidden=!open;
 $('moodTrigger').setAttribute('aria-expanded',String(open));
 if(open)$('moodClose').focus();
 else if(restoreFocus)$('moodTrigger').focus();
}
function renderMoodPicker(){
 const selected=get(`mood:${localToday()}`);
 const mood=moodChoices.find(([id])=>id===selected);
 $('moodTriggerImage').hidden=!mood;
 if(mood)$('moodTriggerImage').src=mood[2];
 $('moodTrigger').setAttribute('aria-label',mood?`Mood today: ${mood[1]}. Change mood`:'Choose your mood today');
 $('moodOptions').innerHTML=moodChoices.map(([id,label,image])=>`<button class="mood-option${id===selected?' is-selected':''}" type="button" data-mood="${id}" aria-label="${label}" aria-pressed="${id===selected}"><img src="${image}" alt="" /><span>${label}</span></button>`).join('');
 $('moodMessage').textContent=mood?`Today you feel ${mood[1].toLowerCase()}. You can change it anytime.`:'Choose the face that feels closest.';
}
function renderSongPlaylist(){
 $('songCount').textContent=`${songs.length} songs`;
 $('songPlaylist').innerHTML=songs.map((song,index)=>`<button class="song-track${index===currentSongIndex?' is-current':''}" type="button" data-song-index="${index}" aria-current="${index===currentSongIndex?'true':'false'}"><span class="song-track-number">${String(index+1).padStart(2,'0')}</span><span class="song-track-copy"><strong>${escape(song.title)}</strong><small>${escape(song.artist)}</small></span><span class="song-track-play" aria-hidden="true">${index===currentSongIndex?'♫':'▶'}</span></button>`).join('');
}
function selectSong(index,autoplay=false){
 if(!Number.isInteger(index)||index<0||index>=songs.length)return;
 currentSongIndex=index;
 const song=songs[index],audio=$('songAudio');
 $('songArtist').textContent=song.artist;
 $('songTitle').textContent=song.title;
 $('songStatus').textContent=autoplay?'Loading song…':'Ready to play.';
 audio.src=`audio/${encodeURIComponent(song.file)}`;
 audio.load();
 renderSongPlaylist();
 save('songIndex',String(index));
 if(autoplay)audio.play().then(()=>{$('songStatus').textContent=`Playing ${song.title}`;}).catch(()=>{$('songStatus').textContent='Could not start playback. Press play on the audio controls to try again.';});
}
function setupSongPlayer(){
 const savedIndex=Number(get('songIndex','0'));
 currentSongIndex=Number.isInteger(savedIndex)&&savedIndex>=0&&savedIndex<songs.length?savedIndex:0;
 $('songPlaylist').onclick=event=>{
  const item=event.target.closest('[data-song-index]');
  if(item)selectSong(Number(item.dataset.songIndex),true);
 };
 $('previousSong').onclick=()=>selectSong((currentSongIndex+songs.length-1)%songs.length,true);
 $('nextSong').onclick=()=>selectSong((currentSongIndex+1)%songs.length,true);
 $('songAudio').onended=()=>selectSong((currentSongIndex+1)%songs.length,true);
 $('songAudio').onplay=()=>{$('songStatus').textContent=`Playing ${songs[currentSongIndex].title}`;};
 $('songAudio').onerror=()=>{$('songStatus').textContent='This song could not be loaded. Check that its audio file is available.';};
 selectSong(currentSongIndex);
}
const getEvents=()=>{try{return JSON.parse(get('events','[]'));}catch{return [];}};
const getEventId=(event)=>String(event.id||`${event.date||selectedDate}-${event.name||'event'}-${event.category||'Personal'}`).replace(/^event:/,'');
const eventRepeats=event=>event.repeatEnabled!==false&&Boolean(event.repeat)&&event.repeat!=='none';
const eventDoneOnDate=(event,date)=>eventRepeats(event)?(event.doneDates||[]).includes(date):Boolean(event.done);
const setEventDoneOnDate=(event,date,done)=>{if(eventRepeats(event)){const dates=new Set(event.doneDates||[]);if(done)dates.add(date);else dates.delete(date);event.doneDates=[...dates];}else event.done=done;};
const dateParts=date=>{const [year,month,day]=String(date).split('-').map(Number);return new Date(Date.UTC(year,month-1,day));};
const isExamTask=task=>String(task.category||'').toLowerCase()==='exams/tests';
const prioritizeExamTasks=tasks=>[...tasks].sort((a,b)=>Number(isExamTask(b))-Number(isExamTask(a)));
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
  done:eventDoneOnDate(event,date),
   source:'event',
   category:event.category||'Personal'
 }));
 return prioritizeExamTasks([...calendarEvents, ...upcoming, ...saved.filter(task => task.source !== 'event' && task.source !== 'upcoming')]);
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
  getEvents().filter(event=>eventOccursOnDate(event,date)).forEach(event=>calendar.push({id:`event:${getEventId(event)}:${date}`,title:event.name,dueDate:date,category:event.category||'Personal',done:eventDoneOnDate(event,date),kind:'event',eventId:getEventId(event)}));
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
  const upcomingCategory=$('upcomingCategory');
  [category,upcomingCategory].forEach(select=>{if(select&&!Array.from(select.options).some(option=>option.value==='Exams/tests'))select.add(new Option('Exams/tests','Exams/tests'));});
const accentPicker=document.querySelector('.accent-picker');

// 1. Adds the Gold swatch
if(accentPicker&&!accentPicker.querySelector('[data-accent="gold"]')){
  const goldSwatch=document.createElement('button');
  goldSwatch.type='button';
  goldSwatch.className='swatch';
  goldSwatch.dataset.accent='gold';
  goldSwatch.title='Warm gold theme';
  goldSwatch.setAttribute('aria-label','Warm gold theme');
  accentPicker.insertBefore(goldSwatch,accentPicker.querySelector('[data-accent="classic"]'));
}

// 2. Adds the Pink swatch
if(accentPicker&&!accentPicker.querySelector('[data-accent="pink"]')){
  const pinkSwatch=document.createElement('button');
  pinkSwatch.type='button';
  pinkSwatch.className='swatch';
  pinkSwatch.dataset.accent='pink';
  pinkSwatch.title='Pink theme';
  pinkSwatch.setAttribute('aria-label','Pink theme');
  accentPicker.insertBefore(pinkSwatch,accentPicker.querySelector('[data-accent="classic"]'));
}

// 3. Binds the click event to all swatches (leave this as is)
document.querySelectorAll('.swatch').forEach(b=>b.onclick=()=>{
  root.dataset.accent=b.dataset.accent;
  save('accent',b.dataset.accent);
});

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
function renderSchool(){
 const list=$('calendarList');
 const startDate=localToday();
 const formatDate=date=>new Date(`${date}T12:00:00`).toLocaleDateString([],{month:'short',day:'numeric'});
 $('hdsbCalendarRange').textContent='Upcoming';
 const visibleEvents=hdsbSecondaryEvents.filter(event=>(event.endDate||event.date)>=startDate).sort((a,b)=>a.date.localeCompare(b.date));
 list.innerHTML=visibleEvents.map(event=>`<li><div><strong>${escape(event.title)}</strong><span>${formatDate(event.date)}${event.endDate?` – ${formatDate(event.endDate)}`:''}</span></div><em>${escape(event.type)}</em></li>`).join('');
 if(hdsbCalendarRefreshTimer)clearTimeout(hdsbCalendarRefreshTimer);
 const nextRefresh=new Date();
 nextRefresh.setHours(24,0,0,0);
 hdsbCalendarRefreshTimer=setTimeout(renderSchool,Math.max(1,nextRefresh.getTime()-Date.now()));
}
function renderMonth(){const y=viewDate.getFullYear(),m=viewDate.getMonth(),start=(new Date(y,m,1).getDay()+6)%7; $('monthLabel').textContent=viewDate.toLocaleDateString([],{month:'long',year:'numeric'});$('monthGrid').innerHTML=Array.from({length:42},(_,i)=>{const d=new Date(y,m,i-start+1),k=d.toISOString().slice(0,10),out=d.getMonth()!==m,tasks=[...getDailyTaskItems(k),...hdsbEventsOnDate(k)],mood=moodChoices.find(([id])=>id===get(`mood:${k}`));return `<button class="calendar-day ${out?'muted':''} ${k===selectedDate?'selected':''}" data-date="${k}" aria-label="${d.toLocaleDateString([],{month:'long',day:'numeric'})}${mood?`, mood: ${mood[1]}`:''}"><span class="day-top"><span class="day-number">${d.getDate()}</span>${mood?`<img class="day-mood" src="${mood[2]}" alt="" title="${mood[1]}" />`:''}</span><span class="day-events">${tasks.map(task=>eventTag(task.label,task.category||'Holiday')).join('')}</span></button>`}).join('');document.querySelectorAll('.calendar-day:not(.muted)').forEach(b=>b.onclick=()=>selectDate(b.dataset.date));}
const displayDate=date=>String(date).replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$1/$2/$3');
const parseTypedDate=value=>{const match=String(value).trim().match(/^(\d{4})\/(\d{2})\/(\d{2})$/);if(!match)return null;const candidate=`${match[1]}-${match[2]}-${match[3]}`,parsed=dateParts(candidate);return parsed.toISOString().slice(0,10)===candidate?candidate:null;};
function selectDate(date){selectedDate=date||selectedDate;dailyDateDisplay.value=displayDate(selectedDate);$('dailyDateLabel').textContent=selectedDate===localToday()?'Today':new Date(`${selectedDate}T12:00`).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'});renderTasks('daily');document.querySelectorAll('.calendar-day').forEach(b=>b.classList.toggle('selected',b.dataset.date===selectedDate));}
function renderTasks(group){const storage=group==='daily'?`dailyTasks:${selectedDate}`:'weeklyTasks',tasks=group==='daily'?getDailyTaskItems(selectedDate):JSON.parse(get(storage,'[]'));const list=$(group==='daily'?'dailyTaskList':'weeklyTaskList');list.innerHTML=tasks.map(t=>`<li><input type="checkbox" data-id="${t.id}" data-source="${t.source||'task'}" ${t.done?'checked':''}><span class="${t.done?'done':''}">${escape(t.label)}</span><button class="delete-task" data-delete="${t.id}" data-source="${t.source||'task'}" data-date="${selectedDate}">×</button></li>`).join('');$(group==='daily'?'dailyCount':'weeklyCount').textContent=`${tasks.filter(t=>!t.done).length} left`;}
function addTask(group){const input=$(group==='daily'?'dailyTaskInput':'weeklyTaskInput'),storage=group==='daily'?`dailyTasks:${selectedDate}`:'weeklyTasks',tasks=JSON.parse(get(storage,'[]'));if(!input.value.trim())return;if(group==='daily'&&selectedDate>localToday()){const upcoming=getExplicitUpcomingTasks();upcoming.push({id:Date.now(),title:input.value.trim(),dueDate:selectedDate,category:'Personal',done:false});save('upcomingTasks',JSON.stringify(upcoming));renderUpcoming();}else{tasks.push({id:Date.now(),label:input.value.trim(),done:false});save(storage,JSON.stringify(tasks));}input.value='';renderTasks(group);}
function weatherInfo(code){if([95,96,99].includes(code))return['⛈️','Storm watch','Stormy conditions are possible today.'];if([51,53,55,61,63,65,80,81,82].includes(code))return['🌧️','Rain likely','Rain is in the forecast today.'];if([71,73,75,85,86].includes(code))return['❄️','Snow likely','Snow is in the forecast today.'];if(code>2)return['☁️','Cloudy','A peaceful cloudy day.'];return['☀️','Clear skies','A peaceful day. Enjoy the light.'];}
async function loadWeather(){try{const p=new URLSearchParams({latitude:43.45,longitude:-79.68,timezone:'America/Toronto',forecast_days:1,current:'temperature_2m,weather_code',daily:'weather_code,temperature_2m_max,sunrise,sunset'}),r=await fetch(`https://api.open-meteo.com/v1/forecast?${p}`),x=await r.json(),d=x.daily,c=weatherInfo(x.current.weather_code);$('weatherIcon').textContent=c[0];$('weatherTemperature').textContent=`${Math.round(x.current.temperature_2m)}°C`;$('weatherSummary').textContent=`${c[1]} · high ${Math.round(d.temperature_2m_max[0])}°C`;$('sunriseTime').textContent=new Date(d.sunrise[0]).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});$('sunsetTime').textContent=new Date(d.sunset[0]).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});$('weatherNote').textContent=c[2];}catch{$('weatherSummary').textContent='Weather unavailable';$('weatherNote').textContent='A peaceful day while we reconnect.';}}
function updateClock(){const now=new Date(),d=new Date(now);if(customClock)d.setHours(...customClock.split(':').map(Number));const format={hour:'2-digit',minute:'2-digit',hour12:$('clockFormat').value==='12'};$('flipClock').textContent=d.toLocaleTimeString([] ,format);$('topbarTime').textContent=now.toLocaleTimeString([] ,format);$('flipClock').classList.add('flip');setTimeout(()=>$('flipClock').classList.remove('flip'),300);$('dateDisplay').textContent=now.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'});}
function setupWorkspace(){
 const main=$('workspaceMain');
 const sections=[...main.querySelectorAll(':scope > section')];
 // Add 'personal' to the pages object
 const pages={home:document.createElement('div'),calendar:document.createElement('div'),study:document.createElement('div'),tools:document.createElement('div'),personal:document.createElement('div'),addon:document.createElement('div')};
 
 for(const [name,page] of Object.entries(pages)){
   page.className=`workspace-view workspace-view-${name}`;
   page.dataset.workspacePage=name;
   if(name==='addon')page.hidden=true;
   else if(name!=='home')page.hidden=true;
 }
 
 for(const section of sections){
   // Update routing to catch 'personalWorkspace'
   const destination=section.id==='top'||section.id==='customize'||section.classList.contains('background-studio')?'home':section.id==='planner'||section.id==='upcoming'?'calendar':section.id==='tools'?'tools':section.id==='studyWorkspace'?'study':section.id==='personalWorkspace'?'personal':section.id==='timerPage'||section.id==='quickNotePage'?'addon':'home';
   pages[destination].append(section);
 }
 main.replaceChildren(pages.home,pages.calendar,pages.study,pages.tools,pages.personal,pages.addon);
 document.querySelectorAll('[data-workspace-view]').forEach(link=>link.addEventListener('click',event=>{
   event.preventDefault();
   showPage(link.dataset.workspaceView,true);
 }));
}
function showPage(page,addHistory=false){
 const isAddon=page==='timer'||page==='quick-note',workspacePage=isAddon?'addon':page;
 document.querySelectorAll('.workspace-view').forEach(view=>view.hidden=view.dataset.workspacePage!==workspacePage);
 $('timerPage').hidden=page!=='timer';
 $('quickNotePage').hidden=page!=='quick-note';
 $('siteFooter').hidden=isAddon;
 $('workspaceMain').dataset.view=page;
 document.querySelectorAll('.sidebar-link').forEach(link=>link.classList.toggle('active',link.dataset.workspaceView===(isAddon?'tools':page)));
 if(addHistory)history.pushState({appPage:page},'',page==='home'?'#home':`#${page}`);
 if(page==='study')renderStudyView();
 window.scrollTo({top:0,behavior:'smooth'});
}
const studyCourseCatalog=['Math','English','Science','Geography','History','Food and Nutrition','Health Studies','Business','Chemistry','Biology','Physics','Medical Studies','Manufacturing','Design Technology','Computer Science','Communication Technology','Civics and Career Studies','Art','French','Music','Drama','Vocal','Physical Education','Accounting','Economics','Law','Environmental Science','Robotics','Photography','Dance'];
const studyAssessmentTypes=['Exam/Test','Quiz','Assignment'];
const studyChartColors=['#a78bfa','#60a5fa','#34d399','#fbbf24','#f472b6','#fb7185','#22d3ee','#c084fc','#a3e635','#f97316'];
let activeStudyCourse='',studyGradesView=false,studyEditingAssessment='',studySetupActive=false;
const studyCourseKey=course=>String(course||'').trim().toLocaleLowerCase();
const getStudyCourses=()=>{try{const courses=JSON.parse(get('studyCourses','[]'));return Array.isArray(courses)?courses.filter(course=>typeof course==='string'&&course.trim()):[];}catch{return [];}};
const getStudyGradebook=()=>{try{const data=JSON.parse(get('studyGradebook','{}'));return data&&typeof data==='object'?{assessments:Array.isArray(data.assessments)?data.assessments:[],weights:data.weights&&typeof data.weights==='object'?data.weights:{}}:{assessments:[],weights:{}};}catch{return {assessments:[],weights:{}};}};
const getStudyNotes=()=>{try{const notes=JSON.parse(get('studyCourseNotes','{}'));return notes&&typeof notes==='object'?notes:{};}catch{return {};}};
function renderCoursePicker(values=Array(4).fill('')){
 const list=$('studyCoursePickerList');
 list.innerHTML=values.map((course,index)=>`<label class="study-course-picker-row"><span>Course ${index+1}</span><input class="study-course-search" type="search" list="studyCourseOptions" value="${escape(course)}" placeholder="Search or type a course" autocomplete="off" aria-label="Course ${index+1}"></label>`).join('');
}
function assessmentPercent(assessment){const score=Number(assessment.score),outOf=Number(assessment.outOf);return outOf>0?Math.max(0,Math.min(100,score/outOf*100)):0;}
function courseGrade(course,gradebook=getStudyGradebook()){
 const assessments=gradebook.assessments.filter(item=>studyCourseKey(item.course)===studyCourseKey(course));
 if(!assessments.length)return null;
 const stored=gradebook.weights[studyCourseKey(course)]||{};
 const available=studyAssessmentTypes.map(type=>{
   const marks=assessments.filter(item=>item.type===type);
   return marks.length?{type,average:marks.reduce((sum,item)=>sum+assessmentPercent(item),0)/marks.length,weight:Math.max(0,Number(stored[type]??(100/studyAssessmentTypes.length)))}:null;
 }).filter(Boolean);
 const weightTotal=available.reduce((sum,item)=>sum+item.weight,0);
 if(!weightTotal)return null;
 return available.reduce((sum,item)=>sum+item.average*item.weight,0)/weightTotal;
}
const formatGrade=grade=>grade===null?'—':`${grade.toFixed(1)}%`;
function courseStudyFeatures(course){
 const name=studyCourseKey(course);
 if(name.includes('math'))return [['Formula lab','Learn to connect a formula to the situation it models.'],['Solve like a mathematician','Use a repeatable plan to make word problems manageable.'],['Mistake detective','Turn a wrong answer into a useful clue about what to practise.']];
 if(name.includes('english'))return [['Evidence explorer','Choose quotations that actually support an interpretation.'],['Build a stronger argument','Shape a clear claim and connect each point to evidence.'],['Word power','Learn vocabulary in context so it sticks and transfers.']];
 if(name==='science'||/chem|biolog|physics|medical|environmental/.test(name))return [['Explain the big idea','Use a simple explanation to check if a concept really makes sense.'],['Equations decoded','Track units and reason through a formula instead of memorizing symbols.'],['Think like a scientist','Connect a fair test, evidence, and conclusion.']];
 if(/geo|geography/.test(name))return [['Read the map','Spot scale, patterns, and clues in a map or data display.'],['Build a case study','Explain a place-based issue through causes and impacts.'],['Geography vocabulary','Make precise terms easier to remember and apply.']];
 if(/history|civics|career|law/.test(name))return [['Cause-and-effect timeline','Trace how events connect instead of memorizing dates alone.'],['Check the evidence','Read a source for its claim, context, and limits.'],['People, power & perspective','Compare viewpoints and explain why they differ.']];
 if(/physical education/.test(name))return [['Movement science','Connect movement, muscles, and the forces that affect performance.'],['Train with a goal','Use a specific skill goal and safe practice progression.'],['Performance replay','Review what happened and choose one adjustment for next time.']];
 if(/food|nutrition|health/.test(name))return [['Separate claim from evidence','Evaluate health and nutrition information carefully.'],['Reflect on a practical','Connect a hands-on choice to the science or skill behind it.'],['Remember the key terms','Build useful vocabulary by explaining it from memory.']];
 if(/business|account|economic/.test(name))return [['Unpack a business case','Use a clear framework to reason through a real-world scenario.'],['Make concepts concrete','Connect business and economics terms to examples.'],['Numbers with meaning','Check calculations, units, and what a result implies.']];
 if(/computer|communication|design|manufactur|robot|tech/.test(name))return [['Design, test, improve','Use a simple iteration loop to make a project stronger.'],['Document your process','Capture decisions so your work is explainable and repeatable.'],['Debug with a plan','Find the cause of a problem instead of changing everything at once.']];
 if(/french/.test(name))return [['Make vocabulary stick','Use short recall sessions to build a useful word bank.'],['Spot the grammar pattern','Learn a rule by noticing how it works in examples.'],['Speak with confidence','Practise retrieving language in a low-pressure way.']];
 if(/art|music|drama|vocal|dance|photo/.test(name))return [['Practise with purpose','Break a creative skill into small, focused repetitions.'],['Look closer','Notice and name the choices that make a work effective.'],['Create, get feedback, revise','Use reflection to turn a first attempt into a stronger one.']];
 return [['Make the idea click','Explain a topic simply, then check what is still unclear.'],['Practise on purpose','Use a small goal and specific feedback to make progress.'],['Build a review loop','Return to important ideas before they fade.']];
}
function studyToolLessons(course){
 const name=studyCourseKey(course);
 if(name.includes('math'))return [
  {idea:'A formula is a relationship, not a spell. Identify what each variable represents and when the relationship applies.',steps:['Name the quantity you need to find.','List the known values and match each one to a variable.','Substitute with units, then check whether the answer is reasonable.'],challenge:'A rectangle is 8 cm long and 3 cm wide. Which formula finds its area, and what is the result?',answer:'Area = length × width, so 8 × 3 = 24 cm². Area uses square units.',tip:'Before calculating, estimate the size of your answer. A quick estimate is an excellent error detector.'},
  {idea:'Strong problem solving makes the reasoning visible. A consistent plan helps you choose a method instead of guessing.',steps:['Translate the question into a diagram, table, or equation.','Choose a strategy and show each step.','Check by substituting back, estimating, or using a second method.'],challenge:'A $40 item is discounted by 25%. What is the sale price?',answer:'25% of $40 is $10, so the sale price is $40 − $10 = $30. You can also calculate 0.75 × $40.',tip:'If you are stuck, solve a simpler version first. The pattern often reveals the next step.'},
  {idea:'An error is evidence about your thinking, not a verdict about your ability. Finding its cause helps you choose what to practise next.',steps:['Find the first line where your work stops matching the correct method.','Name the error type: concept, setup, arithmetic, or notation.','Try a similar question without looking at the correction.'],challenge:'You solve 3(x + 2) = 15 as 3x + 2 = 15. What step went wrong?',answer:'The 3 must multiply both terms inside the parentheses: 3(x + 2) = 3x + 6. Distributing only to x caused the error.',tip:'Keep a short “what fooled me / what I’ll check next time” note. Review it before similar questions.'}
 ];
 if(name.includes('english'))return [
  {idea:'A quotation is useful when it acts as evidence for an interpretation. Context helps readers see why the detail matters.',steps:['Make a specific point in your own words.','Choose a short quotation that directly supports it.','Explain how a word or image in the quote proves your point.'],challenge:'A character says, “I kept the light on.” What extra context would you need before interpreting this as hope?',answer:'Find out what happened before and after the line, who says it, and what the light means in the text. The same image can suggest hope, fear, or a literal action.',tip:'Use a quotation sandwich: introduce the context, include a short quote, then explain the connection to your claim.'},
  {idea:'A persuasive paragraph links a claim to evidence and then explains the reasoning. The explanation is where your analysis becomes yours.',steps:['Write a debatable claim that answers the question.','Give one focused reason and evidence for it.','Explain the evidence, then connect the point to your main argument.'],challenge:'Turn “The setting is important” into a more specific claim.',answer:'For example: “The isolated setting increases the character’s uncertainty because it removes the usual sources of help.” A strong claim says what the setting does and why.',tip:'After every piece of evidence, ask “So what?” Your answer is often the beginning of analysis.'},
  {idea:'Vocabulary is easier to remember when you retrieve it and use it in a meaningful sentence, not just reread a definition.',steps:['Read the word in its original sentence.','Cover the definition and explain the word from memory.','Write a new sentence that shows its meaning clearly.'],challenge:'Use “reluctant” to describe a character without using the words “unwilling” or “hesitant.”',answer:'Example: “Mina paused at the doorway, reluctant to leave her friends behind.” The action gives the reader a clue to the word’s meaning.',tip:'Group new words by topic or by shades of meaning, then test yourself in both directions: word → meaning and meaning → word.'}
 ];
 if(name==='science'||/chem|biolog|physics|medical|environmental/.test(name))return [
  {idea:'If you can explain a concept in plain language and give an example, you are moving beyond memorized vocabulary toward understanding.',steps:['State the idea in one clear sentence.','Draw or describe a model that shows what is happening.','Add an example and one question that tests the limits of your explanation.'],challenge:'Explain why a plant needs light using a cause-and-effect chain, not just “for photosynthesis.”',answer:'Light provides energy that plants use in photosynthesis to make sugars from carbon dioxide and water; those sugars store energy and supply material for growth.',tip:'Try the Feynman technique: explain from memory, notice the gaps, check a reliable source, then explain again more simply.'},
  {idea:'Equations describe relationships between quantities. Units can reveal whether you chose the right equation and whether your answer makes sense.',steps:['Write down the target quantity and its unit.','List known values with units and identify the matching relationship.','Substitute carefully and check that the final unit fits the question.'],challenge:'A runner travels 150 metres in 30 seconds. What is the average speed, including units?',answer:'Average speed = distance ÷ time = 150 m ÷ 30 s = 5 m/s. Metres per second is the correct unit for speed.',tip:'Do not memorize an equation as bare letters. Say what each symbol means and how changing one quantity affects another.'},
  {idea:'A useful experiment changes one factor at a time, measures an outcome, and uses evidence to answer a focused question.',steps:['Write a testable question and prediction.','Identify the independent variable, dependent variable, and controls.','Repeat measurements when possible and use the results to evaluate the prediction.'],challenge:'You test whether fertilizer affects plant height. Name one variable to change, one to measure, and one to keep constant.',answer:'Change: fertilizer amount/type. Measure: plant height after a set time. Keep constant: plant species, light, water, soil, and pot size.',tip:'A conclusion should refer to the results you measured; it should not claim more than the experiment can show.'}
 ];
 if(/geo|geography/.test(name))return [
  {idea:'Maps are models of places. Scale, legend, orientation, and source shape what the map can tell you.',steps:['Read the title and legend before interpreting patterns.','Check scale, units, and date/source of the data.','Describe a pattern and support it with a location or data point.'],challenge:'A map shows darker shading in the north. What should you check before saying the north has more of something?',answer:'Check the legend to learn what darker shading means, plus the map’s date, units, and data source. Darker colour only means “more” if the key says so.',tip:'Use precise spatial language—north of, along the coast, clustered near—rather than “over there.”'},
  {idea:'A strong case study connects a specific place to processes, people, causes, and impacts.',steps:['Name the place and the issue clearly.','Explain at least one cause using a geographic process.','Connect the process to impacts on people or environments, using evidence.'],challenge:'A city experiences more street flooding after heavy rain. Give one possible physical cause and one possible human factor.',answer:'A physical cause could be intense rainfall; a human factor could be extensive pavement that prevents water from soaking into the ground. Local evidence is needed to decide their importance.',tip:'Build a small bank of precise place details—one statistic, named location, or example—rather than trying to memorize a whole case study.'},
  {idea:'Geography terms help you describe patterns accurately. Learning them in a real example makes them easier to retrieve.',steps:['Write a short definition in your own words.','Add a diagram, place, or example that shows it.','Try using the term to explain a new pattern.'],challenge:'What is the difference between weather and climate?',answer:'Weather describes short-term atmospheric conditions; climate summarizes typical patterns over a much longer period, usually decades.',tip:'Make two-way flashcards: term to meaning, and a real example to the term it demonstrates.'}
 ];
 if(/history|civics|career|law/.test(name))return [
  {idea:'Timelines are most useful when they show connections. Chronology helps you see what changed, what continued, and what may have influenced later events.',steps:['Place events in order and identify turning points.','Add a cause and consequence for each major event.','Look for continuity, change, and links across the timeline.'],challenge:'An event happens after a new law is passed. Does that alone prove the law caused the event?',answer:'No. Sequence is not proof of causation. Look for evidence of a mechanism, consider other causes, and compare what happened in similar situations.',tip:'Use “because,” “therefore,” and “however” to test whether your explanation shows causation or only lists events.'},
  {idea:'Sources are made by people for a purpose and in a context. Evaluating a source means asking what it can show and what it cannot.',steps:['Identify who made it, when, and for what audience.','Separate the source’s claim from the evidence it provides.','Compare it with another perspective or source before drawing a conclusion.'],challenge:'A campaign poster says a new policy will solve every problem. What should you investigate?',answer:'Who produced it, who they hoped to persuade, what evidence they use, what they leave out, and how independent sources describe the policy.',tip:'A biased source can still be useful evidence—for example, evidence of what its creator wanted people to believe.'},
  {idea:'Different perspectives can reflect different experiences, interests, and access to power. Comparing them reveals complexity.',steps:['Name the viewpoint and whose interests it represents.','Find evidence for how that person or group experienced the issue.','Explain a similarity or difference without treating one view as universal.'],challenge:'Two groups disagree about a city project. Name one kind of impact each group might care about.',answer:'Nearby residents might focus on noise, housing, or access; local businesses might focus on customers and costs. The actual views depend on evidence from those groups.',tip:'Avoid “everyone thought…” unless your sources support it. Be specific about which people, when, and where.'}
 ];
 if(/physical education/.test(name))return [
  {idea:'Movement can be analyzed by noticing body position, force, and the result. A small observation can make practice more intentional.',steps:['Choose one movement skill and a clear outcome.','Notice one technique detail, such as balance, timing, or follow-through.','Practise again while focusing on that one detail.'],challenge:'A basketball shot repeatedly falls short. Name one technique detail to observe before changing everything.',answer:'Observe the leg drive and follow-through, among other possible factors. Use a coach’s guidance and change one detail at a time to see what helps.',tip:'Use safe warm-ups and progress gradually. If you feel pain or are unsure about an exercise, stop and ask a qualified teacher or coach.'},
  {idea:'A training goal is easier to work toward when it describes a controllable action and a way to notice progress.',steps:['Choose a skill you want to improve.','Set a small practice target and a safe progression.','Record what you did and how it felt or changed.'],challenge:'Rewrite “get better at running” as a specific practice goal for one session.',answer:'For example: “Practise steady pacing for 10 minutes and record how consistently I maintain it.” Adapt the duration to your ability and teacher’s guidance.',tip:'Progress is not only speed or scores; consistency, technique, teamwork, and recovery can matter too.'},
  {idea:'Reviewing a performance helps you carry learning into the next attempt. Focus on observations and one useful adjustment.',steps:['Describe what happened without judging yourself.','Identify one choice that helped and one moment to improve.','Pick one adjustment to test during the next practice.'],challenge:'Your team lost possession several times. What is a useful reflection question?',answer:'Ask what was happening just before possession changed—spacing, communication, or decision timing—and choose one skill to practise. Do not assume one cause without looking.',tip:'Ask for specific feedback from a teacher or coach, then choose one action you can practise.'}
 ];
 if(/food|nutrition|health/.test(name))return [
  {idea:'A confident health claim is not automatically a reliable claim. Check the evidence, the source, and whether the wording overpromises.',steps:['Find the original source and who is responsible for it.','Check whether evidence supports the exact claim, not just a related idea.','Look for date, context, limitations, and agreement with trusted public-health sources.'],challenge:'A post says one food “always boosts energy instantly.” What words should make you pause?',answer:'“Always” and “instantly” are absolute promises. Ask what evidence supports the claim, for whom it applies, and whether credible sources agree.',tip:'For personal medical decisions, use qualified health professionals and trusted public-health information rather than social-media advice.'},
  {idea:'Practical work builds skill when you notice the decisions behind the result. Reflection connects doing with understanding.',steps:['State the goal and the choice or technique you used.','Describe what happened using specific observations.','Explain one improvement and why it could help next time.'],challenge:'You are preparing a recipe and the result is too dry. Name one observation and one change you could test next time.',answer:'Observation: the finished texture was dry. Test one change—such as slightly less cooking time—while keeping other steps similar so you can see whether it helps.',tip:'Change one thing at a time during practice when you want to learn which adjustment made a difference.'},
  {idea:'Precise vocabulary makes it easier to explain health, nutrition, and food-science ideas accurately.',steps:['Define a term without copying the textbook sentence.','Connect it to a real example or process.','Use it in an explanation, then check that the meaning still fits.'],challenge:'Explain the difference between a nutrient and a food using your own words.',answer:'A nutrient is a substance the body uses for energy, growth, or normal function; a food is something eaten that may contain many different nutrients.',tip:'When two terms seem similar, write a “same / different” comparison. The contrast helps each definition stick.'}
 ];
 if(/business|account|economic/.test(name))return [
  {idea:'A case study gives you a situation to analyze, not just a story to retell. Connect decisions to evidence and outcomes.',steps:['Summarize the issue and the goal of the organization/person.','Identify the decision and the evidence available at that time.','Evaluate the outcome against the goal and consider a trade-off.'],challenge:'A shop lowers prices and sells more items, but total revenue falls. What might explain this?',answer:'The price reduction may have been larger than the increase in quantity sold. Revenue depends on price × quantity, so compare both before judging the result.',tip:'Separate what the case tells you from what you infer. Label assumptions when you make them.'},
  {idea:'A term becomes useful when you can recognize it in a new situation and explain why it fits.',steps:['Define the term in plain language.','Give one accurate example and one near-miss.','Explain the key difference between them.'],challenge:'A business has high sales but spends even more than it earns. Is it necessarily profitable?',answer:'No. Profit depends on revenue minus costs. High sales alone do not show that the business made a profit.',tip:'Create examples from everyday decisions—budgets, prices, trade-offs—then connect them to the formal vocabulary.'},
  {idea:'Calculations are tools for answering a question. Units, assumptions, and interpretation matter as much as the arithmetic.',steps:['Write the quantity you need and the units.','Choose the relationship and show the substitution.','Check the result, then explain what it means in context.'],challenge:'A product costs $12 to make and sells for $20. What is the profit per item before other costs?',answer:'$20 − $12 = $8 per item before other costs. State that limitation: other expenses could reduce the final profit.',tip:'Do a rough mental estimate first. If the calculated result is far from it, inspect the setup and units.'}
 ];
 if(/computer|communication|design|manufactur|robot|tech/.test(name))return [
  {idea:'Good design is iterative: create a solution, test it against a goal, and improve it using evidence.',steps:['Define who the solution is for and what success means.','Build a small prototype or first version.','Test one requirement, note the result, and choose the next improvement.'],challenge:'A phone stand must hold a phone upright and fit in a backpack. Name one test for each requirement.',answer:'Upright: place the phone in it and check stability at the intended angle. Portable: measure or compare its folded size with the backpack space.',tip:'Write the success criteria before building. Otherwise it is easy to confuse “looks finished” with “works well.”'},
  {idea:'Process notes make technical work easier to repeat, explain, and improve. Record decisions, not just a list of clicks.',steps:['Note the goal and starting conditions.','Record the key steps or settings that affect the result.','Capture what changed, what worked, and what you would do differently.'],challenge:'A project works on your computer but not another one. What environment details might you compare?',answer:'Compare software/tool versions, settings, file paths, permissions, hardware, and input data. Reproduce the issue before changing several things.',tip:'Save versions or checkpoints before major changes; that gives you a safe comparison and a way back.'},
  {idea:'Debugging is a process of testing explanations. A small, controlled test can reveal more than changing many things at once.',steps:['Describe the problem and the expected result.','Make the issue happen reliably and inspect the smallest relevant part.','Change one likely cause, test again, and record the outcome.'],challenge:'A lamp does not turn on. Give one safe first check before replacing parts.',answer:'Check whether it is plugged into a working outlet and whether the switch is on. In technical projects, start with the simplest likely causes and test safely.',tip:'When a fix works, note the cause and the test that confirmed it—not only the final change.'}
 ];
 if(/french/.test(name))return [
  {idea:'Vocabulary retrieval works best in small, repeated sessions. Try to recall a word before checking the translation.',steps:['Choose a small theme, such as food or school.','Look at the meaning and try to produce the French word from memory.','Use it in a new phrase and review it again later.'],challenge:'How could you practise the French word for “book” without just rereading it?',answer:'Cover the French word, recall it from “book,” say or write it, then use it in a short phrase and check your answer.',tip:'Mix older words into each short practice session so you keep retrieving them after time has passed.'},
  {idea:'Grammar patterns are easier to use when you compare examples and notice what changes, rather than memorizing a rule in isolation.',steps:['Read two or three examples that use the same pattern.','Mark what stays the same and what changes.','Create a new sentence and check it against the examples.'],challenge:'When learning adjective agreement, what parts of the sentence would you compare?',answer:'Compare the adjective with the noun it describes, including the noun’s gender and number, and check how the adjective form changes.',tip:'Keep one correct example beside a rule. Examples make abstract grammar easier to retrieve.'},
  {idea:'Speaking practice builds fluency by making language retrieval feel more familiar. Short, low-pressure repetitions count.',steps:['Pick a prompt you can answer in a few sentences.','Speak for 30 seconds without stopping to perfect every word.','Notice one missing phrase, learn it, and try the prompt again.'],challenge:'Give a simple three-part answer to “What did you do this weekend?”',answer:'Use a time phrase, an action, and a detail: “Samedi, j’ai joué au soccer avec mes amis.” Adapt the sentence to what you actually did.',tip:'Record yourself once, choose one thing to improve, then record again. Focused retries are more useful than judging every mistake.'}
 ];
 if(/art|music|drama|vocal|dance|photo/.test(name))return [
  {idea:'Deliberate practice focuses on one specific part of a skill, with feedback. Repeating the whole performance without a goal can reinforce the same habits.',steps:['Choose one small skill to improve.','Practise it slowly or in a short section.','Get feedback, adjust one thing, and try again.'],challenge:'You keep missing one transition in a performance. How could you make the next practice more focused?',answer:'Isolate the transition, slow it down, identify the exact moment that slips, practise that part, then return it to the full sequence.',tip:'End practice by naming one thing that improved and one next step. That makes tomorrow’s session easier to start.'},
  {idea:'Studying a creative reference means noticing choices and effects—not only deciding whether you like the work.',steps:['Describe what you notice without judging it.','Identify a technique or design choice.','Explain the effect it has and how you might adapt the idea.'],challenge:'A photograph feels dramatic. Name two visual choices that might create that effect.',answer:'Possible choices include strong light-dark contrast, a low camera angle, tight framing, or a diagonal composition. Point to what is actually visible in the image.',tip:'Use specific vocabulary for the medium—composition, rhythm, dynamics, gesture, or contrast—to sharpen your observations.'},
  {idea:'Revision is part of making. A clear goal and useful feedback can help you develop an idea without losing what makes it yours.',steps:['State what you want the audience to notice or feel.','Ask a focused question and gather feedback.','Choose one revision, then check whether it supports your intention.'],challenge:'A viewer says, “I got confused halfway through.” What follow-up question could help you revise?',answer:'Ask where they became confused and what information or transition they expected. Specific feedback points to a possible revision.',tip:'You do not have to use every suggestion. Compare feedback with your goal and explain your choice.'}
 ];
 return [
  {idea:'Explaining an idea from memory is a quick way to discover what you understand and what needs another look.',steps:['Choose one important idea and close your notes.','Explain it in simple language with an example.','Check your notes for gaps, then try the explanation once more.'],challenge:'Explain why practice questions can teach you more than rereading alone.',answer:'Practice questions make you retrieve and apply information. Checking answers then shows what you can recall and what still needs work.',tip:'Learning-science reviews identify practice testing and spaced practice as especially useful study strategies.'},
  {idea:'Practice gets more effective when the goal is small and the feedback is specific.',steps:['Choose one skill or question type.','Try a short example without looking at a solution.','Check one part of your work and choose the next practice step.'],challenge:'Replace “study science” with a goal you could complete in 15 minutes.',answer:'For example: “Draw the water cycle from memory, label each process, then check and correct it.” It has a clear action and a way to check progress.',tip:'A short, focused session is easier to repeat than waiting for a perfect block of free time.'},
  {idea:'A review loop helps you revisit ideas before they disappear. Spacing reviews gives your memory another chance to retrieve them.',steps:['After learning, do a quick recall check.','Return to the idea after a delay and retrieve it again.','Mix it with related topics once the basics are secure.'],challenge:'You learned a topic today. What is a simple way to review it tomorrow without rereading the whole chapter?',answer:'Write down or sketch everything you remember first, then compare with the chapter and correct the gaps.',tip:'Dunlosky et al. (2013) reviewed study techniques and highlighted practice testing and distributed practice among the more effective approaches.'}
 ];
}
function renderStudyCoursePicker(){
 const saved=getStudyCourses();
 $('studyCourseOptions').innerHTML=studyCourseCatalog.map(course=>`<option value="${escape(course)}"></option>`).join('');
 renderCoursePicker(saved.length?saved:Array(4).fill(''));
 $('studySetupMessage').textContent='';
}
function renderStudyCourseTabs(){
 const courses=getStudyCourses();
 if(!courses.some(course=>studyCourseKey(course)===studyCourseKey(activeStudyCourse)))activeStudyCourse=courses[0]||'';
 $('studyCourseTabs').innerHTML=courses.map(course=>`<button class="study-tab ${!studyGradesView&&studyCourseKey(course)===studyCourseKey(activeStudyCourse)?'active':''}" type="button" role="tab" aria-selected="${!studyGradesView&&studyCourseKey(course)===studyCourseKey(activeStudyCourse)}" data-study-course="${escape(course)}">${escape(course)}</button>`).join('');
 $('studyGradesTab').classList.toggle('active',studyGradesView);
 $('studyGradesTab').setAttribute('aria-selected',String(studyGradesView));
}
function renderStudyCoursePage(){
 const notes=getStudyNotes(),courseKey=studyCourseKey(activeStudyCourse);
 const grade=formatGrade(courseGrade(activeStudyCourse));
 $('studyCoursePage').innerHTML=`<div class="study-page-heading"><div><p class="eyebrow">Your course space</p><h1>${escape(activeStudyCourse)}</h1><p class="study-intro">A focused home for your ${escape(activeStudyCourse)} study materials.</p></div><span class="pill">Estimated grade · ${grade}</span></div><section class="study-notes-panel glass-panel"><label for="studyCourseNotesInput">Course notes</label><p class="study-help">Use this space for your own summaries, examples, and review notes.</p><textarea id="studyCourseNotesInput" class="study-course-notes" data-course-key="${escape(courseKey)}" placeholder="Start collecting notes for ${escape(activeStudyCourse)}...">${escape(notes[courseKey]||'')}</textarea><p class="form-message" id="studyNotesMessage" role="status"></p></section>`;
}
function renderStudyWeights(){
 const courses=getStudyCourses(),select=$('gradeWeightCourse'),gradebook=getStudyGradebook();
 if(!courses.length)return;
 const previous=select.value,course=courses.some(item=>studyCourseKey(item)===studyCourseKey(previous))?previous:courses[0];
 select.innerHTML=courses.map(item=>`<option value="${escape(item)}">${escape(item)}</option>`).join('');
 select.value=course;
 const weights=gradebook.weights[studyCourseKey(course)]||{};
 $('studyWeightGrid').innerHTML=studyAssessmentTypes.map(type=>`<label class="study-weight-field">${escape(type)} weight (%)<input type="number" min="0" max="100" step="0.1" data-study-weight="${escape(type)}" value="${Number(weights[type]??(100/studyAssessmentTypes.length)).toFixed(1)}"></label>`).join('');
}
function renderStudyAssessmentSelects(){
 const courses=getStudyCourses();
 for(const id of ['assessmentCourse','assessmentListCourse']){
   const select=$(id),previous=select.value;
   select.innerHTML=courses.map(course=>`<option value="${escape(course)}">${escape(course)}</option>`).join('');
   if(courses.some(course=>studyCourseKey(course)===studyCourseKey(previous)))select.value=previous;
 }
}
function renderStudyChart(){
 const courses=getStudyCourses(),gradebook=getStudyGradebook(),filters=$('studyChartFilters');
 if(!filters.querySelector('input')||filters.dataset.courses!==courses.join('|')){
   filters.dataset.courses=courses.join('|');
   filters.innerHTML=courses.map((course,index)=>`<label class="study-chart-filter"><input type="checkbox" value="${escape(course)}" checked><span style="--course-color:${studyChartColors[index%studyChartColors.length]}"></span>${escape(course)}</label>`).join('');
 }
 const selected=[...filters.querySelectorAll('input:checked')].map(input=>input.value);
 const data=selected.map(course=>({course,marks:gradebook.assessments.filter(item=>studyCourseKey(item.course)===studyCourseKey(course)).sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.id)-Number(b.id))})).filter(item=>item.marks.length);
 const svg=$('studyGradeChart'),left=48,right=738,top=20,bottom=260,maxCount=Math.max(2,...data.map(item=>item.marks.length)),plotWidth=right-left;
 const y=value=>bottom-(value/100)*(bottom-top),x=index=>left+(index/(maxCount-1))*plotWidth;
 let chart=`<text x="12" y="18" class="chart-axis-title">Mark %</text>`;
 for(let value=0;value<=100;value+=25)chart+=`<line x1="${left}" y1="${y(value)}" x2="${right}" y2="${y(value)}" class="chart-gridline"></line><text x="${left-9}" y="${y(value)+4}" text-anchor="end" class="chart-axis-label">${value}%</text>`;
 chart+=`<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" class="chart-axis"></line>`;
 data.forEach(item=>{
   const color=studyChartColors[courses.findIndex(course=>studyCourseKey(course)===studyCourseKey(item.course))%studyChartColors.length];
   const points=item.marks.map((mark,index)=>`${x(index)},${y(assessmentPercent(mark))}`).join(' ');
   chart+=`<polyline points="${points}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>`;
   item.marks.forEach((mark,index)=>{const percent=assessmentPercent(mark);chart+=`<circle cx="${x(index)}" cy="${y(percent)}" r="5" fill="${color}"><title>${escape(item.course)} · ${escape(mark.name)} · ${percent.toFixed(1)}%</title></circle>`;});
 });
 for(let index=0;index<maxCount;index++)chart+=`<text x="${x(index)}" y="${bottom+22}" text-anchor="middle" class="chart-axis-label">${index+1}</text>`;
 chart+=`<text x="${(left+right)/2}" y="312" text-anchor="middle" class="chart-axis-title">Assessment number (in date order)</text>`;
 svg.innerHTML=chart;
 const gradeData=courses.map(course=>courseGrade(course,gradebook)).filter(grade=>grade!==null);
 $('overallGradeSummary').textContent=gradeData.length?`Course average · ${(gradeData.reduce((sum,grade)=>sum+grade,0)/gradeData.length).toFixed(1)}%`:'No grades yet';
}
function renderStudyAssessmentRows(){
 const course=$('assessmentListCourse').value,records=getStudyGradebook().assessments.filter(item=>studyCourseKey(item.course)===studyCourseKey(course)).sort((a,b)=>String(b.date).localeCompare(String(a.date))||Number(b.id)-Number(a.id));
 $('studyAssessmentRows').innerHTML=records.map(item=>`<tr><td>${escape(item.name)}</td><td>${escape(item.type)}</td><td>${escape(item.date)}</td><td>${Number(item.score)} / ${Number(item.outOf)}</td><td>${assessmentPercent(item).toFixed(1)}%</td><td><button class="study-row-action" type="button" data-edit-assessment="${escape(item.id)}">Edit</button><button class="study-row-action danger" type="button" data-delete-assessment="${escape(item.id)}">Delete</button></td></tr>`).join('');
 $('studyNoAssessments').hidden=records.length>0;
}
function renderStudyView(){
 const courses=getStudyCourses(),hasCourses=courses.length>0&&!studySetupActive;
 $('studySetupScreen').hidden=hasCourses;
 $('studyAppScreen').hidden=!hasCourses;
 if(!hasCourses){renderStudyCoursePicker();return;}
 renderStudyCourseTabs();
 renderStudyCoursePage();
 renderStudyWeights();
 renderStudyAssessmentSelects();
 renderStudyAssessmentRows();
 renderStudyChart();
 $('studyGradesPage').hidden=!studyGradesView;
 $('studyCoursePage').hidden=studyGradesView;
}
function saveStudyCourses(event){
 event.preventDefault();
 const courses=[...$('studyCoursePickerList').querySelectorAll('.study-course-search')].map(input=>input.value.trim()).filter(Boolean),keys=courses.map(studyCourseKey);
 if(!courses.length){$('studySetupMessage').textContent='Choose at least one course to continue.';return;}
 if(new Set(keys).size!==keys.length){$('studySetupMessage').textContent='Each course can only be selected once.';return;}
 save('studyCourses',JSON.stringify(courses));
 studySetupActive=false;
 activeStudyCourse=courses[0];studyGradesView=false;
 renderStudyView();
}
function saveAssessment(event){
 event.preventDefault();
 const score=Number($('assessmentScore').value),outOf=Number($('assessmentOutOf').value);
 if(!Number.isFinite(score)||!Number.isFinite(outOf)||outOf<=0||score<0||score>outOf){$('studyAssessmentMessage').textContent='Enter a mark from 0 up to the “Out of” value.';return;}
 const gradebook=getStudyGradebook(),id=studyEditingAssessment||String(Date.now()),assessment={id,course:$('assessmentCourse').value,name:$('assessmentName').value.trim(),type:$('assessmentType').value,date:$('assessmentDate').value,score,outOf};
 if(studyEditingAssessment)gradebook.assessments=gradebook.assessments.map(item=>String(item.id)===studyEditingAssessment?assessment:item);
 else gradebook.assessments.push(assessment);
 save('studyGradebook',JSON.stringify(gradebook));
 $('studyAssessmentForm').reset();$('assessmentDate').value=localToday();studyEditingAssessment='';$('studyAssessmentForm').classList.remove('is-editing');$('studyAssessmentForm').querySelector('[type="submit"]').textContent='Add assessment';$('studyCancelEdit').hidden=true;
 $('studyAssessmentMessage').textContent='Assessment saved.';
 renderStudyView();
}
function setupStudyEvents(){
 if($('studyCourseForm').dataset.bound)return;
 $('studyCourseForm').dataset.bound='true';
 $('studyCourseForm').onsubmit=saveStudyCourses;
 $('addStudyCourse').onclick=()=>{const current=[...$('studyCoursePickerList').querySelectorAll('.study-course-search')].map(input=>input.value);renderCoursePicker([...current,'']);$('studyCoursePickerList').lastElementChild?.querySelector('input').focus();};
 $('studyCoursePickerList').onclick=event=>{const remove=event.target.closest('[data-remove-study-course]');if(!remove)return;remove.closest('.study-course-picker-row').remove();[...$('studyCoursePickerList').children].forEach((row,index)=>{row.querySelector('span').textContent=`Course ${index+1}`;row.querySelector('input').setAttribute('aria-label',`Course ${index+1}`);});};
 $('studyRestart').onclick=()=>{
   if(!window.confirm('Restart course selection? Your saved grades and course notes will be kept.'))return;
   studySetupActive=true;studyGradesView=false;renderStudyCoursePicker();showPage('study',true);
 };
 $('studyCourseTabs').onclick=event=>{const tab=event.target.closest('[data-study-course]');if(!tab)return;activeStudyCourse=tab.dataset.studyCourse;studyGradesView=false;renderStudyView();};
 $('studyGradesTab').onclick=()=>{studyGradesView=true;renderStudyView();};
 $('studyCourseForm').addEventListener('click',event=>{if(event.target.id==='addStudyCourse')event.preventDefault();});
 $('studyAssessmentForm').onsubmit=saveAssessment;
 $('studyAssessmentForm').insertAdjacentHTML('beforeend','<button class="secondary-btn study-cancel-edit" id="studyCancelEdit" type="button" hidden>Cancel edit</button>');
 $('studyCancelEdit').onclick=()=>{studyEditingAssessment='';$('studyAssessmentForm').reset();$('assessmentDate').value=localToday();$('studyAssessmentForm').classList.remove('is-editing');$('studyAssessmentForm').querySelector('[type="submit"]').textContent='Add assessment';$('studyCancelEdit').hidden=true;$('studyAssessmentMessage').textContent='';};
 $('gradeWeightCourse').onchange=()=>{renderStudyWeights();renderStudyChart();};
 $('studyWeightGrid').onchange=event=>{
   const input=event.target.closest('[data-study-weight]');if(!input)return;
   const value=Number(input.value);if(!Number.isFinite(value)||value<0||value>100){input.value='';return;}
   const book=getStudyGradebook(),key=studyCourseKey($('gradeWeightCourse').value);
   book.weights[key]={...(book.weights[key]||{}),[input.dataset.studyWeight]:value};
   save('studyGradebook',JSON.stringify(book));renderStudyChart();
 };
 $('assessmentListCourse').onchange=renderStudyAssessmentRows;
 $('studyChartFilters').onchange=renderStudyChart;
 $('selectAllStudyCourses').onclick=()=>{$('studyChartFilters').querySelectorAll('input').forEach(input=>input.checked=true);renderStudyChart();};
 $('clearStudyCourses').onclick=()=>{$('studyChartFilters').querySelectorAll('input').forEach(input=>input.checked=false);renderStudyChart();};
 $('studyAssessmentRows').onclick=event=>{
   const edit=event.target.closest('[data-edit-assessment]'),remove=event.target.closest('[data-delete-assessment]');if(!edit&&!remove)return;
   const book=getStudyGradebook(),id=String((edit||remove).dataset.editAssessment||(edit||remove).dataset.deleteAssessment),item=book.assessments.find(mark=>String(mark.id)===id);if(!item)return;
   if(remove){book.assessments=book.assessments.filter(mark=>String(mark.id)!==id);save('studyGradebook',JSON.stringify(book));renderStudyView();return;}
   studyEditingAssessment=id;$('assessmentCourse').value=item.course;$('assessmentName').value=item.name;$('assessmentType').value=item.type;$('assessmentDate').value=item.date;$('assessmentScore').value=item.score;$('assessmentOutOf').value=item.outOf;$('studyAssessmentForm').classList.add('is-editing');$('studyAssessmentForm').querySelector('[type="submit"]').textContent='Save changes';$('studyCancelEdit').hidden=false;$('assessmentName').focus();
 };
 $('studyCoursePage').oninput=event=>{
   if(event.target.id!=='studyCourseNotesInput')return;
   const all=getStudyNotes();all[event.target.dataset.courseKey]=event.target.value;save('studyCourseNotes',JSON.stringify(all));$('studyNotesMessage').textContent='Notes saved.';
 };
}
function setupStudy(){
 setupStudyEvents();
 if(!$('assessmentDate').value)$('assessmentDate').value=localToday();
 renderStudyView();
}
// --- Personal Workspace Logic ---
let personalTables = [];
let activeTableId = null;

const tableTemplates = {
  watching: [
    { name: 'Name', type: 'text' },
    { name: 'Type', type: 'select', options: ['Drama', 'TV Show', 'Movie', 'Documentary', 'Anime'] },
    { name: 'Genre', type: 'text', placeholder: 'Funny, Romance...' },
    { name: 'Rate', type: 'select', options: ['★', '★★', '★★★', '★★★★', '★★★★★'] },
    { name: 'Progress', type: 'select', options: ['Not Started', 'Currently Watching', 'Watch Next', 'Done'] },
    { name: 'Image Link', type: 'text' }
  ],
  financial: [
    { name: 'Item', type: 'text' },
    { name: 'Category', type: 'select', options: ['Income', 'Expense', 'Savings'] },
    { name: 'Amount', type: 'number', isFinancial: true },
    { name: 'Date', type: 'date' }
  ],
  data: [
    { name: 'Title', type: 'text' },
    { name: 'Status', type: 'select', options: ['Active', 'Archived', 'Pending'] },
    { name: 'Notes', type: 'text' }
  ],
  book: [
    { name: 'Title', type: 'text' },
    { name: 'Author', type: 'text' },
    { name: 'Status', type: 'select', options: ['To Read', 'Reading', 'Finished'] },
    { name: 'Rating', type: 'select', options: ['1', '2', '3', '4', '5'] }
  ],
  custom: [
    { name: 'Column 1', type: 'text' },
    { name: 'Column 2', type: 'text' }
  ]
};

function setupPersonalSpace() {
  const typingContainer = $('typingContainer');
  const typingBar = $('personalCommandInput');
  const toggleBtn = $('toggleTypingBar');
  const commandDropdown = $('commandDropdown');
  const typeModal = $('tableTypeModal');

  // Load saved tables from cloud/localStorage
  try {
    personalTables = JSON.parse(get('personalTables', '[]'));
  } catch (e) {
    personalTables = [];
  }
  renderPersonalTables();

  if(!typingBar) return;

  // Toggle Typing Bar
  toggleBtn.onclick = () => {
    const isHidden = typingContainer.classList.toggle('is-hidden');
    toggleBtn.textContent = isHidden ? 'Unhide Typing Bar' : 'Hide Typing Bar';
    if(isHidden) {
      commandDropdown.hidden = true;
      typeModal.hidden = true;
      typingBar.value = '';
    }
  };

  // Command detection
  typingBar.addEventListener('input', (e) => {
    const val = e.target.value;
    if (val === '/') {
      commandDropdown.hidden = false;
    } else if (val.startsWith('/create_new_table')) {
      commandDropdown.hidden = false;
    } else {
      commandDropdown.hidden = true;
    }
  });

  // Select Command
  commandDropdown.onclick = (e) => {
    const btn = e.target.closest('.command-btn');
    if (!btn) return;
    if (btn.dataset.cmd === '/create_new_table') {
      typingBar.value = '';
      commandDropdown.hidden = true;
      typeModal.hidden = false;
    }
  };

  // Choose Table Type
  typeModal.onclick = (e) => {
    if(e.target.tagName !== 'BUTTON') return;
    const type = e.target.dataset.type;
    typeModal.hidden = true;
    createNewTable(type);
  };
  
  // Customizer Add Column
  $('addColumnBtn').onclick = () => {
    if(!activeTableId) return;
    const tableDef = personalTables.find(t => t.id === activeTableId);
    tableDef.columns.push({ name: `New Column`, type: 'text' });
    savePersonalTables();
    renderPersonalTables();
    renderCustomizer(activeTableId);
  };
}

function savePersonalTables() {
  save('personalTables', JSON.stringify(personalTables));
}

function createNewTable(type) {
  const newTable = {
    id: 'tbl_' + Date.now(),
    type: type,
    title: type.charAt(0).toUpperCase() + type.slice(1) + ' List',
    columns: JSON.parse(JSON.stringify(tableTemplates[type])),
    rows: [{}, {}, {}] 
  };
  personalTables.push(newTable);
  savePersonalTables();
  activeTableId = newTable.id;
  renderPersonalTables();
  renderCustomizer(newTable.id);
}

function renderPersonalTables() {
  const container = $('personalTablesContainer');
  container.innerHTML = personalTables.map(table => {
    let html = `<div class="personal-table-block" data-table-id="${table.id}">
      <h3 style="margin-bottom: 12px; cursor: pointer;" onclick="renderCustomizer('${table.id}')">${escape(table.title)} <span>⚙️</span></h3>
      <div class="custom-table-wrapper">
        <table class="custom-table">
          <thead><tr>`;
    
    // Headers
    table.columns.forEach(col => {
      html += `<th>${escape(col.name)}</th>`;
    });
    html += `</tr></thead><tbody>`;
    
    // Rows
    let totalCalc = 0;
    table.rows.forEach((row, rIdx) => {
      html += `<tr>`;
      table.columns.forEach((col, cIdx) => {
        let val = row[col.name] || '';
        if (col.type === 'select') {
          html += `<td><select onchange="updateTableCell('${table.id}', ${rIdx}, '${col.name}', this.value)">
            <option value=""></option>
            ${col.options.map(opt => `<option value="${escape(opt)}" ${val === opt ? 'selected' : ''}>${escape(opt)}</option>`).join('')}
          </select></td>`;
        } else if (col.type === 'number') {
          html += `<td><input type="number" value="${val}" onchange="updateTableCell('${table.id}', ${rIdx}, '${col.name}', this.value)" /></td>`;
          if (col.isFinancial) totalCalc += Number(val) || 0;
        } else if (col.type === 'date') {
          html += `<td><input type="date" value="${val}" onchange="updateTableCell('${table.id}', ${rIdx}, '${col.name}', this.value)" /></td>`;
        } else {
          html += `<td><input type="text" placeholder="${col.placeholder || ''}" value="${escape(val)}" onchange="updateTableCell('${table.id}', ${rIdx}, '${col.name}', this.value)" /></td>`;
        }
      });
      html += `</tr>`;
    });

    // Financial Total Footer
    if (table.type === 'financial') {
      html += `<tr class="table-total-row">
        <td colspan="${table.columns.length - 1}" style="text-align: right;"><strong>Total:</strong></td>
        <td>$${totalCalc.toFixed(2)}</td>
      </tr>`;
    }
    
    html += `</tbody></table></div>
      <button class="soft-btn" style="margin-top:8px; font-size:0.8rem;" onclick="addTableRow('${table.id}')">+ Add Row</button>
    </div>`;
    return html;
  }).join('');
}

// Global functions for inline HTML handlers
window.updateTableCell = function(tableId, rowIdx, colName, value) {
  const table = personalTables.find(t => t.id === tableId);
  if(table) {
    table.rows[rowIdx][colName] = value;
    savePersonalTables();
    if(table.type === 'financial') renderPersonalTables(); 
  }
};

window.addTableRow = function(tableId) {
  const table = personalTables.find(t => t.id === tableId);
  if(table) {
    table.rows.push({});
    savePersonalTables();
    renderPersonalTables();
  }
};

window.renderCustomizer = function(tableId) {
  activeTableId = tableId;
  const customizer = $('tableCustomizer');
  const content = $('customizerContent');
  const table = personalTables.find(t => t.id === tableId);
  
  if(!table) {
    customizer.hidden = true;
    return;
  }
  
  customizer.hidden = false;
  $('activeTableName').textContent = table.title;
  
  content.innerHTML = table.columns.map((col, idx) => {
    // Lock the first column ("Name/Title") from type changes and deletion
    const isPrimary = idx === 0; 
    
    let html = `
      <div class="customizer-item" style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px;">
        <div style="display: flex; width: 100%; justify-content: space-between; align-items: center;">
          <input type="text" value="${escape(col.name)}" 
            style="background: transparent; border: 1px solid transparent; color: var(--text); width: 60%; font-weight: 800;"
            onchange="renameTableColumn('${table.id}', ${idx}, this.value)" />
          ${!isPrimary ? `<button class="delete-task" onclick="removeTableColumn('${table.id}',${idx})" title="Remove Column">×</button>` : ''}
        </div>`;
    
    // Add type selector and options input for all except the first column
    if (!isPrimary) {
      html += `
        <div style="display: flex; gap: 8px; width: 100%;">
          <select style="background: var(--control-bg); color: var(--text); border: 1px solid var(--panel-border); border-radius: 6px; padding: 4px 6px; width: 35%; font-size: 0.75rem;"
                  onchange="changeTableColumnType('${table.id}', ${idx}, this.value)">
            <option value="text" ${col.type === 'text' ? 'selected' : ''}>Text</option>
            <option value="select" ${col.type === 'select' ? 'selected' : ''}>Select</option>
            <option value="number" ${col.type === 'number' ? 'selected' : ''}>Number</option>
            <option value="date" ${col.type === 'date' ? 'selected' : ''}>Date</option>
          </select>`;
      
      if (col.type === 'select') {
        const opts = col.options ? col.options.join(', ') : '';
        html += `<input type="text" placeholder="Options (comma separated)" value="${escape(opts)}"
                  style="flex: 1; min-width: 0; background: var(--control-bg); color: var(--text); border: 1px solid var(--panel-border); border-radius: 6px; padding: 4px 8px; font-size: 0.75rem;"
                  onchange="updateTableColumnOptions('${table.id}', ${idx}, this.value)" />`;
      }
      html += `</div>`;
    }
    
    html += `</div>`;
    return html;
  }).join('');

  content.innerHTML += `<button class="primary-btn mt-3" style="background: #ef4444; border-color: #dc2626; color: white;" onclick="deleteTable('${table.id}')">Delete Entire Table</button>`;
};

// New function to handle column type changes
window.changeTableColumnType = function(tableId, colIdx, newType) {
  const table = personalTables.find(t => t.id === tableId);
  if (table) {
    table.columns[colIdx].type = newType;
    if (newType === 'select' && !table.columns[colIdx].options) {
      table.columns[colIdx].options = ['Option 1', 'Option 2']; // Default options
    }
    savePersonalTables();
    renderPersonalTables();
    renderCustomizer(tableId); // Re-render to show/hide the options input
  }
};

// New function to update the dropdown options
window.updateTableColumnOptions = function(tableId, colIdx, optionsStr) {
  const table = personalTables.find(t => t.id === tableId);
  if (table) {
    // Split by comma, trim whitespace, and remove empty entries
    table.columns[colIdx].options = optionsStr.split(',').map(s => s.trim()).filter(Boolean);
    savePersonalTables();
    renderPersonalTables();
  }
};

window.renameTableColumn = function(tableId, colIdx, newName) {
  const table = personalTables.find(t => t.id === tableId);
  if(table && newName.trim()) {
    const oldName = table.columns[colIdx].name;
    table.columns[colIdx].name = newName.trim();
    table.rows.forEach(row => {
      row[newName.trim()] = row[oldName];
      delete row[oldName];
    });
    savePersonalTables();
    renderPersonalTables();
  }
};

window.removeTableColumn = function(tableId, colIdx) {
  const table = personalTables.find(t => t.id === tableId);
  if(table) {
    const colName = table.columns[colIdx].name;
    table.columns.splice(colIdx, 1);
    table.rows.forEach(row => delete row[colName]);
    savePersonalTables();
    renderPersonalTables();
    renderCustomizer(tableId);
  }
};

window.deleteTable = function(tableId) {
  if (window.confirm("Are you sure you want to delete this table? This cannot be undone.")) {
    personalTables = personalTables.filter(t => t.id !== tableId);
    savePersonalTables();
    if (activeTableId === tableId) {
      activeTableId = null;
      $('tableCustomizer').hidden = true;
    }
    renderPersonalTables();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(setupPersonalSpace, 100);
});

let clockInterval=null;
function init(){renderSchool();renderMonth();selectDate(selectedDate);renderTasks('weekly');loadWeather();setupStudy();renderMoodPicker();setupSongPlayer();$('clockFormat').value=get('clockFormat','12');customClock=get('clockTime')||null;updateClock();if(!clockInterval)clockInterval=setInterval(updateClock,1000);$('quickNoteInput').value=get('quickNote');$('backgroundUrl').value=get('background','').startsWith('http')?get('background'):'';let bg=get('background');if(bg)root.style.setProperty('--custom-bg-image',`url("${bg}")`);root.dataset.accent=get('accent','purple');root.dataset.theme=get('theme','dark');$('modeToggle').textContent=root.dataset.theme==='light'?'Day':'Night';const pulseOn=localStorage.getItem('icecreamHousePulse')==='on';const parallaxOn=localStorage.getItem('icecreamHouseParallax')!=='off';document.body.classList.toggle('pulse-active',pulseOn);document.body.classList.toggle('parallax-off',!parallaxOn);const parallaxButton=$('parallaxButton');if(parallaxButton) parallaxButton.textContent=parallaxOn?'Parallax mode':'Parallax off';document.querySelectorAll('.tool-card,.widget,.content-section,.custom-panel,.app-page,.quote-panel,.insight-panel').forEach((el,index)=>{el.classList.add('scroll-reveal');el.style.setProperty('--reveal-delay',`${index * 60}ms`);});const revealObserver=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');}else{entry.target.classList.remove('is-visible');}});},{threshold:0.12});document.querySelectorAll('.scroll-reveal').forEach(el=>revealObserver.observe(el));const range=$('focusRange');const focusValue=$('focusValue');if(range&&focusValue){const updateFocus=()=>{focusValue.textContent=`${range.value}%`;document.documentElement.style.setProperty('--focus-level',range.value);};updateFocus();range.oninput=updateFocus;}}
document.querySelectorAll('.swatch').forEach(b=>b.onclick=()=>{root.dataset.accent=b.dataset.accent;save('accent',b.dataset.accent);});$('modeToggle').onclick=()=>{let t=root.dataset.theme==='light'?'dark':'light';root.dataset.theme=t;save('theme',t);$('modeToggle').textContent=t==='light'?'Day':'Night';};
setupWorkspace();
renderUpdates();
const initialView=['calendar','study','tools'].includes(location.hash.slice(1))?location.hash.slice(1):'home';
showPage(initialView);
$('updatesTrigger').onclick=()=>setUpdatesOpen($('updatesPopover').hidden,!$('updatesPopover').hidden);
$('updatesClose').onclick=()=>setUpdatesOpen(false,true);
document.addEventListener('click',event=>{if(!$('updatesPopover').hidden&&!event.target.closest('#updatesPopover, #updatesTrigger'))setUpdatesOpen(false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('updatesPopover').hidden)setUpdatesOpen(false,true);});
$('moodTrigger').onclick=()=>setMoodOpen($('moodPopover').hidden,!$('moodPopover').hidden);
$('moodClose').onclick=()=>setMoodOpen(false,true);
$('moodOptions').onclick=event=>{
 const button=event.target.closest('[data-mood]');
 if(!button)return;
 const mood=moodChoices.find(([id])=>id===button.dataset.mood);
 if(!mood)return;
 save(`mood:${localToday()}`,mood[0]);
 renderMoodPicker();
 renderMonth();
 setMoodOpen(false,true);
};
document.addEventListener('click',event=>{if(!$('moodPopover').hidden&&!event.target.closest('#moodPopover, #moodTrigger'))setMoodOpen(false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('moodPopover').hidden)setMoodOpen(false,true);});
history.replaceState({...history.state,appPage:initialView},'',`${location.pathname}${location.search}#${initialView}`);
window.addEventListener('popstate',event=>showPage(event.state?.appPage||'home'));
if($('pulseButton')){$('pulseButton').onclick=()=>{const enabled=document.body.classList.toggle('pulse-active');localStorage.setItem('icecreamHousePulse',enabled?'on':'off');};}
if($('parallaxButton')){$('parallaxButton').onclick=()=>{const enabled=document.body.classList.toggle('parallax-off');localStorage.setItem('icecreamHouseParallax',enabled?'off':'on');$('parallaxButton').textContent=enabled?'Parallax off':'Parallax mode';};}
window.addEventListener('scroll',()=>{const shift=window.scrollY*0.5;root.style.setProperty('--scroll-shift',`${shift}px`);}, {passive:true});
 $('dailyTaskForm').onsubmit=e=>{e.preventDefault();addTask('daily');};$('weeklyTaskForm').onsubmit=e=>{e.preventDefault();addTask('weekly');};$('dailyDatePicker').onchange=e=>{const date=parseTypedDate(e.target.value);if(date)selectDate(date);else{e.target.value=displayDate(selectedDate);e.target.setCustomValidity('Use a valid date in YYYY/MM/DD format.');e.target.reportValidity();}};$('dailyDatePicker').oninput=e=>e.target.setCustomValidity('');document.querySelectorAll('[data-page]').forEach(element=>{element.onclick=()=>showPage(element.classList.contains('back-home')?'home':element.dataset.page,true);if(element.matches('[role="button"]'))element.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();showPage(element.dataset.page,true);}};});$('previousMonth').onclick=()=>{viewDate.setMonth(viewDate.getMonth()-1);renderMonth();};$('nextMonth').onclick=()=>{viewDate.setMonth(viewDate.getMonth()+1);renderMonth();};$('weatherRefresh').onclick=loadWeather;
document.querySelectorAll('.editable-task-list').forEach(list=>list.onclick=e=>{const group=list.id==='dailyTaskList'?'daily':'weekly',storage=group==='daily'?`dailyTasks:${selectedDate}`:'weeklyTasks',trigger=e.target.closest('[data-delete]')||e.target.closest('[data-id]');if(!trigger)return;const idString=trigger.dataset.id||trigger.dataset.delete,source=trigger.dataset.source||'task';if(source==='upcoming'){e.stopImmediatePropagation();let upcoming=getUpcomingTasks(),id=String(idString).replace(/^upcoming:/,'');if(trigger.dataset.delete)upcoming=upcoming.filter(task=>String(task.id)!==id);else upcoming=upcoming.map(task=>String(task.id)===id?{...task,done:!task.done}:task);save('upcomingTasks',JSON.stringify(upcoming));renderUpcoming();renderTasks('daily');return;}if(trigger.dataset.delete){if(source==='event'){const eventId=String(idString).replace(/^event:/,'');let events=getEvents(),event=events.find(item=>getEventId(item)===eventId);if(event?.repeatEnabled!==false&&event?.repeat&&event.repeat!=='none'){const choice=window.prompt('Delete this repeating event:\n1 = only this occurrence\n2 = this and all future occurrences\nCancel = keep it','1');if(choice==='1'){event.deletedDates=[...(event.deletedDates||[]),selectedDate];}else if(choice==='2'){event.deletedFrom=selectedDate;}else{return;}save('events',JSON.stringify(events));}else{save('events',JSON.stringify(events.filter(item=>getEventId(item)!==eventId)));}}else{const taskList=JSON.parse(get(storage,'[]')).filter(task=>String(task.id)!==String(idString));save(storage,JSON.stringify(taskList));}renderTasks(group);renderMonth();return;}if(trigger.dataset.id){if(source==='event'){const eventId=String(idString).replace(/^event:/,'');const events=getEvents().map(event=>getEventId(event)===eventId?{...event,done:!Boolean(event.done)}:event);save('events',JSON.stringify(events));}else{const taskList=JSON.parse(get(storage,'[]'));let t=taskList.find(x=>String(x.id)===String(idString));if(t){t.done=!t.done;save(storage,JSON.stringify(taskList));}}renderTasks(group);renderMonth();}});
document.querySelectorAll('.editable-task-list').forEach(list=>list.addEventListener('click',event=>{const trigger=event.target.closest('[data-id]');if(!trigger)return;if(trigger.dataset.source==='event'){event.stopImmediatePropagation();const eventId=String(trigger.dataset.id).replace(/^event:/,'');const events=getEvents();const item=events.find(savedEvent=>getEventId(savedEvent)===eventId);if(item){setEventDoneOnDate(item,selectedDate,!eventDoneOnDate(item,selectedDate));save('events',JSON.stringify(events));}renderTasks('daily');renderMonth();renderUpcoming();return;}if(trigger.dataset.source!=='upcoming')return;event.stopImmediatePropagation();const id=String(trigger.dataset.id).replace(/^upcoming:/,'');let upcoming=getUpcomingTasks().map(task=>String(task.id)===id?{...task,done:!task.done}:task);save('upcomingTasks',JSON.stringify(upcoming));renderUpcoming();renderTasks('daily');},{capture:true}));
$('upcomingForm').onsubmit=e=>{e.preventDefault();const title=$('upcomingTitle').value.trim(),dueDate=$('upcomingDate').value,category=$('upcomingCategory').value;if(!title||!dueDate)return;if(dueDate<=localToday()){$('upcomingMessage').textContent='Choose a future date for Upcoming.';return;}const upcoming=getUpcomingTasks();upcoming.push({id:Date.now(),title,dueDate,category,done:false});save('upcomingTasks',JSON.stringify(upcoming));e.target.reset();$('upcomingMessage').textContent='Upcoming task added.';renderUpcoming();if(selectedDate===dueDate)renderTasks('daily');};
 $('upcomingTaskList').onclick=e=>{const trigger=e.target.closest('[data-upcoming-delete]')||e.target.closest('[data-upcoming-id]');if(!trigger)return;const id=String(trigger.dataset.upcomingId||trigger.dataset.upcomingDelete),kind=trigger.dataset.upcomingKind,dueDate=trigger.dataset.upcomingDate;if(kind==='daily'){const storage=`dailyTasks:${dueDate}`,tasks=JSON.parse(get(storage,'[]'));const taskId=id.replace(`daily:${dueDate}:`,'');save(storage,JSON.stringify(trigger.dataset.upcomingDelete?tasks.filter(task=>String(task.id)!==taskId):tasks.map(task=>String(task.id)===taskId?{...task,done:!task.done}:task)));}else if(kind==='event'){let events=getEvents(),event=events.find(item=>getEventId(item)===trigger.dataset.upcomingEvent);if(event){if(trigger.dataset.upcomingDelete){if(eventRepeats(event))event.deletedDates=[...(event.deletedDates||[]),dueDate];else events=events.filter(item=>getEventId(item)!==trigger.dataset.upcomingEvent);}else setEventDoneOnDate(event,dueDate,!eventDoneOnDate(event,dueDate));save('events',JSON.stringify(events));}}else{let upcoming=getExplicitUpcomingTasks();upcoming=trigger.dataset.upcomingDelete?upcoming.filter(task=>String(task.id)!==id):upcoming.map(task=>String(task.id)===id?{...task,done:!task.done}:task);save('upcomingTasks',JSON.stringify(upcoming));}renderUpcoming();renderTasks('daily');renderMonth();};
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