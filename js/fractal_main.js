'use strict';
let network=null,nodes=null,edges=null,isDark=true,isMultiColor=true,currentNodeData={},currentEdgeData=[],edgeIdCounter=0,expandedNodes=new Set(),monochromeMode=false,labelsVisible=true,nodeCardLeft=true,wikiMode=false,wikiTight=false;
const FRACTAL_BLUE='#4A90D9';
window.addEventListener('DOMContentLoaded',function(){initGraph();initSearch();initButtons();initButtonStack();initIntroCard();initNodeCard();initEdgeCard();initExplorePanel();initSettingsPanel();initLoader();});
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
      color:{color:'#7070b0',highlight:'#7B6CF6',hover:'#7B6CF6'},
      smooth:{type:'continuous'},
      width:2,selectionWidth:4,
      label:'',font:{size:0},
    },
    interaction:{hover:true,hoverConnectedEdges:false,selectConnectedEdges:true,tooltipDelay:200},
    physics:{
      enabled:true,
      stabilization:{iterations:200},
      solver:'barnesHut',
      barnesHut:{gravitationalConstant:-8000,centralGravity:0,springLength:130,springConstant:0.04,damping:0.06,avoidOverlap:0.3},
    },
  };
  network=new vis.Network(container,{nodes,edges},options);
  setTimeout(function(){const canvas=container.querySelector('canvas');if(canvas)canvas.style.backgroundColor='transparent';},100);
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
  // Build list of root node IDs already on the map
  const rootIds=Object.keys(currentNodeData).filter(function(id){return currentNodeData[id]&&currentNodeData[id].level===0;});
  let added=0;
  tags.forEach(function(tag){
    if(currentNodeData[tag])return;
    // Spawn at a random position — hidden spring edges between roots handle gravitation
    const x=Math.round((Math.random()-0.5)*700);
    const y=Math.round((Math.random()-0.5)*700);
    added++;
    currentNodeData[tag]={name:tag,summary:'',color:'#2c2c3e',level:0};
    nodes.update([{
      id:tag,label:wrapLabel(tag),value:5,level:0,size:44,
      color:{background:'#2c2c3e',border:'#7B6CF6',highlight:{background:'#7B6CF6',border:'#5a4cd6'},hover:{background:'#3a3a50',border:'#7B6CF6'}},
      font:{size:17,bold:true},x:x,y:y,
    }]);
    // Hidden spring edges to all existing roots so physics keeps clusters gravitating together
    rootIds.forEach(function(existId){addRootLink(tag,existId);});
    rootIds.push(tag);
    // Fetch description in background — update node card if it's open
    (function(t){
      fetch('/describe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:t})})
        .then(function(r){return r.ok?r.json():null;})
        .then(function(d){
          if(d&&d.summary&&currentNodeData[t]){
            currentNodeData[t].summary=d.summary;
            const title=document.getElementById('node-card-title');
            if(title&&title.textContent===t)document.getElementById('node-card-summary').textContent=d.summary;
          }
        })
        .catch(function(){});
    })(tag);
  });
  if(added>0){
    document.getElementById('btn-clear').style.display='';
    network.fit({animation:{duration:600,easingFunction:'easeInOutQuad'}});
  }
}
function addRootLink(a,b){
  const exists=currentEdgeData.some(function(e){return(e.source===a&&e.target===b)||(e.source===b&&e.target===a);});
  if(exists)return;
  const id='r'+(edgeIdCounter++);
  currentEdgeData.push({id:id,source:a,target:b,relationship:'root-link'});
  edges.add({id:id,from:a,to:b,hidden:true,length:520,physics:true});
}
async function generateRandom(){const query=await getRandomArticle();createTag(query);generateMap();}
function clearMap(){
  nodes.clear();
  edges.clear();
  clearTags();
  currentNodeData={};
  currentEdgeData=[];
  edgeIdCounter=0;
  expandedNodes=new Set();
  monochromeMode=false;
  setColorState(true);
  hideNodeCard();
  hideEdgeCard();
  closeExplorePanel();
  hideDemoBanner();
  document.getElementById('btn-clear').style.display='none';
}
async function expandNode(nodeId){
  if(expandedNodes.has(nodeId))return;
  expandedNodes.add(nodeId);
  // Mark as expanded with a purple border
  nodes.update({id:nodeId,borderWidth:4,borderWidthSelected:4,color:{border:'#7B6CF6',highlight:{border:'#5a4cd6'},hover:{border:'#7B6CF6'}}});
  showLoader();
  try{
    const resp=await fetch('/generate-map',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:nodeId,existing_nodes:Object.keys(currentNodeData)})});
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
  // Calculate outward direction: angle from grandparent → parent so children spawn away from the rest of the graph
  let outwardAngle=0;
  const gpEdge=currentEdgeData.find(function(e){return e.target===parentId;});
  if(gpEdge){
    try{
      const gpPos=network.getPositions([gpEdge.source])[gpEdge.source];
      if(gpPos)outwardAngle=Math.atan2(py-gpPos.y,px-gpPos.x);
    }catch(e){}
  }
  const arcSpread=Math.PI*1.3; // 234° arc — wide but not full circle, biased outward
  data.nodes.forEach(function(node,i){
    if(currentNodeData[node.name])return; // already on graph — don't overwrite
    const isEmergent=node.color==='#888888'||node.color==='grey';
    const angle=outwardAngle+((i/(Math.max(data.nodes.length-1,1)))-0.5)*arcSpread;
    currentNodeData[node.name]=Object.assign({},node,{level:parentLevel+1});
    const wrappedLabel=wrapLabel(node.name);
    const labelLines=wrappedLabel.split('\n').length;
    // In wiki mode: use value-based scaling (no fixed size) so longer labels get bigger nodes.
    // value = line count + 1 ensures multi-line labels get proportionally larger circles.
    const nodeValue=wikiMode?Math.max(2,labelLines+1):(isEmergent?2:3);
    const nodeObj={
      id:node.name,label:wrappedLabel,value:nodeValue,level:parentLevel+1,
      color:{
        background:isEmergent?washColor('#555566',parentLevel):(monochromeMode?FRACTAL_BLUE:washColor(node.color||'#4A90D9',parentLevel)),
        border:isEmergent?'#333344':washColor('#2a6aad',parentLevel),
        highlight:{background:'#7B6CF6',border:'#5a4cd6'},
        hover:{background:isEmergent?washColor('#666677',parentLevel):(monochromeMode?'#5aa0e9':washColor('#5aa0e9',parentLevel)),border:'#2a6aad'},
      },
      x:wikiMode?px:Math.round(px+radius*Math.cos(angle)),
      y:wikiMode?py:Math.round(py+radius*Math.sin(angle)),
    };
    // In wiki mode let scaling.min/max drive size; outside wiki mode keep fixed sizes
    if(!wikiMode)nodeObj.size=isEmergent?20:26;
    // Scale font down slightly for longer labels so text fits better
    if(wikiMode)nodeObj.font={size:Math.max(10,14-(labelLines-1))};
    newVisNodes.push(nodeObj);
  });
  nodes.update(newVisNodes);

  // Lengthen the edge connecting parentId to its own parent so the cluster has room
  // In wiki mode: skip — let physics drive spacing purely like Wikipedia Map does
  if(!wikiMode){
    const parentEdge=currentEdgeData.find(function(e){return e.target===parentId;});
    if(parentEdge){
      const newLength=Math.max(220,150+(data.nodes.length*18));
      edges.update({id:parentEdge.id,length:newLength});
    }
  }

  // Wire parent → each new child only (star/spoke pattern)
  newVisNodes.forEach(function(vn){
    addEdgeIfMissing(parentId,vn.id,'');
  });

  // Cross-connections: bias spawn position toward related existing nodes so physics pulls clusters together
  if(Array.isArray(data.cross_connections)){
    data.cross_connections.forEach(function(cc){
      const vn=newVisNodes.find(function(n){return n.id===cc.new_node;});
      if(!vn||!cc.existing_node||!currentNodeData[cc.existing_node])return;
      try{
        const ePos=network.getPositions([cc.existing_node])[cc.existing_node];
        if(ePos){vn.x=Math.round(vn.x*0.55+ePos.x*0.45);vn.y=Math.round(vn.y*0.55+ePos.y*0.45);}
      }catch(e){}
    });
  }

  network.fit({animation:{duration:800,easingFunction:'easeInOutQuad'}});
}
function addEdgeIfMissing(from,to,rel,length){
  const exists=currentEdgeData.some(function(e){return(e.source===from&&e.target===to)||(e.source===to&&e.target===from);});
  if(exists)return;
  const id='e'+(edgeIdCounter++);
  currentEdgeData.push({id:id,source:from,target:to,relationship:rel});
  const edgeDef={id:id,from:from,to:to,color:{color:'#7070b0',highlight:'#7B6CF6',hover:'#7B6CF6'},width:2};
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
  edges.update(currentEdgeData.map(function(e){return{id:e.id,color:{color:'#333355'},width:1};}));
  const path=getAncestorPath(nodeId);
  for(let i=0;i<path.length-1;i++){
    const from=path[i],to=path[i+1];
    const e=currentEdgeData.find(function(e){return(e.source===from&&e.target===to)||(e.source===to&&e.target===from);});
    if(e)edges.update({id:e.id,color:{color:'#7B6CF6'},width:3});
  }
}
function resetHighlight(){
  edges.update(currentEdgeData.map(function(e){return{id:e.id,color:{color:'#7070b0'},width:2};}));
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
  const isCentral=nodeData.level===0;
  const isEmergent=!isCentral&&(nodeData.color==='grey'||nodeData.type==='emergent'||nodeData.color==='#888888'||(nodeId&&nodeId.toLowerCase().includes('emergent')));
  document.getElementById('node-card-title').textContent=nodeId;
  document.getElementById('node-card-summary').textContent=nodeData.summary||'';
  document.getElementById('node-card-type').textContent=isCentral?'Central':isEmergent?'Emergent':'Domain';
  const head=card.querySelector('.node-card-head');
  head.classList.toggle('emergent',isEmergent);
  head.classList.toggle('central',isCentral);
  card.style.display='block';
  highlightPath(nodeId);
  adjustSettingsHeight();
}
function hideNodeCard(){document.getElementById('node-card').style.display='none';resetHighlight();adjustSettingsHeight();}
function setNodeCardPosition(left){
  nodeCardLeft=left;
  const card=document.getElementById('node-card');
  if(card){card.classList.toggle('card-left',left);card.style.left='';card.style.top='';card.style.transform='';}
  const tog=document.getElementById('tog-card-left');
  if(tog){tog.setAttribute('data-on',String(left));tog.querySelector('.toggle-label').textContent=left?'ON':'OFF';}
  adjustSettingsHeight();
}
function adjustSettingsHeight(){
  const panel=document.getElementById('settings-panel');
  const card=document.getElementById('node-card');
  if(!panel)return;
  if(nodeCardLeft&&panel.classList.contains('open')&&card&&card.style.display!=='none'){
    const cardTop=card.getBoundingClientRect().top;
    panel.style.bottom=(window.innerHeight-cardTop+10)+'px';
  }else{
    panel.style.bottom='';
  }
}
function setCurvedToggle(on){
  const el=document.getElementById('tog-curved');
  if(el){el.setAttribute('data-on',String(on));el.querySelector('.toggle-label').textContent=on?'ON':'OFF';}
}
function applyWikiLoose(){
  if(!network)return;
  network.setOptions({
    physics:{
      enabled:true,solver:'repulsion',adaptiveTimestep:true,maxVelocity:200,
      repulsion:{centralGravity:0.2,springLength:200,springConstant:0.08,nodeDistance:180,damping:0.12},
    },
    nodes:{scaling:{min:22,max:46,label:{min:12,max:24,drawThreshold:8,maxVisible:20}},font:{size:11}},
    edges:{width:1.5,selectionWidth:3,hoverWidth:0,smooth:{type:'dynamic'}},
  });
  setCurvedToggle(false);
  document.getElementById('sl-spring').value=200;document.getElementById('val-spring').textContent='200';
  document.getElementById('sl-damping').value=0.12;document.getElementById('val-damping').textContent='0.12';
  document.getElementById('sl-node-s').value=46;document.getElementById('val-node-s').textContent='46';
  document.getElementById('sl-edge-w').value=1.5;document.getElementById('val-edge-w').textContent='1.5';
  network.startSimulation();
}
function applyWikiTight(){
  if(!network)return;
  // Wikipedia Map exact: vis.js barnesHut defaults + fast springConstant + high maxVelocity for snappy burst
  network.setOptions({
    physics:{
      enabled:true,solver:'barnesHut',adaptiveTimestep:true,maxVelocity:200,
      stabilization:{enabled:true,iterations:1000,fit:true},
      barnesHut:{gravitationalConstant:-2000,centralGravity:0.3,springLength:95,springConstant:0.08,damping:0.12,avoidOverlap:0},
    },
    nodes:{scaling:{min:20,max:30,label:{min:14,max:30,drawThreshold:9,maxVisible:20}},font:{size:11}},
    edges:{width:1,selectionWidth:2,hoverWidth:0,smooth:{type:'dynamic'}},
  });
  setCurvedToggle(false);
  document.getElementById('sl-spring').value=95;document.getElementById('val-spring').textContent='95';
  document.getElementById('sl-gravity').value=-2000;document.getElementById('val-gravity').textContent='-2.0k';
  document.getElementById('sl-damping').value=0.12;document.getElementById('val-damping').textContent='0.12';
  document.getElementById('sl-node-s').value=30;document.getElementById('val-node-s').textContent='30';
  document.getElementById('sl-edge-w').value=1;document.getElementById('val-edge-w').textContent='1';
  network.stabilize(1000);
}
function setWikiTight(on){
  wikiTight=on;
  const tog=document.getElementById('tog-wiki-tight');
  if(tog){tog.setAttribute('data-on',String(on));tog.querySelector('.toggle-label').textContent=on?'ON':'OFF';}
  if(wikiMode){on?applyWikiTight():applyWikiLoose();}
}
function setWikiMode(on){
  wikiMode=on;
  const tog=document.getElementById('tog-wiki');
  if(tog){tog.setAttribute('data-on',String(on));tog.querySelector('.toggle-label').textContent=on?'ON':'OFF';}
  const subRow=document.getElementById('row-wiki-tight');
  if(subRow)subRow.style.display=on?'':'none';
  if(!network)return;
  if(on){
    wikiTight?applyWikiTight():applyWikiLoose();
  }else{
    network.setOptions({
      physics:{enabled:true,solver:'barnesHut',barnesHut:{gravitationalConstant:-8000,centralGravity:0,springLength:130,springConstant:0.04,damping:0.06,avoidOverlap:0.3}},
      nodes:{scaling:{min:16,max:30}},
      edges:{width:2,selectionWidth:4,smooth:{type:'continuous'}},
    });
    setCurvedToggle(true);
    document.getElementById('sl-spring').value=130;document.getElementById('val-spring').textContent='130';
    document.getElementById('sl-gravity').value=-8000;document.getElementById('val-gravity').textContent='-8.0k';
    document.getElementById('sl-damping').value=0.06;document.getElementById('val-damping').textContent='0.06';
    document.getElementById('sl-node-s').value=30;document.getElementById('val-node-s').textContent='30';
    document.getElementById('sl-edge-w').value=2;document.getElementById('val-edge-w').textContent='2';
  }
}
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
function initButtonStack(){document.getElementById('btn-github').addEventListener('click',function(){window.open('https://github.com/ols4m/Fractal','_blank');});document.getElementById('btn-about').addEventListener('click',function(){window.open('https://github.com/ols4m/Fractal#readme','_blank');});}
function toggleMonochrome(force){
  if(force!==undefined){monochromeMode=force;}else{monochromeMode=!monochromeMode;}
  const updates=[];
  Object.entries(currentNodeData).forEach(function([id,data]){
    if(data.level===0)return; // leave central nodes untouched
    const isEmergent=data.color==='#888888'||data.color==='grey';
    const level=data.level||1;
    if(monochromeMode){
      updates.push({id:id,color:{
        background:isEmergent?'#555566':FRACTAL_BLUE,
        border:isEmergent?'#333344':'#2a6aad',
        highlight:{background:'#7B6CF6',border:'#5a4cd6'},
        hover:{background:isEmergent?'#666677':'#5aa0e9',border:'#2a6aad'},
      }});
    }else{
      const orig=data.color||FRACTAL_BLUE;
      updates.push({id:id,color:{
        background:isEmergent?washColor('#555566',level):washColor(orig,level),
        border:isEmergent?'#333344':washColor('#2a6aad',level),
        highlight:{background:'#7B6CF6',border:'#5a4cd6'},
        hover:{background:isEmergent?washColor('#666677',level):washColor('#5aa0e9',level),border:'#2a6aad'},
      }});
    }
  });
  nodes.update(updates);
}
function setThemeState(dark){
  isDark = dark;
  document.body.classList.toggle('light', !isDark);
  const themeDesc = document.getElementById('themeDesc');
  if(themeDesc) themeDesc.textContent = isDark ? 'Dark mode' : 'Light mode';
  const themeToggle = document.getElementById('themeToggle');
  if(themeToggle) themeToggle.checked = !isDark;
  const themePanelTog = document.getElementById('tog-theme');
  if(themePanelTog){
    themePanelTog.setAttribute('data-on', String(isDark));
    themePanelTog.querySelector('.toggle-label').textContent = isDark ? 'ON' : 'OFF';
  }
  if(network){
    network.setOptions({nodes:{font:{color:isDark?'#e8e8f0':'#1a1a2e'}}});
    network.redraw();
  }
}

