'use strict';
let network=null,nodes=null,edges=null,isDark=true,currentNodeData={},currentEdgeData=[],edgeIdCounter=0;
window.addEventListener('DOMContentLoaded',function(){initGraph();initSearch();initButtons();initButtonStack();initIntroCard();initNodeCard();initEdgeCard();initExplorePanel();initLoader();});
function initGraph(){const container=document.getElementById('graph');nodes=new vis.DataSet([]);edges=new vis.DataSet([]);const options={physics:{enabled:true,stabilization:{iterations:150},barnesHut:{gravitationalConstant:-8000,centralGravity:0.4,springLength:90,springConstant:0.1,damping:0.15}},nodes:{shape:'dot',size:20,font:{color:'#e8e8f0',size:13,face:'ui-sans-serif,system-ui,sans-serif'},borderWidth:2,borderWidthSelected:3,color:{background:'#4A90D9',border:'#2a6aad',highlight:{background:'#7B6CF6',border:'#5a4cd6'},hover:{background:'#5aa0e9',border:'#2a6aad'}}},edges:{width:1.5,color:{color:'#4A90D9',opacity:0.5,highlight:'#7B6CF6',hover:'#7B6CF6'},smooth:{type:'curvedCW',roundness:0.1},selectionWidth:3},interaction:{hover:true,tooltipDelay:200}};network=new vis.Network(container,{nodes,edges},options);setTimeout(function(){const canvas=container.querySelector('canvas');if(canvas)canvas.style.backgroundColor='#0a0a0f';},100);network.on('click',function(params){if(params.nodes.length>0){const nodeId=params.nodes[0];const nodeData=currentNodeData[nodeId];if(nodeData)showNodeCard(nodeId,nodeData);}else if(params.edges.length>0){const edgeId=params.edges[0];const edge=edges.get(edgeId);if(edge)showEdgeCard(edge);}});network.on('doubleClick',function(params){if(params.nodes.length>0)network.focus(params.nodes[0],{scale:1.5,animation:true});});}
function initSearch(){const input=document.getElementById('fractal-input');const field=document.getElementById('fractal-field');input.addEventListener('keydown',function(e){if(e.key==='Enter'&&this.value.trim()!==''){e.preventDefault();createTag(this.value.trim());this.value='';}if(e.key==='Backspace'&&this.value===''){const tags=field.querySelectorAll('.search-tag');if(tags.length>0)tags[tags.length-1].remove();}});}
function createTag(text){const field=document.getElementById('fractal-field');const input=document.getElementById('fractal-input');const tag=document.createElement('div');tag.className='search-tag';tag.dataset.value=text;tag.innerHTML='<span>'+text+'</span><span class="delete-x">✕</span>';tag.addEventListener('click',function(){this.remove();input.focus();});field.insertBefore(tag,input);}
function getTags(){return Array.from(document.querySelectorAll('#fractal-field .search-tag span:first-child')).map(s=>s.textContent.trim());}
function clearTags(){document.querySelectorAll('#fractal-field .search-tag').forEach(t=>t.remove());}
function initButtons(){document.getElementById('btn-map').addEventListener('click',generateMap);document.getElementById('btn-random').addEventListener('click',generateRandom);document.getElementById('btn-clear').addEventListener('click',clearMap);}
async function generateMap(){const tags=getTags();const input=document.getElementById('fractal-input');const rawInput=input.value.trim();let query='';if(tags.length>0){query=tags.join(' ');}else if(rawInput!==''){query=rawInput;createTag(rawInput);input.value='';}else{return;}showLoader();hideNodeCard();hideEdgeCard();try{await getSubPages(query);const mappedNodes=Object.entries(window.fractalNodeData).map(function(e){return Object.assign({name:e[0]},e[1]);});console.log("MAPPED NODES:",mappedNodes);console.log("EDGES:",window.fractalEdgeData);renderGraph({nodes:mappedNodes,edges:window.fractalEdgeData||[]});}catch(e){console.error('Map generation failed:',e);}finally{hideLoader();document.getElementById('btn-clear').style.display='';}}
async function generateRandom(){const query=await getRandomArticle();createTag(query);}
function clearMap(){nodes.clear();edges.clear();clearTags();currentNodeData={};currentEdgeData=[];edgeIdCounter=0;hideNodeCard();hideEdgeCard();closeExplorePanel();hideDemoBanner();document.getElementById('btn-clear').style.display='none';}
function shortRelationship(rel){
  if(!rel) return '';
  const map={drives:'drives',tensions:'tensions',tension:'tensions',supports:'supports',constrains:'constrains',enables:'enables',conflicts:'conflicts',shapes:'shapes',limits:'limits',produces:'produces',depends:'depends'};
  const lower=rel.toLowerCase().trim();
  if(map[lower]) return map[lower];
  return lower.split(/[\s_-]/)[0];
}
function renderGraph(data){
  const idToName = {};
  const rawEdges = data.edges || [];

  const visNodes = data.nodes.map(function(node){
    if(!currentNodeData[node.name]) currentNodeData[node.name] = node;
    if(node.id !== undefined && node.id !== null) idToName[String(node.id)] = node.name;

    const isEmergent =
      node.color === 'grey' ||
      node.type === 'emergent' ||
      node.color === '#888888' ||
      (node.name && node.name.toLowerCase().includes('emergent'));

    return {
      id: node.name,
      label: wrapLabel(node.name),
      color: {
        background: isEmergent ? '#555566' : '#4A90D9',
        border: isEmergent ? '#333344' : '#2a6aad',
        highlight: { background: '#7B6CF6', border: '#5a4cd6' },
        hover: { background: isEmergent ? '#666677' : '#5aa0e9', border: '#2a6aad' }
      },
      size: isEmergent ? 18 : 22,
      font: { color: '#e8e8f0' }
    };
  });

  // Backend edges use node ids; frontend nodes use node names as vis ids.
  const normalizedEdges = rawEdges.map(function(edge){
    const fromKey = String(edge.source);
    const toKey = String(edge.target);
    const from = (edge.source in idToName) ? idToName[edge.source] : (fromKey in idToName ? idToName[fromKey] : edge.source);
    const to = (edge.target in idToName) ? idToName[edge.target] : (toKey in idToName ? idToName[toKey] : edge.target);
    return Object.assign({}, edge, { source: from, target: to });
  });

  // Merge new edges, skip duplicates
  const newEdges = normalizedEdges.filter(function(edge){
    return !currentEdgeData.some(function(e){ return e.source===edge.source && e.target===edge.target; });
  });
  currentEdgeData = currentEdgeData.concat(newEdges);

  // Add/update nodes (vis DataSet update = upsert)
  nodes.update(visNodes);

  // Add only new edges
  const visEdges = newEdges.map(function(edge){
    const rel = shortRelationship(edge.relationship);
    return {
      id: 'e' + (edgeIdCounter++),
      from: edge.source,
      to: edge.target,
      label: rel,
      title: edge.relationship || '',
      font: { size: 9, color: '#888', align: 'middle' }
    };
  });
  edges.add(visEdges);

  network.fit({ animation: { duration: 800, easingFunction: 'easeInOutQuad' } });
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
}
function hideNodeCard(){document.getElementById('node-card').style.display='none';}
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
  currentEdgeData.forEach(function(edge){
    let connected=null;
    if(edge.source===nodeId)connected=edge.target;
    if(edge.target===nodeId)connected=edge.source;
    if(connected){
      const chip=document.createElement('span');
      chip.className='node-chip';
      chip.textContent=connected;
      chip.style.cssText='display:inline-block;background:#0a0a0f;border:2px solid #4A90D9;color:#4A90D9;font-size:9px;font-weight:700;text-transform:uppercase;padding:3px 8px;margin:2px;box-shadow:2px 2px 0 #000;cursor:pointer;';
      chip.addEventListener('click',function(){showNodeCard(connected,currentNodeData[connected]||{});});
      connectedDiv.appendChild(chip);
    }
  });

  document.getElementById('explore-panel').classList.add('open');
  document.getElementById('explore-panel').style.display='flex';
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
