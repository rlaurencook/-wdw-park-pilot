const API='https://api.themeparks.wiki/v1';
const els=id=>document.getElementById(id);
const state={parks:[],park:null,children:[],live:[],rides:[],position:null,watchId:null,completed:new Set(JSON.parse(localStorage.getItem('pp_completed')||'[]')),favorites:new Set(JSON.parse(localStorage.getItem('pp_favorites')||'[]')),lls:JSON.parse(localStorage.getItem('pp_lls')||'[]'),rope:localStorage.getItem('pp_rope')==='1',auto:true,lastRefresh:null,recommendations:[],plan:null,map:null,userMarker:null,destMarker:null,line:null};

function n(s){return (s||'').toLowerCase().replace(/[^a-z0-9]/g,'')}
function fmtTime(d){return new Date(d).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}
function mins(ms){return Math.round(ms/60000)}
function persist(){localStorage.setItem('pp_completed',JSON.stringify([...state.completed]));localStorage.setItem('pp_favorites',JSON.stringify([...state.favorites]));localStorage.setItem('pp_lls',JSON.stringify(state.lls));localStorage.setItem('pp_rope',state.rope?'1':'0')}
function hav(a,b){const R=6371000,p=x=>x*Math.PI/180,dLat=p(b.lat-a.lat),dLon=p(b.lng-a.lng),la1=p(a.lat),la2=p(b.lat);const x=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function walkMinutes(a,b){if(!a||!b)return 7;return Math.max(1,Math.ceil(hav(a,b)*1.22/78))}
function duration(name){const s=n(name);if(s.includes('spaceship')||s.includes('livingwiththeland'))return 15;if(s.includes('safari'))return 22;if(s.includes('carouselofprogress'))return 21;if(s.includes('soarin'))return 10;if(s.includes('pirates'))return 9;if(s.includes('hauntedmansion'))return 10;return 6}
function demand(name){const s=n(name);const high=['slinkydog','flightofpassage','guardiansofthegalaxy','riseoftheresistance','seven dwarfs','sevendwarfs','tron','remy','frozen'];if(high.some(x=>s.includes(n(x))))return 4;const med=['towerofterror','rocknroller','runawayrailway','safari','peterpan','space mountain','spacemountain','soarin'];if(med.some(x=>s.includes(n(x))))return 3;return 1}
function operating(r){const s=(r.status||'').toUpperCase();return s==='OPERATING'||s==='OPEN'}
function llFor(name,at=new Date()){return state.lls.filter(x=>!x.used&&n(x.attractionName)===n(name)&&new Date(x.end)>=at).sort((a,b)=>new Date(a.start)-new Date(b.start))[0]}

async function loadParks(){
  try{
    const d=await (await fetch(`${API}/destinations`)).json();
    const w=d.destinations.find(x=>x.name.toLowerCase().includes('walt disney world'));
    state.parks=(w?.parks||[]).filter(p=>/Magic Kingdom|EPCOT|Hollywood Studios|Animal Kingdom/i.test(p.name));
    const sel=els('parkSelect');sel.innerHTML='<option value="">Choose park…</option>'+state.parks.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
    const saved=localStorage.getItem('pp_park');if(saved&&state.parks.some(p=>p.id===saved)){sel.value=saved;await choosePark(saved)}
  }catch(e){toast('Could not load WDW parks. Check your connection.');}
}
async function choosePark(id){
  state.park=state.parks.find(p=>p.id===id)||null; if(!state.park)return;
  localStorage.setItem('pp_park',id);els('parkTitle').textContent=state.park.name;
  await Promise.all([loadChildren(),refreshLive()]);
}
async function loadChildren(){
  const d=await (await fetch(`${API}/entity/${state.park.id}/children`)).json();state.children=d.children||[];mergeRides();
}
async function refreshLive(){
  if(!state.park)return;
  els('refreshBtn').textContent='…';
  try{const d=await (await fetch(`${API}/entity/${state.park.id}/live`,{cache:'no-store'})).json();state.live=d.liveData||[];state.lastRefresh=new Date();mergeRides();renderAll();}
  catch(e){toast('Live refresh failed; showing cached/local data if available.');}
  finally{els('refreshBtn').textContent='↻'}
}
function mergeRides(){
  const cmap=new Map(state.children.map(x=>[x.id,x]));
  state.rides=state.live.filter(l=>['ATTRACTION','SHOW'].includes((l.entityType||cmap.get(l.entityId)?.entityType||'').toUpperCase())||l.queue?.STANDBY).map(l=>{
    const c=cmap.get(l.entityId),q=l.queue||{},paid=q.PAID_RETURN_TIME||q.RETURN_TIME;
    return {id:l.entityId,name:l.name||c?.name||'Attraction',lat:c?.location?.latitude,lng:c?.location?.longitude,status:l.status||'UNKNOWN',wait:q.STANDBY?.waitTime??null,paidStart:paid?.returnStart?new Date(paid.returnStart):null,paidEnd:paid?.returnEnd?new Date(paid.returnEnd):null,paidState:paid?.state||null,price:paid?.price?.formatted||paid?.price?.amount||null,last:l.lastUpdated?new Date(l.lastUpdated):null};
  }).filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lng));
  updateLLRideChoices();
}