function setColorState(multi){
  isMultiColor = multi;
  document.body.classList.toggle('mono', !isMultiColor);
  const colorDesc = document.getElementById('colorDesc');
  if(colorDesc) colorDesc.textContent = isMultiColor ? 'Multi-color' : 'Monochrome';
  const colorLabel = document.getElementById('colorLabel');
  if(colorLabel) colorLabel.textContent = isMultiColor ? 'Multicolor' : 'Monochrome';
  const colorToggle = document.getElementById('colorToggle');
  if(colorToggle) colorToggle.checked = !isMultiColor;
  const monoTog = document.getElementById('tog-monochrome');
  if(monoTog){
    const monoOn = !isMultiColor;
    monoTog.setAttribute('data-on', String(monoOn));
    monoTog.querySelector('.toggle-label').textContent = monoOn ? 'ON' : 'OFF';
  }
  toggleMonochrome(!isMultiColor);
}

function toggleSettings(){
  const panel = document.getElementById('settingsPanel');
  const btn = document.getElementById('settingsBtn');
  if(panel) panel.classList.toggle('open');
  if(btn) btn.classList.toggle('open');
}

function toggleTheme(){
  const checkbox = document.getElementById('themeToggle');
  setThemeState(checkbox ? !checkbox.checked : !isDark);
}

