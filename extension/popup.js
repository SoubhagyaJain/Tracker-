const key='career-os-learning-companion-v1';
const $=id=>document.getElementById(id);
const draftFields=['origin','url','title','completed','total','percent','task','mode','video'];
const localHosts=new Set(['127.0.0.1','localhost']);
let state={queue:[],tasks:[],draft:{},timer:null,review:null};
let sending=false;
let storageWrite=Promise.resolve();
const saved=chrome.storage.local.get(key);

function remember(){
  state.draft=Object.fromEntries(draftFields.map(id=>[id,$(id).value]));
  const snapshot=structuredClone(state);
  storageWrite=storageWrite.catch(()=>undefined).then(()=>chrome.storage.local.set({[key]:snapshot}));
  return storageWrite;
}
function status(message){$('status').textContent=message;}
function errorMessage(error){return error instanceof Error?error.message:'The operation could not be completed.';}
function localOrigin(){
  const url=new URL($('origin').value);
  if(url.protocol!=='http:'||!localHosts.has(url.hostname)||url.username||url.password||url.pathname!=='/'||url.search||url.hash){
    throw new Error('Use the HTTP origin of your localhost dashboard.');
  }
  return url.origin;
}
function courseUrl(text){
  const url=new URL(text);
  if(url.protocol!=='https:'||url.username||url.password||url.port||
    !(url.hostname==='udemy.com'||url.hostname.endsWith('.udemy.com'))||
    !/^\/course\/[a-z0-9][a-z0-9-]*(\/|$)/i.test(url.pathname)) throw new Error('Choose an HTTPS Udemy course URL.');
  const host=url.hostname==='udemy.com'?'www.udemy.com':url.hostname;
  return 'https://'+host+'/course/'+url.pathname.split('/')[2].toLowerCase()+'/';
}
function refreshTasks(){
  const selected=state.draft.task||$('task').value;
  $('task').replaceChildren(new Option('Use course mapping',''));
  for(const task of state.tasks)$('task').append(new Option(task.title,task.id));
  $('task').value=selected;
  if($('task').selectedIndex<0)$('task').selectedIndex=0;
}
function elapsed(){
  if(!state.timer)return 0;
  return state.timer.intervals.reduce((sum,part)=>sum+part.end-part.start,0)+
    (state.timer.startedAt?Math.max(0,Date.now()-state.timer.startedAt):0);
}
function render(){
  const ms=elapsed();
  const seconds=Math.floor(ms/1000);
  $('elapsed').textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
  $('start').disabled=!!state.timer?.startedAt||!!state.review;
  $('start').textContent=state.timer?'Resume':'Start';
  $('pause').disabled=!state.timer?.startedAt;
  $('stop').disabled=!state.timer;
  $('stopped').textContent=state.review?state.review.minutes+' min focused. Queue this timed session for review.':'';
  $('send').disabled=!state.queue.length||sending;
}
function renderQueue(){
  $('queue').replaceChildren();
  for(const entry of state.queue){
    const row=document.createElement('li');
    const progress=entry.course.completedLectures===undefined?'':' · '+entry.course.completedLectures+(entry.course.totalLectures===undefined?'':'/'+entry.course.totalLectures)+' lectures';
    const percent=entry.course.percent===undefined?'':' · '+entry.course.percent+'%';
    const task=state.tasks.find(item=>item.id===entry.taskId);
    row.textContent=entry.course.title+' · '+entry.course.url+progress+percent+(entry.session?' · '+entry.session.mode+' · '+entry.session.minutes+' min focused, '+entry.session.videoMinutes+' min video':'')+(task?' · '+task.title:'');
    const remove=document.createElement('button');
    remove.type='button';remove.textContent='Remove';remove.disabled=sending;
    remove.onclick=()=>{state.queue=state.queue.filter(item=>item.id!==entry.id);void remember().catch(error=>status(errorMessage(error)));renderQueue();};
    row.append(remove);$('queue').append(row);
  }
  if(!state.queue.length){const li=document.createElement('li');li.textContent='Queue is empty.';$('queue').append(li);}
  render();
}
function finishInterval(){
  const start=state.timer?.startedAt;
  if(!start)return;
  const end=Date.now();
  if(end>start)state.timer.intervals.push({start,end});
  state.timer.startedAt=null;
}