function rankRides(now=new Date()){
  const pos=state.position?{lat:state.position.coords.latitude,lng:state.position.coords.longitude}:null;
  const upcoming=state.lls.filter(x=>!x.used&&new Date(x.end)>now).sort((a,b)=>new Date(a.start)-new Date(b.start));
  return state.rides.filter(r=>!state.completed.has(r.id)&&operating(r)).map(r=>{
    const target={lat:r.lat,lng:r.lng},walk=walkMinutes(pos,target),wait=r.wait??15;let score=wait+walk*.85,reasons=[`${walk} min walk`,r.wait!=null?`${r.wait} min standby`:'standby unknown'],urg='BEST NEXT';
    if(state.favorites.has(r.id)){score-=18;reasons.push('priority ride')}
    if(state.rope){const d=demand(r.name);score-=d*5.5;if(d>=3)reasons.push('high-value rope-drop target')}
    const own=upcoming.find(x=>n(x.attractionName)===n(r.name));
    if(own){const us=(new Date(own.start)-now)/60000,ue=(new Date(own.end)-now)/60000;if(ue>=0&&us<=15){score-=120;urg='GO NOW';reasons.push('your LL window is active/near')}else if(us>15&&us<60){score-=35;urg='SOON';reasons.push(`your LL opens in ${Math.round(us)} min`)}}
    const next=upcoming.find(x=>n(x.attractionName)!==n(r.name));if(next){const t=(new Date(next.start)-now)/60000,cycle=walk+wait+duration(r.name);if(t>0&&cycle>t-10){score+=55;reasons.push(`could jeopardize ${next.attractionName} LL`)}}
    if(r.paidStart&&r.paidStart>now&&(r.paidStart-now)/60000<45){score-=6;reasons.push('live LL return is near')}
    return {...r,walk,score,reasons,urg,distance:pos?hav(pos,target):null}
  }).sort((a,b)=>({"GO NOW":0,"SOON":1,"BEST NEXT":2}[a.urg]-({"GO NOW":0,"SOON":1,"BEST NEXT":2}[b.urg])||a.score-b.score));
}

function optimize(depth=4,now=new Date()){
  const ranked=rankRides(now).slice(0,14),pos=state.position?{lat:state.position.coords.latitude,lng:state.position.coords.longitude}:null;
  if(!ranked.length)return null;
  let beam=[{stops:[],used:new Set(),coord:pos,clock:now,obj:0,walk:0,queue:0}];const width=45;
  for(let k=0;k<Math.min(depth,ranked.length);k++){
    const out=[];
    for(const s of beam)for(const r of ranked){if(s.used.has(r.id))continue;const target={lat:r.lat,lng:r.lng},walk=walkMinutes(s.coord,target),arrival=new Date(s.clock.getTime()+walk*60000),ll=llFor(r.name,arrival);let queue=r.wait??15,useLL=false,idle=0;if(ll&&!ll.used){const st=new Date(ll.start),en=new Date(ll.end);if(arrival<st){const until=Math.ceil((st-arrival)/60000);if(until<=25){useLL=true;idle=Math.max(0,until);queue=5}}else if(arrival<=en){useLL=true;queue=5}}
      const start=new Date(arrival.getTime()+idle*60000),finish=new Date(start.getTime()+(queue+duration(r.name))*60000);let cost=walk+idle+queue+duration(r.name),notes=[];if(useLL){cost-=20;notes.push('use your Lightning Lane')}if(state.favorites.has(r.id)){cost-=16;notes.push('priority ride')}if(state.rope){const d=demand(r.name);cost-=d*4.5;if(d>=3)notes.push('rope-drop value')}
      for(const f of state.lls.filter(x=>!x.used&&n(x.attractionName)!==n(r.name))){if(finish>new Date(f.end)){cost+=90;notes.push(`risks missing ${f.attractionName} LL`)}else{const q=(new Date(f.start)-finish)/60000;if(q>=0&&q<20){cost+=18;notes.push(`${f.attractionName} LL is soon after`)}}}
      if(r.wait!=null&&demand(r.name)>=3&&r.wait<=25){cost-=12;notes.push('strong live wait')}
      const ns={stops:[...s.stops,{...r,eta:arrival,start,finish,walk,queue,useLL,notes}],used:new Set(s.used),coord:target,clock:finish,obj:s.obj+cost,walk:s.walk+walk,queue:s.queue+queue};ns.used.add(r.id);out.push(ns)
    }
    if(!out.length)break;beam=out.sort((a,b)=>(a.obj/a.stops.length)-(b.obj/b.stops.length)).slice(0,width)
  }
  return beam.sort((a,b)=>a.obj-b.obj)[0]||null;
}