function toggleColor(){
  const checkbox = document.getElementById('colorToggle');
  setColorState(checkbox ? !checkbox.checked : isMultiColor);
}

function initMiniSettings(){
  const btn = document.getElementById('settingsBtn');
  if(btn) btn.addEventListener('click',toggleSettings);
  setThemeState(isDark);
  setColorState(isMultiColor);
  document.addEventListener('click',function(e){
    const wrap = document.querySelector('.settings-wrap');
    if(!wrap || wrap.contains(e.target)) return;
    const panel = document.getElementById('settingsPanel');
    if(panel) panel.classList.remove('open');
    if(btn) btn.classList.remove('open');
  });
}

function initIntroCard(){document.getElementById('btn-get-started').addEventListener('click',function(){document.getElementById('intro-card').style.display='none';document.getElementById('fractal-input').focus();});}
function showDemoBanner(){document.getElementById('demo-banner').style.display='inline-flex';}
function hideDemoBanner(){document.getElementById('demo-banner').style.display='none';}
function initLoader(){const loader=document.getElementById('loader');if(!loader){const div=document.createElement('div');div.id='loader';div.innerHTML='<div class="three-body"><div class="three-body__dot"></div><div class="three-body__dot"></div><div class="three-body__dot"></div></div><span class="loader-label">Generating map...</span>';document.body.appendChild(div);}}
function showLoader(){const loader=document.getElementById('loader');if(loader)loader.classList.add('visible');}
function hideLoader(){const loader=document.getElementById('loader');if(loader)loader.classList.remove('visible');}
function makeDraggable(cardId,handleId,onDrag){const card=document.getElementById(cardId);const handle=document.getElementById(handleId);if(!card||!handle)return;let dragging=false,startX,startY,startL,startT;handle.addEventListener('mousedown',function(e){dragging=true;card.style.zIndex=200;startX=e.clientX;startY=e.clientY;startL=card.offsetLeft;startT=card.offsetTop;e.preventDefault();});document.addEventListener('mousemove',function(e){if(!dragging)return;card.style.left=(startL+e.clientX-startX)+'px';card.style.top=(startT+e.clientY-startY)+'px';card.style.transform='none';if(onDrag)onDrag();});document.addEventListener('mouseup',function(){dragging=false;card.style.zIndex=50;});handle.addEventListener('touchstart',function(e){dragging=true;startX=e.touches[0].clientX;startY=e.touches[0].clientY;startL=card.offsetLeft;startT=card.offsetTop;},{passive:true});document.addEventListener('touchmove',function(e){if(!dragging)return;card.style.left=(startL+e.touches[0].clientX-startX)+'px';card.style.top=(startT+e.touches[0].clientY-startY)+'px';card.style.transform='none';if(onDrag)onDrag();},{passive:true});document.addEventListener('touchend',function(){dragging=false;});}
window.addEventListener('resize',updateTether);
function setupToggle(id,callback){
  const el=document.getElementById(id);
  if(!el)return;
  el.addEventListener('click',function(){
    const next=el.getAttribute('data-on')!=='true';
    el.setAttribute('data-on',String(next));
    el.querySelector('.toggle-label').textContent=next?'ON':'OFF';
    callback(next);
  });
}
function toggleSettingsPanel(){
  const open=document.getElementById('settings-panel').classList.toggle('open');
  document.getElementById('btn-settings').classList.toggle('active',open);
  adjustSettingsHeight();
}
function closeSettingsPanel(){
  document.getElementById('settings-panel').classList.remove('open');
  document.getElementById('btn-settings').classList.remove('active');
  adjustSettingsHeight();
}
function initSettingsPanel(){
  document.getElementById('btn-settings').addEventListener('click',toggleSettingsPanel);
  document.getElementById('btn-settings-close').addEventListener('click',closeSettingsPanel);
  document.getElementById('btn-settings-reset').addEventListener('click',resetSettings);
  document.getElementById('sl-spring').addEventListener('input',function(){
    document.getElementById('val-spring').textContent=this.value;
    if(network)network.setOptions({physics:{barnesHut:{springLength:+this.value}}});
  });
  document.getElementById('sl-gravity').addEventListener('input',function(){
    const v=+this.value;
    document.getElementById('val-gravity').textContent=(v/1000).toFixed(1)+'k';
    if(network)network.setOptions({physics:{barnesHut:{gravitationalConstant:v}}});
  });
  document.getElementById('sl-damping').addEventListener('input',function(){
    document.getElementById('val-damping').textContent=(+this.value).toFixed(2);
    if(network)network.setOptions({physics:{barnesHut:{damping:+this.value}}});
  });
  document.getElementById('sl-edge-w').addEventListener('input',function(){
    document.getElementById('val-edge-w').textContent=this.value;
    if(network)network.setOptions({edges:{width:+this.value,selectionWidth:+this.value*2}});
  });
  document.getElementById('sl-node-s').addEventListener('input',function(){
    const v=+this.value;
    document.getElementById('val-node-s').textContent=v;
    if(network)network.setOptions({nodes:{scaling:{min:Math.round(v*0.53),max:v}}});
  });
  document.getElementById('sl-dots').addEventListener('input',function(){
    document.getElementById('val-dots').textContent=this.value;
    const s=this.value+'px '+this.value+'px';
    document.getElementById('graph').style.backgroundSize=s;
  });
  setupToggle('tog-physics',function(on){if(network)network.setOptions({physics:{enabled:on}});});
  setupToggle('tog-curved',function(on){if(network)network.setOptions({edges:{smooth:{type:on?'continuous':'discrete'}}});});
  setupToggle('tog-theme',function(on){ setThemeState(on); });
  setupToggle('tog-monochrome',function(on){ setColorState(!on); });
  setupToggle('tog-card-left',function(on){setNodeCardPosition(on);});
  setupToggle('tog-wiki',function(on){setWikiMode(on);});
  setupToggle('tog-wiki-tight',function(on){setWikiTight(on);});
  setupToggle('tog-labels',function(on){
    labelsVisible=on;
    const updates=Object.keys(currentNodeData).map(function(id){
      const lvl=currentNodeData[id]&&currentNodeData[id].level;
      return {id:id,font:{size:on?(lvl===0?17:13):0,bold:lvl===0&&on}};
    });
    if(updates.length>0)nodes.update(updates);
    if(network)network.setOptions({nodes:{font:{size:on?13:0}}});
  });
  // Apply default card position on init
  setNodeCardPosition(true);
}
function resetSettings(){
  document.getElementById('sl-spring').value=130;document.getElementById('val-spring').textContent='130';
  document.getElementById('sl-gravity').value=-8000;document.getElementById('val-gravity').textContent='-8.0k';
  document.getElementById('sl-damping').value=0.06;document.getElementById('val-damping').textContent='0.06';
  document.getElementById('sl-edge-w').value=2;document.getElementById('val-edge-w').textContent='2';
  document.getElementById('sl-node-s').value=30;document.getElementById('val-node-s').textContent='30';
  document.getElementById('sl-dots').value=28;document.getElementById('val-dots').textContent='28';
  document.getElementById('graph').style.backgroundSize='28px 28px';
  ['tog-physics','tog-curved','tog-labels'].forEach(function(id){
    const el=document.getElementById(id);el.setAttribute('data-on','true');el.querySelector('.toggle-label').textContent='ON';
  });
  // Reset monochrome and color state
  setColorState(true);
  // Reset theme to dark
  setThemeState(true);
  labelsVisible=true;
  setNodeCardPosition(true);
  wikiTight=false;setWikiTight(false);
  setWikiMode(false);
  if(network){network.setOptions({physics:{enabled:true,solver:'barnesHut',barnesHut:{gravitationalConstant:-8000,centralGravity:0,springLength:130,springConstant:0.04,damping:0.06,avoidOverlap:0.3}},edges:{width:2,selectionWidth:4,smooth:{type:'continuous'}},nodes:{scaling:{min:16,max:30},font:{size:13}}});}
  const updates=Object.keys(currentNodeData).map(function(id){
    const lvl=currentNodeData[id]&&currentNodeData[id].level;return {id:id,font:{size:lvl===0?17:13,bold:lvl===0}};
  });
  if(updates.length>0)nodes.update(updates);
}
