import {starterProjects,createStarterCopy} from './starter-projects.js';
import {MiloSound} from './sound.js';
import {lessons, examples, commands} from './lessons.js';
import {ProjectStore} from './project-store.js';
import {createScene,applyCommand,renderScene} from './drawing.js';
const $=id=>document.getElementById(id);
const STORE='milo-playground.v1';
let saved={};try{saved=JSON.parse(localStorage.getItem(STORE)||'{}');}catch{}
const projectStore=new ProjectStore({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
const state={projectId:typeof saved.projectId==='string'?saved.projectId:null,projectRevision:saved.projectRevision??null,projectDrafts:saved.projectDrafts&&typeof saved.projectDrafts==='object'?saved.projectDrafts:{},lesson:Math.max(0,lessons.findIndex(l=>l.id===(saved.lesson||'square'))),mode:saved.mode==='free'?'free':'learn',drafts:saved.drafts||{},completed:new Set((saved.completed||[]).filter(id=>lessons.some(l=>l.id===id))),worker:null,phase:'idle',pendingInput:null,executionLine:0,errorLine:0,variables:[],run:null,pace:25,freeCode:saved.freeCode||'color("teal")\n\nrepeat 4\n    move(100)\n    turn(90)\nend\n',lastActivity:0,runMode:'run'};
const editor=$('editor');
const sound=new MiloSound({enabled:saved.soundEnabled!==false,onStatus:status=>{
  $('soundButton').title=status==='ready'?'Sound is ready':status==='blocked'?'Sound is blocked. Click Sound off, then Sound on to enable it.':'Audio is unavailable. Programs continue silently.';
  $('soundNotice').hidden=status==='ready'||!sound.enabled;
  $('soundNotice').textContent=status==='blocked'?'Sound is blocked. Toggle Sound off and on to enable it.':'Audio is unavailable. Your program will continue silently.';
}});
function updateSoundButton(){ $('soundButton').textContent=sound.enabled?'Sound on':'Sound off';$('soundButton').setAttribute('aria-pressed',String(sound.enabled));if(!sound.enabled)$('soundButton').title='Sound is muted. Notes keep their timing.'; }
$('soundButton').onclick=()=>{sound.setEnabled(!sound.enabled);updateSoundButton();$('soundNotice').hidden=true;if(sound.enabled)void sound.unlock();persist();};
updateSoundButton();

const escapeHtml=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tokenPattern=/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[^\n]*|\b(?:say|repeat|as|end|if|else|while|for|in|function|return|break|continue|and|or|not|is|true|false|nothing)\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*(?=\())/g;
function highlight(code){let out='',last=0;for(const match of code.matchAll(tokenPattern)){out+=escapeHtml(code.slice(last,match.index));const t=match[0],kind=/^["']/.test(t)?'string':t.startsWith('#')?'comment':/^\d/.test(t)?'number':/^[A-Za-z_]\w*$/.test(t)&&code[match.index+t.length]==='('?'function':'keyword';out+=`<span class="token-${kind}">${escapeHtml(t)}</span>`;last=match.index+t.length;}return out+escapeHtml(code.slice(last))+'\n';}
function syncEditor(){
  $('highlight').innerHTML=highlight(editor.value);
  const count=editor.value.split('\n').length;
  $('lineGutter').innerHTML=Array.from({length:count},(_,i)=>`<div class="${state.errorLine===i+1?'error-number':state.executionLine===i+1?'active-number':''}">${i+1}</div>`).join('');
  syncScroll();
}
function syncScroll(){
  $('highlight').scrollTop=editor.scrollTop;$('highlight').scrollLeft=editor.scrollLeft;
  $('lineGutter').scrollTop=editor.scrollTop;
  for(const [id,line] of [['executionLine',state.executionLine],['errorLine',state.errorLine]]){
    const el=$(id);el.hidden=!line;el.style.top=`${16+(line-1)*24-editor.scrollTop}px`;
  }
}
function showLine(line,isError=false){
  state.executionLine=isError?0:line;state.errorLine=isError?line:0;
  if(line){const top=(line-1)*24;if(top<editor.scrollTop||top>editor.scrollTop+editor.clientHeight-64)editor.scrollTop=Math.max(0,top-72);}
  syncEditor();
}
function persist(){
  try{localStorage.setItem(STORE,JSON.stringify({soundEnabled:sound.enabled,lesson:lessons[state.lesson].id,mode:state.mode,drafts:state.drafts,completed:[...state.completed],freeCode:state.freeCode,projectId:state.projectId,projectRevision:state.projectRevision,projectDrafts:state.projectDrafts}));$('saveState').textContent='Saved on this device';}
  catch{$('saveState').textContent='Download to keep your code';}
}
function saveDraft(){if(state.mode==='free'){state.freeCode=editor.value;if(state.projectId)state.projectDrafts[state.projectId]=editor.value;}else state.drafts[lessons[state.lesson].id]=editor.value;persist();}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,3400);}
function announce(message){$('announcement').textContent=message;}
function renderTrail(){
  $('progressCount').textContent=`${state.completed.size} / ${lessons.length}`;$('progressFill').style.width=`${state.completed.size/lessons.length*100}%`;
  $('lessonList').innerHTML=lessons.map((l,i)=>`<button class="lesson-item ${state.mode==='learn'&&state.lesson===i?'current':''} ${state.completed.has(l.id)?'complete':''}" data-lesson="${i}" ${state.mode==='learn'&&state.lesson===i?'aria-current="step"':''}><span class="lesson-number">${state.completed.has(l.id)?'✓':String(i+1).padStart(2,'0')}</span><span>${escapeHtml(l.title)}</span>${state.mode==='learn'&&state.lesson===i?'<span class="lesson-check" aria-hidden="true">›</span>':''}</button>`).join('');
}
function loadWorkspace({resetScene=true}={}){
  const free=state.mode==='free',lesson=lessons[state.lesson];
  $('learnMode').classList.toggle('selected',!free);$('freeMode').classList.toggle('selected',free);
  $('learnMode').setAttribute('aria-current',free?'false':'page');$('freeMode').setAttribute('aria-current',free?'page':'false');
  $('lessonTag').textContent=free?'YOUR IDEAS, YOUR RULES':`LESSON ${String(state.lesson+1).padStart(2,'0')} / ${lesson.tag.toUpperCase()}`;
  $('lessonTitle').textContent=free?'What will you make?':lesson.title;
  $('lessonIntro').textContent=free?'Try an idea, borrow an example, or invent a new drawing. This space is yours.':lesson.intro;
  $('filename').textContent=free?'my_idea.milo':lesson.id+'.milo';
  if(free)updateProjectHeading();
  $('challengeHeading').textContent=free?'A place to experiment':'Your little challenge';
  $('challengeText').textContent=free?'Open the field guide for drawing commands and examples. Change one thing, run it, and see what happens.':lesson.challenge;
  $('hintText').textContent=free?'Try a new color, a smaller turn, or a bigger repeat number. You can always reset your code.':lesson.hint;
  $('hintText').hidden=true;$('hintButton').textContent='A little hint ↗';$('hintButton').setAttribute('aria-expanded','false');
  $('challengeResult').hidden=true;$('challengeResult').replaceChildren();document.querySelector('.challenge-card').classList.remove('success');
  editor.value=free?state.freeCode:(state.drafts[lesson.id]??lesson.code);showLine(0);renderVariables([]);renderTrail();
  $('messages').innerHTML='<p class="empty-messages">A hello, an answer, a new idea.<br>Your program’s words appear here.</p>';
  if(resetScene)resetDrawing();setPhase('idle');persist();
}
function chooseLesson(index){stopRun(false);saveDraft();state.projectId=null;state.projectRevision=null;state.lesson=index;state.mode='learn';loadWorkspace();}
function freePlay(code){stopRun(false);saveDraft();state.mode='free';if(code!==undefined){state.projectId=null;state.projectRevision=null;state.freeCode=code;}loadWorkspace();}
function renderVariables(variables){
  state.variables=variables||[];$('variableCount').textContent=state.variables.length?`${state.variables.length} ${state.variables.length===1?'variable':'variables'}`:'Variables';
  $('variableList').innerHTML=state.variables.length?state.variables.map(v=>`<div class="variable-row"><code>${escapeHtml(v.name)}</code><span class="variable-value">${escapeHtml(v.value)}</span></div>`).join(''):'<p class="empty-variables">Variables will appear here as your code runs.</p>';
}
function setPhase(phase,label){
  if(['paused','pausing','stopped','error'].includes(phase))sound.silence();
  state.phase=phase;const active=['loading','running','stepping','pausing','paused','asking','waiting','keywaiting'].includes(phase),waiting=phase==='asking';
  editor.readOnly=active;$('saveProject').disabled=active;$('runButton').disabled=active&&phase!=='paused';$('runButton').querySelector('span').textContent=phase==='paused'?'Continue':'Run code';
  $('stepButton').disabled=phase==='loading'||phase==='stepping'||phase==='pausing'||waiting;
  $('stepButton').querySelector('span').textContent=['running','waiting','keywaiting'].includes(phase)?'Pause':phase==='paused'?'Next step':'Step';
  $('stopButton').disabled=!active;
  const labels={idle:'Ready to explore',loading:'Starting Milo…',running:'Making things happen',stepping:'Taking one step',pausing:'Pausing…',paused:'Paused before the next line',asking:'Your answer goes below',waiting:'Waiting…',keywaiting:'Choose an arrow or Space',complete:'Program finished',error:'A little fix is needed',stopped:'Program stopped'};
  $('runtimeStatus').className='status '+(phase==='error'?'error':active?'running':'');
  $('runtimeStatus').replaceChildren(Object.assign(document.createElement('span'),{}),document.createTextNode(label||labels[phase]||phase));
  if(waiting||phase==='paused'||phase==='running')state.lastActivity=performance.now();
}
function addOutput(text,system=false){
  const box=$('messages');if(box.querySelector('.empty-messages'))box.replaceChildren();
  const line=document.createElement('div');line.className=system?'system-line':'output-line';line.textContent=text;box.append(line);box.scrollTop=box.scrollHeight;
}
function stopRun(notify=true){
  sound.silence();
  if(!state.worker)return;
  state.worker.terminate();state.worker=null;hideKeyControls();state.pendingInput=null;$('answerForm').hidden=true;$('answerInput').value='';editor.readOnly=false;
  if(notify){setPhase('stopped');addOutput('Stopped. Your code is still here.',true);announce('Program stopped.');}
}
function finishWorker(){if(state.worker)state.worker.terminate();state.worker=null;hideKeyControls();state.pendingInput=null;$('answerForm').hidden=true;editor.readOnly=false;}
function startRun(mode){
  if(editor.value.length>20000){showError({line:0,message:'This program is a little big for the playground. Keep it under 20,000 characters.'});return;}
  if(!editor.value.trim()){toast('Add an instruction first, like say "Hello".');editor.focus();return;}
  stopRun(false);void sound.unlock();saveDraft();$('scorePanel').hidden=true;$('scoreValue').textContent='0';state.executionLine=0;state.errorLine=0;syncEditor();resetDrawing();renderVariables([]);
  $('messages').replaceChildren();$('answerForm').hidden=true;$('challengeResult').hidden=true;document.querySelector('.challenge-card').classList.remove('success');
  state.run={code:editor.value,lessonId:state.mode==='learn'?lessons[state.lesson].id:null,draw:[],output:[],answers:[],waits:[],waitIds:new Set(),keys:[],scores:[],notes:[],variables:[]};state.runMode=mode;state.lastActivity=performance.now();
  setPhase('loading');const worker=new Worker(new URL('./worker.js',import.meta.url));state.worker=worker;
  worker.onmessage=({data})=>{if(worker!==state.worker)return;
    if(data.type==='ready'){setPhase(mode==='step'?'stepping':'running');}
    else if(data.type==='trace'){showLine(data.line);renderVariables(data.variables);setPhase(data.paused?'paused':state.runMode==='step'?'stepping':'running',data.paused?`Paused before line ${data.line}`:undefined);}
    else if(data.type==='output'){state.run.output.push(data.payload);addOutput(data.payload);}
    else if(data.type==='draw'){state.run.draw.push(data.payload);drawCommand(data.payload);}
    else if(data.type==='score'){state.run.scores.push(data.payload);$('scorePanel').hidden=false;$('scoreValue').textContent=data.payload;}
    else if(data.type==='note'){state.run.notes.push(data.payload);sound.play(data.payload.note,data.payload.seconds);}
    else if(data.type==='control'){
      state.pendingInput=data.payload;
      const pending=data.payload;
      if(pending?.kind==='wait'&&!state.run.waitIds.has(pending.id)){state.run.waitIds.add(pending.id);state.run.waits.push(pending.seconds);}
      if(pending?.kind==='key'){
        $('keyControls').hidden=false;
        $('keyHint').textContent=pending.paused?'Paused. Choose Continue or Next step to listen again.':'Press an arrow or Space, or tap a button below. One press = one answer.';
        $('keyControls').querySelectorAll('button').forEach(button=>button.disabled=pending.paused);
        if(!pending.paused&&!document.querySelector('dialog[open]')){$('keyControls').focus();$('keyControls').scrollIntoView({block:'nearest'});announce('Your program is waiting for an arrow key or Space.');}
      }else hideKeyControls();
      setPhase(pending?.paused?'paused':pending?.kind==='key'?'keywaiting':pending?.kind==='wait'?'waiting':state.runMode==='step'?'stepping':'running',pending?.paused?`Paused while waiting${pending.kind==='key'?' for a key':''}`:pending?.kind==='wait'?`Waiting ${pending.seconds} seconds…`:undefined);
    }
    else if(data.type==='ask'){setPhase('asking');$('answerLabel').textContent=data.prompt||'What would you like to answer?';$('answerForm').hidden=false;$('answerInput').value='';$('answerInput').focus();$('answerForm').scrollIntoView({behavior:'auto',block:'nearest'});}
    else if(data.type==='complete'){state.run.variables=data.payload.variables;renderVariables(data.payload.variables);finishWorker();showLine(0);setPhase('complete');if(!state.run.output.length)addOutput(state.run.draw.length?'Your drawing is ready. What will you try next?':'Your program finished. Use say to show a message here.',true);checkChallenge();announce('Your program finished.');}
    else if(data.type==='error'){finishWorker();showError(data.payload);}
  };
  worker.onerror=event=>{event.preventDefault();if(worker===state.worker){finishWorker();showError({line:0,message:'Milo could not start. Reload this page, then run your code again.'});}};
  worker.postMessage({type:'start',code:state.run.code,mode,speed:state.pace});
}
function checkChallenge(){
  const lesson=lessons.find(l=>l.id===state.run.lessonId);if(!lesson)return;
  if(lesson.check(state.run)){
    state.completed.add(lesson.id);persist();renderTrail();document.querySelector('.challenge-card').classList.add('success');
    $('challengeHeading').textContent='You made it';$('challengeText').textContent=lesson.nextTip;
    $('challengeResult').hidden=false;const next=document.createElement('button');next.className='secondary-button';next.textContent=state.lesson<lessons.length-1?'Try the next idea →':'Keep creating in Free play →';next.onclick=()=>state.lesson<lessons.length-1?chooseLesson(state.lesson+1):freePlay();$('challengeResult').replaceChildren(next);announce('Challenge complete. '+lesson.nextTip);
  }else addOutput('Your code ran. Give the little challenge a try, too.',true);
}
function distance(a,b){const d=Array.from({length:a.length+1},(_,i)=>[i]);for(let j=1;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);}return d[a.length][b.length];}
function explainError(raw,line){
  const unknown=raw.match(/I do not know ['"]([^'"]+)['"]/);
  if(unknown){
    const name=unknown[1],candidates=new Set([...state.variables.map(v=>v.name),...editor.value.matchAll(/^\s*([\p{L}_][\p{L}\p{N}_]*)\s*=/gmu)].map(v=>typeof v==='string'?v:v[1]));
    for(const cmd of ['random','play_note','show_score','sprite','place','shift','touching','hide','show','wait','key','move','turn','color','width','circle','go_to','dot','fill','no_fill','rectangle','polygon','ask','number','pen_up','pen_down','home','clear','write','length','text','upper','lower'])candidates.add(cmd);
    for(const match of editor.value.matchAll(/function\s+([\p{L}_][\p{L}\p{N}_]*)/gu))candidates.add(match[1]);
    const nearest=[...candidates].filter(c=>c!==name).map(c=>({name:c,d:distance(name,c)})).sort((a,b)=>a.d-b.d)[0];
    if(nearest&&nearest.d<=Math.max(1,Math.floor(name.length/3)))return {message:`I don’t recognize ${name}. Did you mean ${nearest.name}?`,hint:'Names need to be spelled the same way each time.',fix:{from:name,to:nearest.name,line}};
    return {message:`I don’t recognize ${name} yet.`,hint:`Give it a value first, like ${name} = 10. Put words in quotes if you want to print text.`};
  }
  if(/needs an end|Expected end|no matching block/.test(raw))return {message:'Let’s check where this block ends.',hint:'Every repeat, if, while, for, and function block needs end on its own line. Each nested block needs its own end.'};
  if(/unclosed|quoted text/.test(raw))return {message:'A quote is missing.',hint:'Put a quote at both ends of your words, like say "Hello".'};
  if(/divide by zero/.test(raw))return {message:'We can’t divide a number by zero.',hint:'Try another number after / or //.'};
  if(/Cannot convert|convert empty|invalid literal/.test(raw))return {message:'I need a number here.',hint:'Run the program again and answer with a number, like 12. ask returns text; number turns numeric text into a number.'};
  if(/Step limit|smaller repeat|teaching steps/.test(raw))return {message:'This program is doing a lot of repeating.',hint:'Try a smaller repeat number, or check that your while condition can become false.'};
  if(/position does not exist/.test(raw))return {message:'That position is outside the list or text.',hint:'Positions start at 0. A list with three items has positions 0, 1, and 2.'};
  if(/Unexpected ':'/.test(raw))return {message:'This line doesn’t need a colon.',hint:'Milo uses end to close a block. Try repeat 4 instead of repeat 4:.'};
  if(/Expected a value/.test(raw))return {message:'This instruction needs another value.',hint:'Check for a missing number, variable, or closing bracket on this line.'};
  if(/needs .*values/.test(raw))return {message:raw,hint:'Check the parentheses and values for this command in Help & commands.'};
  if(/overflow|outside the supported/.test(raw))return {message:'That number is too big for Milo.',hint:'Try a smaller number or fewer repetitions.'};
  return {message:raw,hint:'Look at the highlighted line. Help & commands has small examples you can borrow.'};
}
function showError({line=0,message}){
  showLine(line,true);setPhase('error');const detail=explainError(message,line),card=document.createElement('article');card.className='error-card';
  card.innerHTML=`<h3>${line?'Let’s fix line '+line:'Let’s take a look'}</h3><p>${escapeHtml(detail.message)}</p><p>${escapeHtml(detail.hint)}</p><details><summary>Original message</summary><pre>${escapeHtml(message)}</pre></details>`;
  if(detail.fix){const button=document.createElement('button');button.className='secondary-button';button.textContent='Use '+detail.fix.to;button.onclick=()=>{
    const lines=editor.value.split('\n'),index=detail.fix.line-1;
    if(index<0||index>=lines.length)return;
    lines[index]=lines[index].replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[^\n]*|[\p{L}_][\p{L}\p{N}_]*)/gu,token=>token===detail.fix.from?detail.fix.to:token);
    editor.value=lines.join('\n');showLine(0);saveDraft();editor.focus();toast('Updated the name. Try running your code again.');button.disabled=true;
  };card.append(button);}
  if($('messages').querySelector('.empty-messages'))$('messages').replaceChildren();$('messages').append(card);$('messages').scrollTop=$('messages').scrollHeight;announce(detail.message);
}
// Drawing is data from the C++ engine. No Milo source is evaluated in JavaScript.
let scene;
const canvas=$('drawingCanvas'),context=canvas.getContext('2d');
function resetDrawing(){$('scorePanel').hidden=true;scene=createScene();$('canvasWelcome').hidden=false;renderDrawing();}
function renderDrawing(target=context,grid=$('gridToggle').checked,turtle=true){
  renderScene(target,scene,{grid});
  if(turtle){$('turtleLayer').style.display=scene.sprites.length?'none':'';$('spriteStatus').hidden=!scene.sprites.length;$('spriteStatus').textContent=scene.sprites.length?'Sprites: '+(scene.sprites.filter(s=>s.visible).map(s=>`${s.shape} #${s.id} (${Math.round(s.x-250)}, ${Math.round(250-s.y)})`).join(' · ')||'all hidden'):'';$('turtle').setAttribute('transform',`translate(${scene.x} ${scene.y}) rotate(${scene.angle+90})`);$('turtlePosition').textContent=`x ${Math.round(scene.x-250)}   y ${Math.round(250-scene.y)}`;}
}
function drawCommand(command){$('canvasWelcome').hidden=true;applyCommand(scene,command);renderDrawing();}
function download(blob,name){const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('downloadCode').onclick=()=>{download(new Blob([editor.value],{type:'text/plain;charset=utf-8'}),$('filename').textContent);toast('Your program is ready to keep.');};
$('downloadPicture').onclick=()=>{const picture=document.createElement('canvas');picture.width=1000;picture.height=1000;renderDrawing(picture.getContext('2d'),false,false);picture.toBlob(blob=>{if(blob)download(blob,'milo-drawing.png');},'image/png');};
$('lessonList').onclick=event=>{const button=event.target.closest('[data-lesson]');if(button)chooseLesson(Number(button.dataset.lesson));};
$('startFirst').onclick=()=>chooseLesson(0);$('learnMode').onclick=()=>chooseLesson(state.lesson);$('freeMode').onclick=()=>freePlay();
$('runButton').onclick=()=>{if(state.phase==='paused'){void sound.unlock();state.runMode='run';state.worker.postMessage({type:'continue'});setPhase('running');}else startRun('run');};
$('stepButton').onclick=()=>{if(['running','waiting','keywaiting'].includes(state.phase)){state.runMode='step';state.worker.postMessage({type:'pause'});setPhase('pausing');}else if(state.phase==='paused'){void sound.unlock();state.runMode='step';state.worker.postMessage({type:'step'});setPhase('stepping');}else startRun('step');};
$('stopButton').onclick=()=>stopRun();
function hideKeyControls(){
  if($('keyControls').contains(document.activeElement))$('stopButton').focus();
  $('keyControls').hidden=true;
}
function sendKey(key){
  if(!state.worker||state.phase!=='keywaiting'||!state.pendingInput||document.querySelector('dialog[open]'))return;
  state.run.keys.push(key);state.pendingInput=null;
  $('keyControls').querySelectorAll('button').forEach(button=>button.disabled=true);
  state.worker.postMessage({type:'key',key});
}
$('keyControls').addEventListener('click',event=>{const button=event.target.closest('[data-key]');if(button)sendKey(button.dataset.key);});
$('keyControls').addEventListener('keydown',event=>{
  if(event.ctrlKey||event.metaKey||event.altKey)return;
  const key={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',' ':'space'}[event.key];
  if(!key)return;event.preventDefault();if(!event.repeat)sendKey(key);
});

$('resetCode').onclick=()=>{stopRun(false);editor.value=state.mode==='learn'?lessons[state.lesson].code:'say "What will you make?"\n';showLine(0);saveDraft();setPhase('idle');toast('Starter code restored.');};
$('hintButton').onclick=()=>{const opening=$('hintText').hidden;$('hintText').hidden=!opening;$('hintButton').textContent=opening?'Keep exploring ↗':'A little hint ↗';$('hintButton').setAttribute('aria-expanded',String(opening));};
$('gridToggle').onchange=()=>renderDrawing();$('speedSelect').onchange=()=>{state.pace=Number($('speedSelect').value);state.worker?.postMessage({type:'speed',value:state.pace});};
$('answerForm').onsubmit=event=>{event.preventDefault();if(!state.worker)return;const answer=$('answerInput').value;state.run.answers.push(answer);addOutput('› '+answer,true);$('answerForm').hidden=true;state.worker.postMessage({type:'answer',answer});setPhase(state.runMode==='step'?'stepping':'running');};
editor.addEventListener('input',()=>{state.errorLine=0;syncEditor();$('saveState').textContent='Saving…';clearTimeout(editor.saveTimer);editor.saveTimer=setTimeout(saveDraft,250);});editor.addEventListener('scroll',syncScroll);
editor.addEventListener('keydown',event=>{
  if(event.key==='Tab'&&!event.shiftKey&&!editor.readOnly){event.preventDefault();const start=editor.selectionStart,end=editor.selectionEnd;editor.setRangeText('    ',start,end,'end');editor.dispatchEvent(new Event('input'));}
  if(event.key==='Enter'&&!event.ctrlKey&&!event.metaKey&&!editor.readOnly){const start=editor.selectionStart,before=editor.value.slice(0,start).split('\n').at(-1),indent=before.match(/^ */)[0];const extra=/^\s*(repeat|if|while|for|function)\b/.test(before)?'    ':'';event.preventDefault();editor.setRangeText('\n'+indent+extra,start,editor.selectionEnd,'end');editor.dispatchEvent(new Event('input'));}
});
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&!document.querySelector('dialog[open]')){event.preventDefault();if(!$('runButton').disabled)$('runButton').click();}});
$('helpButton').onclick=()=>$('helpDialog').showModal();document.querySelectorAll('.dialog-close').forEach(button=>button.onclick=()=>button.closest('dialog').close());
$('commandList').innerHTML=commands.map(([code,description])=>`<article class="command-row"><pre>${escapeHtml(code)}</pre><p>${escapeHtml(description)}</p></article>`).join('');
$('exampleList').innerHTML=examples.map((example,i)=>`<article class="example-item"><span>${escapeHtml(example.name)}</span><button data-example="${i}">Open example →</button></article>`).join('');
$('exampleList').onclick=event=>{const button=event.target.closest('[data-example]');if(button){freePlay(examples[Number(button.dataset.example)].code);$('helpDialog').close();toast('Example opened in Free play.');}};
for(const [button,panel,otherButton,otherPanel] of [['commandsTab','commandList','examplesTab','exampleList'],['examplesTab','exampleList','commandsTab','commandList']])$(button).onclick=()=>{$(panel).hidden=false;$(otherPanel).hidden=true;$(button).classList.add('selected');$(otherButton).classList.remove('selected');};
function info(title,paragraphs){$('infoTitle').textContent=title;$('infoContent').replaceChildren(...paragraphs.map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));$('infoDialog').showModal();}
$('privacyButton').onclick=()=>info('Your ideas stay with you',['Your programs run on your device in a browser worker. Your code and answers are not uploaded to a server.','Named projects, drawing thumbnails, code drafts, your last lesson, and completed challenges are saved in this browser’s local storage. Other people using the same browser profile may see them. Clear this site’s storage in your browser settings to remove them.','There are no advertising trackers or analytics in this playground. Download a .milo file if you want a copy you can keep or move to another device.']);
$('termsButton').onclick=()=>info('Made for curious minds',['Milo Playground is an experimental learning tool for kids and beginners. It includes fourteen lessons and a place to try your own ideas.','The C++ Milo bytecode engine runs locally through WebAssembly. Drawing commands are additions for this playground. The desktop language remains a separate project.','Programs have teaching step and drawing limits so a runaway loop can be stopped. This playground is for learning and experimenting; it is not a general security sandbox.']);
$('importButton').onclick=()=>$('importFile').click();$('importFile').onchange=async()=>{const file=$('importFile').files[0];if(!file)return;if(file.size>20000){toast('Choose a program under 20 KB.');return;}freePlay(await file.text());$('importFile').value='';toast('Program opened in Free play.');};
setInterval(()=>{if(state.worker&&['loading','running','pausing','stepping'].includes(state.phase)&&performance.now()-state.lastActivity>20000){stopRun(false);setPhase('stopped');addOutput('Taking a break. Try fewer repetitions or use Step to follow your program.',true);}},1000);
let galleryView='active',projectDialogMode='save',dialogRecord=null,saveAsCopy=false;
function getProject(id){try{return id?projectStore.get(id):null;}catch{return null;}}
function updateProjectHeading(){
  const project=getProject(state.projectId);
  if(project&&!project.deletedAt){$('lessonTitle').textContent=project.name;$('lessonTag').textContent='YOUR OWN CREATION';$('filename').textContent=(project.name.replace(/[^\p{L}\p{N}_ -]/gu,'').trim().replace(/\s+/g,'_')||'my_project')+'.milo';}
}
function refreshProjectCount(){try{$('projectCount').textContent=projectStore.list().length;}catch{$('projectCount').textContent='–';}}
function galleryError(error){$('galleryError').textContent=error.message||String(error);$('galleryError').hidden=false;}
function renderGallery(){
  $('galleryError').hidden=true;
  for(const [id,view] of [['activeProjectsTab','active'],['starterProjectsTab','starters'],['projectBinTab','bin']]){$(id).classList.toggle('selected',galleryView===view);$(id).setAttribute('aria-pressed',String(galleryView===view));}
  $('starterIntro').hidden=galleryView!=='active';
  $('galleryFootnote').textContent=galleryView==='starters'?'Choose Make a copy to save an editable project. Starters stay here for you to try again. Previews show a sample run; games and animations may look different when played.':'A thumbnail shows the last drawing you saved. Open a project and run its code to draw it again. Download important programs to keep a separate copy.';
  if(galleryView==='starters'){
    $('projectGrid').innerHTML=starterProjects.map(project=>`<article class="project-card starter-card"><div class="project-preview">${project.thumbnail?`<img src="${escapeHtml(project.thumbnail)}" alt="Example preview for ${escapeHtml(project.name)}" loading="lazy">`:`<pre class="project-code-preview">${escapeHtml(project.code.split('\n').slice(0,5).join('\n'))}</pre>`}</div><div class="project-card-body"><span class="starter-category">${escapeHtml(project.category)}</span><h3>${escapeHtml(project.name)}</h3><p class="starter-description">${escapeHtml(project.description)}</p><div class="project-actions"><button class="project-open" data-starter="${escapeHtml(project.id)}" aria-label="Make a copy of ${escapeHtml(project.name)}">Make a copy →</button></div></div></article>`).join('');return;
  }
  let projects;
  try{projects=projectStore.list({bin:galleryView==='bin'});}catch(error){galleryError(error);$('projectGrid').replaceChildren();return;}
  $('activeProjectsTab').classList.toggle('selected',galleryView==='active');$('projectBinTab').classList.toggle('selected',galleryView==='bin');
  if(!projects.length){$('projectGrid').innerHTML=`<div class="gallery-empty"><span class="empty-project-art" aria-hidden="true">${galleryView==='bin'?'↶':'✦'}</span><h3>${galleryView==='bin'?'Nothing in the bin':'Every idea deserves a home'}</h3><p>${galleryView==='bin'?'Projects you move here can be restored. Nothing is removed permanently.':'Save a program from the editor, or make a copy of a starter project. Your drawings will become little previews here.'}</p>${galleryView==='active'?'<button class="primary-button" data-new="true">Make a new project</button>':''}</div>`;return;}
  $('projectGrid').innerHTML=projects.map(project=>{
    const draft=state.projectDrafts[project.id],hasDraft=typeof draft==='string'&&draft!==project.code;
    const date=new Date(project.updatedAt),dateText=Number.isNaN(date.getTime())?'Saved here':date.toLocaleDateString(undefined,{month:'short',day:'numeric'});
    const preview=project.thumbnail?`<img src="${escapeHtml(project.thumbnail)}" alt="Saved drawing for ${escapeHtml(project.name)}" loading="lazy">`:`<pre class="project-code-preview">${escapeHtml(project.code.split('\n').slice(0,5).join('\n'))}</pre>`;
    return `<article class="project-card"><div class="project-preview">${preview}</div><div class="project-card-body"><h3>${escapeHtml(project.name)}</h3><p class="project-meta">${galleryView==='bin'?'In the project bin':'Saved '+escapeHtml(dateText)}${hasDraft?' · Draft edits kept':''}</p><div class="project-actions">${galleryView==='bin'?`<button class="project-open" data-project-action="restore" data-project="${escapeHtml(project.id)}" aria-label="Restore ${escapeHtml(project.name)}">Restore project</button>`:`<button class="project-open" data-project-action="open" data-project="${escapeHtml(project.id)}" aria-label="Open ${escapeHtml(project.name)}">Open →</button><button class="subtle-button" data-project-action="rename" data-project="${escapeHtml(project.id)}" aria-label="Rename ${escapeHtml(project.name)}">Rename</button><button class="subtle-button" data-project-action="copy" data-project="${escapeHtml(project.id)}" aria-label="Copy ${escapeHtml(project.name)}">Copy</button><button class="subtle-button project-bin-action" data-project-action="bin" data-project="${escapeHtml(project.id)}" aria-label="Move ${escapeHtml(project.name)} to bin">To bin</button>`}</div></div></article>`;
  }).join('');
}
function openGallery(){saveDraft();galleryView='active';renderGallery();refreshProjectCount();$('galleryDialog').showModal();$('galleryButton').classList.add('selected');$('galleryButton').setAttribute('aria-expanded','true');}
function openProject(id){
  const project=projectStore.get(id);if(!project||project.deletedAt)throw new Error('Restore this project from the bin before opening it.');
  stopRun(false);saveDraft();state.mode='free';state.projectId=project.id;state.projectRevision=project.revision;
  const draft=state.projectDrafts[id];state.freeCode=typeof draft==='string'?draft:project.code;
  $('galleryDialog').close();loadWorkspace();toast(draft!==undefined&&draft!==project.code?'Opened your project with its unsaved draft edits.':'Project opened. Run it to bring your idea back to life.');
}
function currentThumbnail(old){
  if(state.phase==='complete'&&state.run?.code===editor.value){
    if(!scene.shapes.length&&!scene.sprites.some(s=>s.visible))return null;
    const preview=document.createElement('canvas');preview.width=200;preview.height=200;renderScene(preview.getContext('2d'),scene,{grid:false,scale:.4});return preview.toDataURL('image/png');
  }
  return old?.code===editor.value?old.thumbnail:null;
}
function openProjectDialog({copy=false,renameId=null,newProject=false}={}){
  projectDialogMode=renameId?'rename':newProject?'new':'save';saveAsCopy=copy;
  dialogRecord=newProject?null:getProject(renameId||state.projectId);
  if(dialogRecord?.deletedAt){saveAsCopy=true;dialogRecord=null;}
  $('projectDialogTitle').textContent=renameId?'Rename your project':newProject?'Start a new project':'Save your project';
  const suggested=dialogRecord?.name||(state.mode==='learn'?lessons[state.lesson].title:'My next idea');
  $('projectName').value=(suggested+(copy?' copy':'')).slice(0,60);
  $('projectSubmit').textContent=renameId?'Save name':newProject?'Create project':copy?'Save copy':dialogRecord?'Save changes':'Save project';
  $('saveCopy').hidden=projectDialogMode!=='save'||!dialogRecord||copy;
  $('projectFormError').hidden=true;
  $('projectSaveHint').textContent=renameId?'Your program and drawing preview will stay the same.':newProject?'Start with a hello, then make it your own.':state.phase==='complete'&&(scene.shapes.length||scene.sprites.some(s=>s.visible))&&state.run?.code===editor.value?'Your current drawing will be saved as the project preview.':'Your code will be saved. Run this version to add a drawing preview.';
  $('projectDialog').showModal();$('projectName').focus();$('projectName').select();
}
function saveProjectForm(event){
  event.preventDefault();$('projectFormError').hidden=true;
  try{
    const name=$('projectName').value;
    if(projectDialogMode==='rename'){
      const record=projectStore.rename(dialogRecord.id,name,dialogRecord.revision);
      if(state.projectId===record.id){state.projectRevision=record.revision;updateProjectHeading();persist();}
      $('projectDialog').close();renderGallery();refreshProjectCount();toast('Project renamed.');return;
    }
    if(projectDialogMode==='new'){
      const record=projectStore.save({name,code:'say "My next idea starts here."\n'});
      $('projectDialog').close();refreshProjectCount();openProject(record.id);return;
    }
    const old=!saveAsCopy?dialogRecord:null;
    const record=projectStore.save({id:old?.id||null,name,code:editor.value,thumbnail:currentThumbnail(dialogRecord),expectedRevision:old?state.projectRevision:null});
    const previousPhase=state.phase,variables=state.variables.slice(),messages=[...$('messages').childNodes];
    saveDraft();state.projectId=record.id;state.projectRevision=record.revision;state.projectDrafts[record.id]=record.code;state.freeCode=record.code;
    if(state.mode==='learn'){state.mode='free';loadWorkspace({resetScene:false});renderVariables(variables);$('messages').replaceChildren(...messages);setPhase(previousPhase);}
    else updateProjectHeading();
    persist();$('projectDialog').close();refreshProjectCount();if($('galleryDialog').open)renderGallery();toast('Project saved in My projects.');announce('Project saved.');
  }catch(error){$('projectFormError').textContent=error.message||String(error);$('projectFormError').hidden=false;}
}
function initGallery(){
  refreshProjectCount();
  $('galleryButton').onclick=openGallery;$('saveProject').onclick=()=>openProjectDialog();$('newProject').onclick=()=>openProjectDialog({newProject:true});
  $('galleryDialog').addEventListener('close',()=>{$('galleryButton').classList.remove('selected');$('galleryButton').setAttribute('aria-expanded','false');});
  $('starterProjectsTab').onclick=$('browseStarters').onclick=()=>{galleryView='starters';renderGallery();};
  $('activeProjectsTab').onclick=()=>{galleryView='active';renderGallery();};$('projectBinTab').onclick=()=>{galleryView='bin';renderGallery();};
  $('projectForm').onsubmit=saveProjectForm;$('cancelProject').onclick=()=>$('projectDialog').close();
  $('saveCopy').onclick=()=>{saveAsCopy=true;$('projectSubmit').textContent='Save copy';$('saveCopy').hidden=true;$('projectName').value=($('projectName').value+' copy').slice(0,60);$('projectName').focus();};
  $('projectGrid').onclick=event=>{
    const starterButton=event.target.closest('[data-starter]');
    if(starterButton){
      try{const starter=starterProjects.find(project=>project.id===starterButton.dataset.starter);if(!starter)return;const record=createStarterCopy(projectStore,starter);refreshProjectCount();openProject(record.id);toast('Your own copy is ready. Run it, then make it yours.');}catch(error){galleryError(error);}return;
    }
    if(event.target.closest('[data-new]')){openProjectDialog({newProject:true});return;}
    const button=event.target.closest('[data-project-action]');if(!button)return;
    const id=button.dataset.project,action=button.dataset.projectAction;
    try{
      if(action==='open')openProject(id);
      else if(action==='rename')openProjectDialog({renameId:id});
      else if(action==='copy'){
        const old=projectStore.get(id),code=state.projectDrafts[id]??old.code;
        const copy=projectStore.save({name:(old.name+' copy').slice(0,60),code,thumbnail:code===old.code?old.thumbnail:null});
        refreshProjectCount();renderGallery();toast('A separate copy is ready in your gallery.');
      }else if(action==='bin'){
        projectStore.moveToBin(id);if(state.projectId===id){state.projectId=null;state.projectRevision=null;$('lessonTitle').textContent='What will you make?';$('filename').textContent='my_idea.milo';persist();}
        refreshProjectCount();renderGallery();toast('Moved to the project bin. You can restore it there.');
      }else if(action==='restore'){projectStore.restore(id);refreshProjectCount();renderGallery();toast('Project restored to My projects.');}
    }catch(error){galleryError(error);}
  };
  window.addEventListener('storage',event=>{if(event.key==='milo-projects.v1'){refreshProjectCount();if($('galleryDialog').open)renderGallery();}});
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'&&!document.querySelector('dialog[open]')){event.preventDefault();if(!$('saveProject').disabled)openProjectDialog();}});
}