// This function is executed only in the configured local dashboard tab.
function requestFromDashboard(expectedOrigin,action,entry,nonce){
  if(location.origin!==expectedOrigin)return {ok:false,error:'Dashboard origin changed.'};
  return new Promise(resolve=>{
    const handle=event=>{
      if(event.source!==window||event.origin!==expectedOrigin||event.data?.type!=='career-os-learning-response'||event.data.nonce!==nonce)return;
      clearTimeout(timeout);window.removeEventListener('message',handle);resolve(event.data);
    };
    const timeout=setTimeout(()=>{
      window.removeEventListener('message',handle);resolve({ok:false,error:'Dashboard did not reply. Open the local app and retry.'});
    },3000);
    window.addEventListener('message',handle);
    window.postMessage({type:'career-os-learning-request',nonce,action,entry},expectedOrigin);
  });
}
async function connection(){
  const origin=localOrigin();
  const host='http://'+new URL(origin).hostname+'/*';
  const granted=await chrome.permissions.request({origins:[host]});
  if(!granted)throw new Error('Grant optional access to the local dashboard to connect.');
  const tabs=await chrome.tabs.query({url:host});
  const tab=tabs.find(item=>item.id&&item.url&&new URL(item.url).origin===origin);
  if(!tab)throw new Error('Open the dashboard in Chrome, then retry.');
  return {origin,id:tab.id};
}
async function bridge(target,action,entry){
  const result=await chrome.scripting.executeScript({
    target:{tabId:target.id},func:requestFromDashboard,args:[target.origin,action,entry??null,crypto.randomUUID()],
  });
  const value=result[0]?.result;
  if(!value?.ok)throw new Error(value?.error??'The dashboard could not be reached.');
  return value;
}
function action(id,handler){
  $(id).onclick=()=>Promise.resolve().then(handler).catch(error=>status(errorMessage(error)));
}
async function initialize(){
  const stored=await saved;
  state={...state,...stored[key]};
  for(const id of draftFields)if(id!=='task'&&state.draft[id]!==undefined)$(id).value=state.draft[id];
  refreshTasks();renderQueue();
  status(state.queue.length?'Offline queue restored. Test the connection before sending.':'Ready. Test your local dashboard connection.');
  for(const id of draftFields)$(id).addEventListener('change',()=>void remember().catch(error=>status(errorMessage(error))));
  action('open',()=>chrome.tabs.create({url:localOrigin()+'/learning/'}));
  $('connect').onclick=()=>{
    // The optional permission prompt starts inside the click handler.
    try{
      connection().then(target=>bridge(target,'ping')).then(async reply=>{
        state.tasks=Array.isArray(reply.tasks)?reply.tasks:[];
        refreshTasks();await remember();status('Connected to '+localOrigin()+'.');
      }).catch(error=>status(errorMessage(error)));
    }catch(error){status(errorMessage(error));}
  };
  action('capture',async()=>{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    $('url').value=courseUrl(tab?.url??'');
    await remember();status('Course URL added. Enter the title and progress you want to share.');
  });
  action('start',async()=>{
    state.timer??={id:crypto.randomUUID(),startedAt:null,intervals:[]};
    if(state.timer.intervals.length>=300)throw new Error('Stop this session before adding more intervals.');
    state.timer.startedAt=Date.now();await remember();render();
  });
  action('pause',async()=>{finishInterval();await remember();render();});
  action('stop',async()=>{
    finishInterval();
    const minutes=Math.min(1440,Math.max(1,Math.floor(elapsed()/60000)));
    state.review={id:state.timer.id,at:new Date().toISOString(),minutes,intervals:state.timer.intervals};
    state.timer=null;await remember();render();
  });
  $('course').onsubmit=async event=>{
    event.preventDefault();
    try{
      if(state.queue.length>=250)throw new Error('Send or remove queued records before adding more.');
      if(state.timer)throw new Error('Stop the timer to review its session before queuing.');
      const title=$('title').value.trim();
      if(!title)throw new Error('Enter the course title.');
      const number=id=>$(id).value===''?undefined:Number($(id).value);
      const completedLectures=number('completed'),totalLectures=number('total'),percent=number('percent');
      if(completedLectures!==undefined&&totalLectures!==undefined&&completedLectures>totalLectures)
        throw new Error('Completed lectures cannot exceed the total.');
      const course={title,url:courseUrl($('url').value),completedLectures,totalLectures,percent};
      const videoMinutes=number('video')??0;
      const session=state.review||videoMinutes?{
        ...(state.review??{id:crypto.randomUUID(),at:new Date().toISOString(),minutes:0,intervals:[]}),
        mode:$('mode').value,videoMinutes,
      }:undefined;
      state.queue.push({version:1,id:crypto.randomUUID(),course,taskId:$('task').value,session});
      state.review=null;$('video').value='0';await remember();renderQueue();status('Queued. Review the record before sending.');
    }catch(error){status(errorMessage(error));}
  };
  $('send').onclick=()=>{
    if(sending)return;
    sending=true;renderQueue();
    let delivered=0;
    connection().then(async target=>{
      for(const entry of [...state.queue]){
        await bridge(target,'send',entry);
        state.queue=state.queue.filter(item=>item.id!==entry.id);
        await remember();delivered++;
      }
      status(delivered+' records acknowledged by the dashboard.');
    }).catch(error=>status(errorMessage(error)+' Pending records remain in the queue.')).finally(()=>{
      sending=false;renderQueue();
    });
  };
  setInterval(render,300);
}
void initialize().catch(error=>status(errorMessage(error)));