function renderAll(){state.recommendations=rankRides();state.plan=optimize();renderHero();renderPlan();renderLLs();renderRides();updateMap();}
function renderHero(){const r=state.recommendations[0];if(!r){els('nextRide').textContent='No operating recommendation';els('heroReason').textContent='Live park data may be unavailable or all rides are marked complete.';els('directionsBtn').disabled=true;els('completeBtn').disabled=true;return}els('urgencyBadge').textContent=r.urg;els('urgencyBadge').className='badge '+(r.urg==='GO NOW'?'now':r.urg==='SOON'?'soon':'');els('nextRide').textContent=r.name;els('heroReason').textContent=r.reasons.slice(0,3).join(' • ');els('heroWait').textContent=r.wait!=null?`${r.wait}m`:'—';els('heroWalk').textContent=`${r.walk}m`;els('directionsBtn').disabled=false;els('completeBtn').disabled=false;els('liveStamp').textContent=state.lastRefresh?`Live data refreshed ${fmtTime(state.lastRefresh)}${r.paidStart?` • LL return ${fmtTime(r.paidStart)}`:''}`:''}
function renderPlan(){const p=state.plan;if(!p?.stops?.length){els('planList').className='planList empty';els('planList').textContent='No plan yet.';return}els('planMeta').textContent=`~${p.walk} min walking • ~${p.queue} min queues`;els('planList').className='planList';els('planList').innerHTML=p.stops.map((s,i)=>`<div class="planStop"><div class="step">${i+1}</div><div><h4>${s.name}</h4><div class="tiny muted">ETA ${fmtTime(s.eta)} • ${s.walk}m walk • ${s.queue}m ${s.useLL?'LL':'queue'}</div><div class="rideMeta">${s.useLL?'<span class="pill ll">USE LL</span>':''}${s.notes.slice(0,2).map(x=>`<span class="pill">${x}</span>`).join('')}</div></div><div style="text-align:right"><strong>${s.wait??'—'}</strong><div class="tiny muted">live wait</div></div></div>`).join('')}
function renderRides(){let rs=[...state.recommendations];const sort=els('rideSort').value;if(sort==='wait')rs.sort((a,b)=>(a.wait??999)-(b.wait??999));if(sort==='name')rs.sort((a,b)=>a.name.localeCompare(b.name));els('rideList').className='list';els('rideList').innerHTML=rs.map(r=>`<div class="rideRow"><div><h4>${r.name}</h4><div class="rideMeta"><span class="pill ${operating(r)?'good':''}">${r.status}</span>${r.paidStart?`<span class="pill ll">LL ${fmtTime(r.paidStart)}</span>`:''}${state.favorites.has(r.id)?'<span class="pill">★ PRIORITY</span>':''}</div><div class="rideActions"><button data-fav="${r.id}">${state.favorites.has(r.id)?'Unfavorite':'Priority'}</button><button data-go="${r.id}">Directions</button><button data-done="${r.id}">Ridden</button></div></div><div class="scoreBox"><strong>${r.wait??'—'}m</strong><span>${r.walk}m walk</span></div></div>`).join('')||'No rides.';
  els('rideList').querySelectorAll('[data-fav]').forEach(b=>b.onclick=()=>{const id=b.dataset.fav;state.favorites.has(id)?state.favorites.delete(id):state.favorites.add(id);persist();renderAll()});els('rideList').querySelectorAll('[data-done]').forEach(b=>b.onclick=()=>{state.completed.add(b.dataset.done);persist();renderAll()});els('rideList').querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>openDirections(state.rides.find(r=>r.id===b.dataset.go)))}