// Expose read-only learning state for accessible diagnostics and automated QA.
window.miloPlayground={getState:()=>({phase:state.phase,line:state.executionLine,variables:structuredClone(state.variables),completed:[...state.completed],drawing:structuredClone(scene),output:state.run?.output.slice()||[]})};
function initPanelOrder(){
  const results=document.querySelector('.results-column');
  const canvas=results.querySelector('.canvas-card');
  const messages=results.querySelector('.messages-card');
  const note=results.querySelector('.workspace-note');
  const button=$('swapPanels');
  const key='milo-panel-order.v1';
  let messagesFirst=false;
  try{messagesFirst=localStorage.getItem(key)==='messages-first';}catch{}
  function apply(){
    // Move the original panel so its canvas, output, and input remain intact.
    results.insertBefore(messages,messagesFirst?canvas:note);
    button.title=messagesFirst?'Show Your canvas above Messages':'Show Messages above Your canvas';
  }
  apply();
  button.onclick=()=>{
    messagesFirst=!messagesFirst;
    apply();
    try{localStorage.setItem(key,messagesFirst?'messages-first':'canvas-first');}catch{}
    announce(messagesFirst?'Messages is now above Your canvas.':'Your canvas is now above Messages.');
  };
}
initGallery();
initPanelOrder();
loadWorkspace();

