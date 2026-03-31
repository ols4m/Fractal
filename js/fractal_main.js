'use strict';
let network=null,nodes=null,edges=null,isDark=true,currentNodeData={},currentEdgeData=[],edgeIdCounter=0,expandedNodes=new Set();
window.addEventListener('DOMContentLoaded',function(){initGraph();initSearch();initButtons();initButtonStack();initIntroCard();initNodeCard();initEdgeCard();initExplorePanel();initLoader();});
function initGraph(){
  const container=document.getElementById('graph');
  nodes=new vis.DataSet([]);
  edges=new vis.DataSet([]);
  const options={
    autoResize:true,
    nodes:{
      shape:'dot',
      scaling:{min:16,max:30,label:{min:12,max:24,drawThreshold:8,maxVisible:20}},
      font:{size:13,face:'ui-sans-serif,system-ui,sans-serif',color:'#e8e8f0'},
      borderWidth:2,borderWidthSelected:3,
    },
    edges:{
      color:{color:'#4a4a6a',highlight:'#7B6CF6',hover:'#7B6CF6'},
      smooth:{type:'continuous'},
      width:1.5,selectionWidth:3,
      label:'',font:{size:0},
    },
    interaction:{hover:true,hoverConnectedEdges:false,selectConnectedEdges:true,tooltipDelay:200},
    physics:{
      enabled:true,
      stabilization:{iterations:200},
      solver:'barnesHut',
      barnesHut:{gravitationalConstant:-6000,centralGravity:0.05,springLength:130,springConstant:0.04,damping:0.06,avoidOverlap:0.3},
    },
  };
  network=new vis.Network(container,{nodes,edges},options);
  setTimeout(function(){const canvas=container.querySelector('canvas');if(canvas)canvas.style.backgroundColor='#0a0a0f';},100);
  network.on('click',function(params){
    if(params.nodes.length>0){
      const nodeId=params.nodes[0];
      const nodeData=currentNodeData[nodeId];
      if(nodeData)showNodeCard(nodeId,nodeData);
    }else if(params.edges.length>0){
      const edge=edges.get(params.edges[0]);
      if(edge)showEdgeCard(edge);
    }
  });
  network.on('doubleClick',function(params){
    if(params.nodes.length>0){
      const nodeId=params.nodes[0];
      if(currentNodeData[nodeId])expandNode(nodeId);
    }
  });
}
function initSearch(){const input=document.getElementById('fractal-input');const field=document.getElementById('fractal-field');input.addEventListener('keydown',function(e){if(e.key==='Enter'&&this.value.trim()!==''){e.preventDefault();createTag(this.value.trim());this.value='';}if(e.key==='Backspace'&&this.value===''){const tags=field.querySelectorAll('.search-tag');if(tags.length>0)tags[tags.length-1].remove();}});}
function createTag(text){const field=document.getElementById('fractal-field');const input=document.getElementById('fractal-input');const tag=document.createElement('div');tag.className='search-tag';tag.dataset.value=text;tag.innerHTML='<span>'+text+'</span><span class="delete-x">✕</span>';tag.addEventListener('click',function(){this.remove();input.focus();});field.insertBefore(tag,input);}
function getTags(){return Array.from(document.querySelectorAll('#fractal-field .search-tag span:first-child')).map(s=>s.textContent.trim());}
function clearTags(){document.querySelectorAll('#fractal-field .search-tag').forEach(t=>t.remove());}
function initButtons(){document.getElementById('btn-map').addEventListener('click',generateMap);document.getElementById('btn-random').addEventListener('click',generateRandom);document.getElementById('btn-clear').addEventListener('click',clearMap);}
function generateMap(){
  const input=document.getElementById('fractal-input');
  const rawInput=input.value.trim();
  if(rawInput!==''){createTag(rawInput);input.value='';}
  const tags=getTags();
  if(tags.length===0)return;
  document.getElementById('intro-card').style.display='none';
  hideNodeCard();hideEdgeCard();
  // Count existing central nodes to offset new ones horizontally
  const existingCentral=Object.values(currentNodeData).filter(function(n){return n.level===0;}).length;
  let added=0;
  tags.forEach(function(tag){
    if(currentNodeData[tag])return; // already planted
    const x=(existingCentral+added)*700;
    added++;
    currentNodeData[tag]={name:tag,summary:'Central query node',color:'#2c2c3e',level:0};
    nodes.update([{
      id:tag,label:wrapLabel(tag),value:5,level:0,size:44,
      color:{background:'#2c2c3e',border:'#7B6CF6',highlight:{background:'#7B6CF6',border:'#5a4cd6'},hover:{background:'#3a3a50',border:'#7B6CF6'}},
      font:{size:17,bold:true},x:x,y:0,
    }]);
  });
  if(added>0){
    document.getElementById('btn-clear').style.display='';
    network.fit({animation:{duration:600,easingFunction:'easeInOutQuad'}});
  }
}
async function generateRandom(){const query=await getRandomArticle();createTag(query);}
function clearMap(){nodes.clear();edges.clear();clearTags();currentNodeData={};currentEdgeData=[];edgeIdCounter=0;expandedNodes=new Set();hideNodeCard();hideEdgeCard();closeExplorePanel();hideDemoBanner();document.getElementById('btn-clear').style.display='none';}
async function expandNode(nodeId){
  if(expandedNodes.has(nodeId))return;
  expandedNodes.add(nodeId);
  // Mark as expanded with a purple border
  nodes.update({id:nodeId,borderWidth:4,borderWidthSelected:4,color:{border:'#7B6CF6',highlight:{border:'#5a4cd6'},hover:{border:'#7B6CF6'}}});
  showLoader();
  try{
    const resp=await fetch('/generate-map',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:nodeId})});
    if(!resp.ok)throw new Error('API '+resp.status);
    const data=await resp.json();
    if(!data||!Array.isArray(data.nodes))throw new Error('Bad response');
    const isDemo=data.nodes.some(function(n){return n.name&&n.name.includes('(DEMO)');});
    if(isDemo)showDemoBanner(); else hideDemoBanner();
    addCluster(nodeId,data);
  }catch(e){
    console.error('expandNode failed:',e);
    expandedNodes.delete(nodeId);
  }finally{
    hideLoader();
  }
}
function addCluster(parentId,data){
  // Build numeric-id → name map from the API response
  const idToName={};
  data.nodes.forEach(function(n){if(n.id!=null)idToName[String(n.id)]=n.name;});

  // Get parent position so children spawn nearby, not at canvas origin
  let px=0,py=0;
  try{const pos=network.getPositions([parentId])[parentId];if(pos){px=pos.x;py=pos.y;}}catch(e){}

  const parentLevel=(currentNodeData[parentId]&&currentNodeData[parentId].level!=null)?currentNodeData[parentId].level:0;
  const newVisNodes=[];
  const radius=130;
  data.nodes.forEach(function(node,i){
    if(currentNodeData[node.name])return; // already on graph — don't overwrite
    const isEmergent=node.color==='#888888'||node.color==='grey';
    const angle=(2*Math.PI*i)/data.nodes.length;
    currentNodeData[node.name]=Object.assign({},node,{level:parentLevel+1});
    newVisNodes.push({
      id:node.name,label:wrapLabel(node.name),value:isEmergent?2:3,size:isEmergent?20:26,level:parentLevel+1,
      color:{
        background:isEmergent?washColor('#555566',parentLevel):washColor(node.color||'#4A90D9',parentLevel),
        border:isEmergent?'#333344':washColor('#2a6aad',parentLevel),
        highlight:{background:'#7B6CF6',border:'#5a4cd6'},
        hover:{background:isEmergent?washColor('#666677',parentLevel):washColor('#5aa0e9',parentLevel),border:'#2a6aad'},
      },
      x:Math.round(px+radius*Math.cos(angle)),
      y:Math.round(py+radius*Math.sin(angle)),
    });
  });
  nodes.update(newVisNodes);

  // Lengthen the edge connecting parentId to its own parent so the cluster has room
  const parentEdge=currentEdgeData.find(function(e){return e.target===parentId;});
  if(parentEdge){
    const newLength=Math.max(220,150+(data.nodes.length*18));
    edges.update({id:parentEdge.id,length:newLength});
  }

  // Wire parent → each new child only (star/spoke pattern)
  newVisNodes.forEach(function(vn){
    addEdgeIfMissing(parentId,vn.id,'');
  });

  network.fit({animation:{duration:800,easingFunction:'easeInOutQuad'}});
}
function addEdgeIfMissing(from,to,rel,length){
  const exists=currentEdgeData.some(function(e){return(e.source===from&&e.target===to)||(e.source===to&&e.target===from);});
  if(exists)return;
  const id='e'+(edgeIdCounter++);
  currentEdgeData.push({id:id,source:from,target:to,relationship:rel});
  const edgeDef={id:id,from:from,to:to,color:{color:'#4a4a6a',highlight:'#7B6CF6',hover:'#7B6CF6'}};
  if(length)edgeDef.length=length;
  edges.add(edgeDef);
}
function getAncestorPath(nodeId){
  const path=[nodeId];
  let current=nodeId;
  while(true){
    const parentEdge=currentEdgeData.find(function(e){return e.target===current;});
    if(!parentEdge)break;
    path.unshift(parentEdge.source);
    current=parentEdge.source;
  }
  return path;
}
function highlightPath(nodeId){
  const dimmed=currentEdgeData.map(function(e){return{id:e.id,color:{color:'#333355'},width:1};});
  edges.update(dimmed);
  const path=getAncestorPath(nodeId);
  for(let i=0;i<path.length-1;i++){
    const from=path[i],to=path[i+1];
    const e=currentEdgeData.find(function(e){return(e.source===from&&e.target===to)||(e.source===to&&e.target===from);});
    if(e)edges.update({id:e.id,color:{color:'#7B6CF6'},width:3});
  }
}
function resetHighlight(){
  edges.update(currentEdgeData.map(function(e){return{id:e.id,color:{color:'#4a4a6a'},width:1.5};}));
}
function washColor(hex,level){
  if(!hex||hex[0]!=='#')return hex;
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  const grey=155,t=Math.min(Math.max(0,level-48)*0.12,0.75);
  const nr=Math.round(r+(grey-r)*t),ng=Math.round(g+(grey-g)*t),nb=Math.round(b+(grey-b)*t);
  return '#'+[nr,ng,nb].map(function(v){return v.toString(16).padStart(2,'0');}).join('');
}
function wrapLabel(text){if(text.length<=18)return text;const words=text.split(' ');let lines=[],line='';words.forEach(function(w){if((line+' '+w).trim().length>18){lines.push(line.trim());line=w;}else{line=(line+' '+w).trim();}});if(line)lines.push(line.trim());return lines.join('\n');}
function initNodeCard(){document.getElementById('btn-node-close').addEventListener('click',hideNodeCard);document.getElementById('btn-node-explore').addEventListener('click',function(){const title=document.getElementById('node-card-title').textContent;openExplorePanel(title);});makeDraggable('node-card','node-card-head');}
function showNodeCard(nodeId,nodeData){
  const card=document.getElementById('node-card');
  const isEmergent =
    nodeData.color === 'grey' ||
    nodeData.type === 'emergent' ||
    nodeData.color === '#888888' ||
    (nodeId && nodeId.toLowerCase().includes('emergent'));
  document.getElementById('node-card-title').textContent=nodeId;
  document.getElementById('node-card-summary').textContent=nodeData.summary||'';
  document.getElementById('node-card-type').textContent=isEmergent?'Emergent':'Domain';
  const head=card.querySelector('.node-card-head');
  head.classList.toggle('emergent',isEmergent);
  card.style.display='block';
  highlightPath(nodeId);
}
function hideNodeCard(){document.getElementById('node-card').style.display='none';resetHighlight();}
function initEdgeCard(){document.getElementById('btn-edge-close').addEventListener('click',hideEdgeCard);document.getElementById('btn-edge-close-2').addEventListener('click',hideEdgeCard);document.getElementById('btn-explore-both').addEventListener('click',exploreBoth);document.getElementById('edge-dropdown-btn').addEventListener('click',function(){this.classList.toggle('open');document.getElementById('edge-dropdown-content').classList.toggle('open');});makeDraggable('edge-card','edge-drag-handle',updateTether);}
function showEdgeCard(edge){document.getElementById('edge-node-a').textContent=edge.from;document.getElementById('edge-node-b').textContent=edge.to;const rel=(edge.title||edge.label||'related').toLowerCase();const badge=document.getElementById('edge-badge');badge.textContent=rel.charAt(0).toUpperCase()+rel.slice(1);badge.className='edge-badge '+rel;document.getElementById('edge-summary').textContent='These two nodes are connected through: '+rel+'.';document.getElementById('edge-card').style.display='block';updateTether();}
function hideEdgeCard(){document.getElementById('edge-card').style.display='none';clearTether();}
function exploreBoth(){const nodeA=document.getElementById('edge-node-a').textContent;const nodeB=document.getElementById('edge-node-b').textContent;if(currentNodeData[nodeA])showNodeCard(nodeA,currentNodeData[nodeA]);openExplorePanel(nodeB);}
function updateTether(){const edgeCard=document.getElementById('edge-card');if(!edgeCard||edgeCard.style.display==='none')return;const nodeA=document.getElementById('edge-node-a').textContent;const nodeB=document.getElementById('edge-node-b').textContent;try{const posA=network.getPosition(nodeA);const posB=network.getPosition(nodeB);const domA=network.canvasToDOM(posA);const domB=network.canvasToDOM(posB);const mx=(domA.x+domB.x)/2;const my=(domA.y+domB.y)/2;const r=document.getElementById('edge-card-inner').getBoundingClientRect();const cx=r.left+r.width/2;const cy=r.top+r.height/2;const nodeEdge=document.getElementById('node-edge-line');nodeEdge.setAttribute('x1',domA.x);nodeEdge.setAttribute('y1',domA.y);nodeEdge.setAttribute('x2',domB.x);nodeEdge.setAttribute('y2',domB.y);const midDot=document.getElementById('mid-dot');midDot.setAttribute('cx',mx);midDot.setAttribute('cy',my);const tether=document.getElementById('tether-line');tether.setAttribute('x1',cx);tether.setAttribute('y1',cy);tether.setAttribute('x2',mx);tether.setAttribute('y2',my);}catch(e){}}
function clearTether(){['node-edge-line','tether-line'].forEach(function(id){const el=document.getElementById(id);if(el){el.setAttribute('x1',0);el.setAttribute('y1',0);el.setAttribute('x2',0);el.setAttribute('y2',0);}});const dot=document.getElementById('mid-dot');if(dot)dot.setAttribute('r',0);}
function initExplorePanel(){document.getElementById('btn-panel-close').addEventListener('click',closeExplorePanel);}
function openExplorePanel(nodeId){
  const nodeData=currentNodeData[nodeId]||{};
  const isEmergent =
    nodeData.color === 'grey' ||
    nodeData.type === 'emergent' ||
    nodeData.color === '#888888' ||
    (nodeId && nodeId.toLowerCase().includes('emergent'));

  document.getElementById('panel-title').textContent=nodeId;
  document.getElementById('panel-type').textContent=isEmergent?'Emergent Node':'Domain Node';
  document.getElementById('panel-summary').textContent=nodeData.summary||'';
  document.getElementById('panel-facts').textContent='Key facts will be generated here.';
  document.getElementById('panel-reading').textContent='Further reading will be generated here.';

  const connectedDiv=document.getElementById('panel-connected');
  connectedDiv.innerHTML='';
  function makeChip(id,accent){
    const chip=document.createElement('span');
    chip.className='node-chip';
    chip.textContent=id;
    chip.style.cssText='display:inline-block;background:#0a0a0f;border:2px solid '+accent+';color:'+accent+';font-size:9px;font-weight:700;text-transform:uppercase;padding:3px 8px;margin:2px;box-shadow:2px 2px 0 #000;cursor:pointer;';
    chip.addEventListener('click',function(){showNodeCard(id,currentNodeData[id]||{});});
    return chip;
  }
  // Ancestry path — root → … → parent of this node
  const path=getAncestorPath(nodeId);
  path.slice(0,-1).forEach(function(id){connectedDiv.appendChild(makeChip(id,'#7B6CF6'));});
  // Direct children this node expanded to
  currentEdgeData.forEach(function(edge){
    if(edge.source===nodeId)connectedDiv.appendChild(makeChip(edge.target,'#4A90D9'));
  });

  const panel=document.getElementById('explore-panel');
  panel.style.display='flex';
  requestAnimationFrame(function(){panel.classList.add('open');});
}
function closeExplorePanel(){const panel=document.getElementById('explore-panel');panel.classList.remove('open');setTimeout(function(){panel.style.display='none';},400);}
function initButtonStack(){document.getElementById('btn-theme').addEventListener('click',toggleTheme);document.getElementById('btn-github').addEventListener('click',function(){window.open('https://github.com/ols4m/Fractal','_blank');});document.getElementById('btn-about').addEventListener('click',function(){window.open('https://github.com/ols4m/Fractal#readme','_blank');});}
function toggleTheme(){isDark=!isDark;document.body.classList.toggle('light',!isDark);const canvas=document.querySelector('#graph canvas');if(canvas)canvas.style.backgroundColor=isDark?'#0a0a0f':'#f8f8fc';if(network){network.setOptions({nodes:{font:{color:isDark?'#e8e8f0':'#1a1a2e'}}});network.redraw();}const themeBtn=document.getElementById('btn-theme');themeBtn.classList.toggle('light',!isDark);const icon=document.getElementById('theme-icon');if(isDark){icon.innerHTML='<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';}else{icon.innerHTML='<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>';}}
function initIntroCard(){document.getElementById('btn-get-started').addEventListener('click',function(){document.getElementById('intro-card').style.display='none';document.getElementById('fractal-input').focus();});}
function showDemoBanner(){document.getElementById('demo-banner').style.display='inline-flex';}
function hideDemoBanner(){document.getElementById('demo-banner').style.display='none';}
function initLoader(){const loader=document.getElementById('loader');if(!loader){const div=document.createElement('div');div.id='loader';div.innerHTML='<div class="three-body"><div class="three-body__dot"></div><div class="three-body__dot"></div><div class="three-body__dot"></div></div><span class="loader-label">Generating map...</span>';document.body.appendChild(div);}}
function showLoader(){const loader=document.getElementById('loader');if(loader)loader.classList.add('visible');}
function hideLoader(){const loader=document.getElementById('loader');if(loader)loader.classList.remove('visible');}
function makeDraggable(cardId,handleId,onDrag){const card=document.getElementById(cardId);const handle=document.getElementById(handleId);if(!card||!handle)return;let dragging=false,startX,startY,startL,startT;handle.addEventListener('mousedown',function(e){dragging=true;card.style.zIndex=200;startX=e.clientX;startY=e.clientY;startL=card.offsetLeft;startT=card.offsetTop;e.preventDefault();});document.addEventListener('mousemove',function(e){if(!dragging)return;card.style.left=(startL+e.clientX-startX)+'px';card.style.top=(startT+e.clientY-startY)+'px';card.style.transform='none';if(onDrag)onDrag();});document.addEventListener('mouseup',function(){dragging=false;card.style.zIndex=50;});handle.addEventListener('touchstart',function(e){dragging=true;startX=e.touches[0].clientX;startY=e.touches[0].clientY;startL=card.offsetLeft;startT=card.offsetTop;},{passive:true});document.addEventListener('touchmove',function(e){if(!dragging)return;card.style.left=(startL+e.touches[0].clientX-startX)+'px';card.style.top=(startT+e.touches[0].clientY-startY)+'px';card.style.transform='none';if(onDrag)onDrag();},{passive:true});document.addEventListener('touchend',function(){dragging=false;});}
window.addEventListener('resize',updateTether);