function renderLLs(){const l=state.lls.filter(x=>!state.park||!x.parkName||x.parkName===state.park.name);els('llList').className='list'+(l.length?'':' empty');els('llList').innerHTML=l.length?l.map((x,i)=>`<div class="llRow ${x.used?'used':''}"><div><strong>${x.attractionName}</strong><div class="tiny muted">${x.type} • ${fmtTime(x.start)}–${fmtTime(x.end)}</div></div><div class="right"><button data-use="${x.id}">${x.used?'Undo':'Used'}</button><button data-del="${x.id}">×</button></div></div>`).join(''):'No Lightning Lanes entered.';els('llList').querySelectorAll('[data-use]').forEach(b=>b.onclick=()=>{const x=state.lls.find(v=>v.id===b.dataset.use);x.used=!x.used;persist();renderAll()});els('llList').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{state.lls=state.lls.filter(v=>v.id!==b.dataset.del);persist();renderAll()})}

function setupMap(){state.map=L.map('map',{zoomControl:false}).setView([28.3852,-81.5639],13);L.control.zoom({position:'bottomright'}).addTo(state.map);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(state.map)}
function updateMap(){if(!state.map)return;const r=state.recommendations[0];if(state.userMarker){state.map.removeLayer(state.userMarker);state.userMarker=null}if(state.destMarker){state.map.removeLayer(state.destMarker);state.destMarker=null}if(state.line){state.map.removeLayer(state.line);state.line=null}const pts=[];if(state.position){const p=[state.position.coords.latitude,state.position.coords.longitude];state.userMarker=L.circleMarker(p,{radius:8,weight:3,color:'#fff',fillColor:'#328dff',fillOpacity:1}).addTo(state.map).bindPopup('You');pts.push(p)}if(r){const d=[r.lat,r.lng];state.destMarker=L.marker(d).addTo(state.map).bindPopup(r.name);pts.push(d)}if(pts.length===2){state.line=L.polyline(pts,{weight:4,dashArray:'8 8'}).addTo(state.map);state.map.fitBounds(pts,{padding:[45,45],maxZoom:17})}else if(pts.length===1)state.map.setView(pts[0],16)}
function recenter(){updateMap()}

function startLocation(){if(!navigator.geolocation){toast('Location is not supported by this browser.');return}if(state.watchId!=null)navigator.geolocation.clearWatch(state.watchId);state.watchId=navigator.geolocation.watchPosition(p=>{state.position=p;els('locationText').textContent=`GPS ±${Math.round(p.coords.accuracy)} m`;renderAll();maybeAutoPark()},e=>{els('locationText').textContent='Location unavailable';toast(e.message)},{enableHighAccuracy:true,maximumAge:5000,timeout:15000})}
function maybeAutoPark(){if(state.park||!state.position||!state.parks.length)return; /* park entity centers aren't in destination payload; don't guess */}
function openDirections(r){if(!r)return;const dest=`${r.lat},${r.lng}`,url=`https://maps.apple.com/?daddr=${encodeURIComponent(dest)}&dirflg=w`;window.location.href=url}
function updateLLRideChoices(){const opts=state.rides.sort((a,b)=>a.name.localeCompare(b.name)).map(r=>`<option>${r.name}</option>`).join('');els('llRide').innerHTML=opts}
function dtLocal(d){const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`}
function toast(msg){console.log(msg);els('liveStamp').textContent=msg}

els('parkSelect').addEventListener('change',e=>choosePark(e.target.value));
els('refreshBtn').onclick=refreshLive;els('locateBtn').onclick=startLocation;els('recenterBtn').onclick=recenter;els('ropeDropToggle').checked=state.rope;els('ropeDropToggle').onchange=e=>{state.rope=e.target.checked;persist();renderAll()};els('autoRefreshToggle').onchange=e=>state.auto=e.target.checked;els('rideSort').onchange=renderRides;
els('directionsBtn').onclick=()=>openDirections(state.recommendations[0]);els('completeBtn').onclick=()=>{const r=state.recommendations[0];if(r){state.completed.add(r.id);persist();renderAll()}};
els('addLLBtn').onclick=()=>{if(!state.rides.length)return toast('Choose a park first.');const a=new Date(),b=new Date(a.getTime()+3600000);els('llStart').value=dtLocal(a);els('llEnd').value=dtLocal(b);els('llDialog').showModal()};
els('llForm').addEventListener('submit',e=>{if(e.submitter?.value==='cancel')return;const start=new Date(els('llStart').value),end=new Date(els('llEnd').value);if(!(end>start)){e.preventDefault();return toast('End time must be after start time.')}state.lls.push({id:crypto.randomUUID(),attractionName:els('llRide').value,parkName:state.park?.name||'',start:start.toISOString(),end:end.toISOString(),type:els('llType').value,used:els('llUsed').checked});persist();setTimeout(renderAll,0)});

setInterval(()=>{if(state.auto&&state.park)refreshLive()},60000);
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
setupMap();loadParks();
