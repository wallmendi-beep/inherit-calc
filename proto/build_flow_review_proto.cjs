const fs = require('fs');

const jsonPath = '/home/naruami3430/Downloads/Test_김혁조_상속지분계산_2026-05-03.json';
const outPath = '/home/naruami3430/inherit-calc/proto/inheritance-flow-review-proto.html';
const outPathDownloads = '/home/naruami3430/Downloads/inheritance-flow-review-proto.html';

const vault = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const MOCK_SHARES = {
  '김혁조': { n: 1, d: 1 },
  '구수명': { n: 2, d: 15 },
  '김명남': { n: 1, d: 15 },
  '김명수': { n: 1, d: 15 },
  '김말수': { n: 1, d: 15 },
  '김일상': { n: 6, d: 15 },
  '김일주': { n: 4, d: 15 },
  '구-김명남': { n: 2, d: 165 },
  '구-김명수': { n: 2, d: 165 },
  '구-김말수': { n: 2, d: 165 },
  '구-김일상': { n: 8, d: 165 },
  '구-김일주': { n: 8, d: 165 },
};

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>상속지분 분기 검토 프로토타입</title>
  <link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
  <style>
    :root {
      --bg: #f7f7f5;
      --panel: #fff;
      --ink: #37352f;
      --muted: #787774;
      --line: #e9e9e7;
      --blue: #3b5f8a;
      --blue-soft: #f0f6ff;
      --green: #2f6f4d;
      --amber: #7a6240;
      --rose: #8a5a5f;
      --shadow: 0 10px 28px rgba(55, 53, 47, .10);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; font-family: Pretendard, system-ui, sans-serif; color: var(--ink); background: var(--bg); }
    button { font: inherit; }
    .app { display: grid; grid-template-rows: 48px 1fr; height: 100%; }
    .topbar { display: flex; align-items: center; gap: 14px; border-bottom: 1px solid var(--line); background: #fff; padding: 0 16px; }
    .title { font-size: 14px; font-weight: 900; letter-spacing: 0; }
    .meta { color: var(--muted); font-size: 12px; font-weight: 700; }
    .seg { margin-left: auto; display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: #fafaf9; }
    .seg button { border: 0; border-right: 1px solid var(--line); background: transparent; padding: 7px 10px; font-size: 12px; font-weight: 900; color: var(--muted); cursor: pointer; }
    .seg button:last-child { border-right: 0; }
    .seg button.active { color: #fff; background: #37352f; }
    .workspace { position: relative; height: 100%; }
    .report-panel { position: absolute; top: 0; bottom: 0; width: 390px; background: var(--panel); border-right: 1px solid var(--line); z-index: 20; overflow: auto; box-shadow: 8px 0 24px rgba(38, 37, 33, .05); }
    .report-panel.right { right: 0; border-right: 0; border-left: 1px solid var(--line); box-shadow: -8px 0 24px rgba(38, 37, 33, .05); }
    .report-panel.left { left: 0; }
    .report-head { position: sticky; top: 0; background: rgba(255,255,255,.94); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); padding: 18px 22px; z-index: 1; }
    .eyebrow { color: var(--blue); font-size: 11px; font-weight: 900; letter-spacing: .08em; }
    .report-title { margin-top: 6px; font-size: 23px; font-weight: 950; line-height: 1.2; }
    .report-sub { margin-top: 8px; font-size: 13px; color: var(--muted); line-height: 1.55; }
    .report-body { padding: 20px 22px 40px; }
    .section { margin-bottom: 24px; }
    .section h3 { margin: 0 0 10px; font-size: 12px; color: #55534d; font-weight: 950; letter-spacing: .02em; }
    .fact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .fact { border: 1px solid var(--line); border-radius: 8px; padding: 10px; background: #fafaf9; }
    .fact span { display: block; font-size: 10px; color: var(--muted); font-weight: 800; }
    .fact b { display: block; margin-top: 4px; font-size: 15px; }
    .dist-table { width: 100%; border-collapse: separate; border-spacing: 0; overflow: hidden; border: 1px solid var(--line); border-radius: 8px; }
    .dist-table th, .dist-table td { padding: 10px 9px; font-size: 12px; text-align: left; border-bottom: 1px solid #efeeeb; }
    .dist-table th { color: var(--muted); background: #fafaf9; font-size: 10px; font-weight: 900; }
    .dist-table tr:last-child td { border-bottom: 0; }
    .dist-table button { border: 0; background: none; color: var(--blue); font-weight: 900; cursor: pointer; padding: 0; }
    .note { display: flex; gap: 8px; padding: 10px 11px; border-radius: 8px; border: 1px solid #eadfcb; background: #fbf6ed; color: #7a6240; font-size: 12px; line-height: 1.5; }
    .canvas-shell { position: absolute; inset: 0; overflow: hidden; background: radial-gradient(#d7d5cf .8px, transparent .8px) 0 0 / 24px 24px, var(--bg); }
    .canvas-shell.panel-left { left: 390px; }
    .canvas-shell.panel-right { right: 390px; }
    .viewport { position: absolute; inset: 0; overflow: hidden; cursor: grab; }
    .viewport.dragging { cursor: grabbing; }
    .stage { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; }
    .stage-svg { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
    .nodes { position: absolute; inset: 0; }
    .node { position: absolute; width: 168px; min-height: 70px; border: 1.5px solid #e4e2de; border-radius: 8px; background: #fff; box-shadow: 0 3px 10px rgba(55,53,47,.06); padding: 11px 12px; cursor: pointer; transition: border .16s, box-shadow .16s, transform .16s; }
    .node:hover { transform: translateY(-1px); border-color: var(--blue); box-shadow: var(--shadow); }
    .node.active { border: 2.5px solid var(--blue); box-shadow: 0 8px 26px rgba(11,87,208,.18); }
    .node.event { border-top: 4px solid var(--blue); }
    .node.terminal { border-top: 4px solid var(--green); }
    .node.blocked { border-top: 4px solid var(--rose); opacity: .82; }
    .kind { font-size: 10px; color: var(--muted); font-weight: 900; letter-spacing: .02em; }
    .name { margin-top: 5px; font-size: 14px; font-weight: 950; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; }
    .chip { display: inline-flex; align-items: center; border: 1px solid #d7e5f9; background: var(--blue-soft); color: #3b5f8a; border-radius: 6px; padding: 3px 6px; font-size: 10px; font-weight: 950; }
    .chip.green { border-color: #cce7d6; background: #f0faf4; color: #237247; }
    .chip.amber { border-color: #eadfcb; background: #fff8eb; color: var(--amber); }
    .expand { position: absolute; right: -13px; top: calc(50% - 13px); width: 26px; height: 26px; border: 1px solid var(--line); border-radius: 50%; background: #fff; color: var(--blue); display: grid; place-items: center; font-size: 13px; font-weight: 950; box-shadow: 0 2px 8px rgba(0,0,0,.12); }
    .edge-label { font-size: 11px; font-weight: 900; fill: #3b5f8a; paint-order: stroke; stroke: #fff; stroke-width: 4px; stroke-linejoin: round; }
    .tools { position: absolute; right: 18px; bottom: 18px; z-index: 25; display: flex; gap: 10px; align-items: end; }
    .toolbox { display: grid; grid-template-columns: 48px 48px 40px 40px 40px; overflow: hidden; border: 1px solid #d8d6d0; background: #fff; border-radius: 10px; box-shadow: var(--shadow); }
    .toolbox button { height: 40px; border: 0; border-right: 1px solid #efeeeb; background: #fff; font-size: 12px; font-weight: 900; cursor: pointer; color: #55534d; }
    .toolbox button.icon { font-size: 18px; }
    .toolbox button:last-child { border-right: 0; }
    .zoom { border: 1px solid var(--line); background: #fff; border-radius: 999px; padding: 8px 12px; font-size: 12px; font-weight: 950; color: var(--muted); box-shadow: 0 4px 16px rgba(0,0,0,.08); }
    .overview { position: absolute; left: 18px; bottom: 18px; z-index: 25; border: 1px solid var(--line); background: rgba(255,255,255,.92); border-radius: 10px; padding: 10px 12px; width: 230px; box-shadow: 0 4px 16px rgba(0,0,0,.08); }
    .overview b { display: block; font-size: 12px; margin-bottom: 4px; }
    .overview p { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.45; }
  </style>
</head>
<body>
  <div class="app">
    <header class="topbar">
      <div class="title">상속지분 분기 검토</div>
      <div class="meta">사건 수에 맞춰 화면 크기를 계산하는 분기 검토 프로토타입</div>
      <div class="seg" aria-label="보고서 패널 위치">
        <button id="panelLeft" class="active">보고서 왼쪽</button>
        <button id="panelRight">보고서 오른쪽</button>
      </div>
    </header>
    <main class="workspace">
      <aside id="reportPanel" class="report-panel left"></aside>
      <section id="canvasShell" class="canvas-shell panel-left">
        <div id="viewport" class="viewport">
          <div id="stage" class="stage">
            <svg id="edges" class="stage-svg"></svg>
            <div id="nodes" class="nodes"></div>
          </div>
        </div>
        <div class="overview">
          <b>분기 흐름 지도</b>
          <p>파란 노드는 사망 사건, 초록 노드는 최종 취득자입니다. 사망자가 상속지분을 받으면 다음 재상속 또는 대습 사건으로 이어집니다.</p>
        </div>
        <div class="tools">
          <div class="zoom" id="zoomText">100%</div>
          <div class="toolbox">
            <button id="collapseAll" title="전체 접기">접기</button>
            <button id="expandAll" title="전체 펼치기">펼침</button>
            <button id="zoomOut" class="icon" title="축소">−</button>
            <button id="fit" class="icon" title="선택 노드 중심 보기">⌖</button>
            <button id="zoomIn" class="icon" title="확대">+</button>
          </div>
        </div>
      </section>
    </main>
  </div>
  <script>
    const VAULT = ${JSON.stringify(vault)};
    const MOCK_SHARES = ${JSON.stringify(MOCK_SHARES)};

    const NODE_W = 168;
    const NODE_H = 74;
    const X_GAP = 116;
    const Y_GAP = 22;
    const PAD = 72;
    const state = { selectedId: 'event:root', scale: 1, tx: 0, ty: 0, panelSide: 'left', collapsed: new Set(), didPan: false };
    let graph = null;
    let drag = null;

    const compactName = (name) => (name || '').replace(/\\s/g, '');
    const shareOf = (person, prefix = '') => {
      const key = compactName(person.name);
      const prefixed = prefix ? prefix + key : key;
      return MOCK_SHARES[prefixed] || (person.shareN && person.shareD ? { n: person.shareN, d: person.shareD } : null);
    };
    const relationLabel = (rel) => ({ wife: '처/배우자', husband: '남편/배우자', spouse: '배우자', son: '아들', daughter: '딸', parent: '직계존속', sibling: '형제자매' }[rel] || rel || '관계 미상');
    const lawLabel = (date) => {
      const y = parseInt((date || '').slice(0, 4), 10);
      if (!y) return '적용 법 확인';
      if (y < 1960) return '관습법 검토';
      if (y < 1979) return '1960 제정민법';
      if (y < 1991) return '1979 개정민법';
      return '1991 개정민법';
    };
    const isBeforeOrSame = (a, b) => a && b && a <= b;

    function createGraph(root) {
      const nodes = new Map();
      const edges = [];
      const children = new Map();
      const addNode = (node) => nodes.set(node.id, node);
      const addEdge = (edge) => {
        edges.push(edge);
        if (!children.has(edge.from)) children.set(edge.from, []);
        children.get(edge.from).push(edge.to);
      };

      function addEvent(person, inheritedShareValue, parentDate, id, sourcePrefix = '') {
        const eventNode = {
          id,
          type: 'event',
          person,
          title: '망 ' + (person.name || '이름 미상'),
          kind: id === 'event:root' ? '원상속 사건' : '후속 상속 사건',
          date: person.deathDate || parentDate || '',
          inheritedShare: inheritedShareValue,
          law: lawLabel(person.deathDate || parentDate || ''),
          dists: [],
        };
        addNode(eventNode);

        let heirs = Array.isArray(person.heirs) ? person.heirs : [];
        if (compactName(person.name) === '구수명' && heirs.length === 0) {
          heirs = (VAULT.heirs || []).filter((h) => ['son', 'daughter'].includes(h.relation));
        }

        heirs.forEach((heir, index) => {
          const heirShare = shareOf(heir, sourcePrefix) || shareOf(heir);
          const deathDate = heir.deathDate || '';
          const eventDate = person.deathDate || parentDate || '';
          const isPre = heir.isDeceased && isBeforeOrSame(deathDate, eventDate);
          const isBlocked = heir.isExcluded && heir.exclusionOption && heir.exclusionOption !== 'predeceased';
          const canContinue = heir.isDeceased && !isBlocked && !isPre && (Array.isArray(heir.heirs) && heir.heirs.length > 0 || compactName(person.name) === '구수명');
          const leafId = 'person:' + id + ':' + (heir.personId || heir.id || index);
          const targetId = canContinue ? 'event:' + id + ':' + (heir.personId || heir.id || index) : leafId;
          const flowType = canContinue ? '재상속' : isPre ? '선사망/대습 검토' : isBlocked ? '상속권 없음' : '최종 취득';
          const dist = { ...heir, share: heirShare, flowType, targetId, isPre, isBlocked, canContinue };
          eventNode.dists.push(dist);

          if (canContinue) {
            addEvent(heir, heirShare, eventDate, targetId, compactName(person.name) === '구수명' ? '구-' : '');
          } else {
            addNode({
              id: leafId,
              type: isBlocked ? 'blocked' : 'terminal',
              person: heir,
              title: heir.name || '이름 미상',
              kind: isBlocked ? '상속권 없음' : isPre ? '선사망 가지' : '최종 취득자',
              date: deathDate,
              inheritedShare: heirShare,
              law: '',
              dists: [],
            });
          }
          addEdge({ from: id, to: targetId, share: heirShare, label: flowType, person: heir });
        });
      }

      addEvent(root, { n: 1, d: 1 }, null, 'event:root', '');
      return { nodes, edges, children };
    }

    function visibleChildren(id) {
      if (state.collapsed.has(id)) return [];
      return graph.children.get(id) || [];
    }

    function measure(id) {
      const kids = visibleChildren(id);
      if (kids.length === 0) return NODE_H;
      return Math.max(NODE_H, kids.reduce((sum, cid) => sum + measure(cid), 0) + Y_GAP * (kids.length - 1));
    }

    function layout() {
      const positions = new Map();
      function place(id, depth, y) {
        const height = measure(id);
        positions.set(id, { x: PAD + depth * (NODE_W + X_GAP), y: y + (height - NODE_H) / 2 });
        let cy = y;
        visibleChildren(id).forEach((cid) => {
          place(cid, depth + 1, cy);
          cy += measure(cid) + Y_GAP;
        });
      }
      place('event:root', 0, PAD);
      let maxX = 0, maxY = 0;
      positions.forEach((p) => {
        maxX = Math.max(maxX, p.x + NODE_W + PAD);
        maxY = Math.max(maxY, p.y + NODE_H + PAD);
      });
      return { positions, width: maxX, height: maxY };
    }

    function render() {
      const { positions, width, height } = layout();
      const stage = document.getElementById('stage');
      const nodesEl = document.getElementById('nodes');
      const svg = document.getElementById('edges');
      stage.style.width = width + 'px';
      stage.style.height = height + 'px';
      svg.setAttribute('width', width);
      svg.setAttribute('height', height);
      nodesEl.innerHTML = '';
      svg.innerHTML = '';

      graph.edges.forEach((edge) => {
        const a = positions.get(edge.from);
        const b = positions.get(edge.to);
        if (!a || !b) return;
        const sx = a.x + NODE_W;
        const sy = a.y + NODE_H / 2;
        const tx = b.x;
        const ty = b.y + NODE_H / 2;
        const mid = (tx - sx) / 2;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M ' + sx + ' ' + sy + ' C ' + (sx + mid) + ' ' + sy + ', ' + (tx - mid) + ' ' + ty + ', ' + tx + ' ' + ty);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', edge.label === '상속권 없음' ? '#e3b0b3' : '#bdd7f4');
        path.setAttribute('stroke-width', '2.4');
        svg.appendChild(path);
        if (edge.share) {
          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('x', sx + mid);
          text.setAttribute('y', sy + (ty - sy) / 2 - 6);
          text.setAttribute('class', 'edge-label');
          text.textContent = edge.share.n + '/' + edge.share.d;
          svg.appendChild(text);
        }
      });

      positions.forEach((pos, id) => {
        const node = graph.nodes.get(id);
        const el = document.createElement('div');
        el.className = 'node ' + node.type + (state.selectedId === id ? ' active' : '');
        el.style.left = pos.x + 'px';
        el.style.top = pos.y + 'px';
        const share = node.inheritedShare ? node.inheritedShare.n + '/' + node.inheritedShare.d : '-';
        const chipClass = node.type === 'terminal' ? 'green' : node.type === 'blocked' ? 'amber' : '';
        el.innerHTML = '<div class="kind">' + node.kind + '</div><div class="name">' + node.title + '</div><div class="row"><span class="chip ' + chipClass + '">' + share + '</span><span class="kind">' + (node.date || '') + '</span></div>';
        el.onclick = (e) => {
          e.stopPropagation();
          if (state.didPan) return;
          state.selectedId = id;
          renderReport();
          render();
        };
        const kids = graph.children.get(id) || [];
        if (kids.length > 0) {
          const btn = document.createElement('button');
          btn.className = 'expand';
          btn.textContent = state.collapsed.has(id) ? '+' : '−';
          btn.onclick = (e) => { e.stopPropagation(); state.collapsed.has(id) ? state.collapsed.delete(id) : state.collapsed.add(id); render(); };
          el.appendChild(btn);
        }
        nodesEl.appendChild(el);
      });
      applyTransform();
    }

    function renderReport() {
      const panel = document.getElementById('reportPanel');
      const node = graph.nodes.get(state.selectedId) || graph.nodes.get('event:root');
      const inheritedShare = node.inheritedShare ? node.inheritedShare.n + '/' + node.inheritedShare.d : '-';
      const eventReport = node.type === 'event';
      const dists = eventReport ? node.dists : [];
      const rows = dists.map((d) => {
        const share = d.share ? d.share.n + '/' + d.share.d : '-';
        const clickable = d.targetId && graph.nodes.has(d.targetId);
        return '<tr><td>' + (clickable ? '<button data-id="' + d.targetId + '">' + (d.name || '이름 미상') + '</button>' : (d.name || '이름 미상')) + '</td><td>' + relationLabel(d.relation) + '</td><td><b>' + share + '</b></td><td>' + d.flowType + '</td></tr>';
      }).join('');
      const notes = [];
      if (eventReport && node.law !== '1991 개정민법') notes.push('구법 사건이므로 호주가산, 출가녀 감산, 배우자 지위 검토가 필요합니다.');
      if (eventReport && dists.some((d) => d.isBlocked)) notes.push('상속권 없음 처리된 사람이 있습니다. 배제 사유와 다음 분기 반영 여부를 확인해야 합니다.');
      if (eventReport && dists.some((d) => d.canContinue)) notes.push('지분을 받은 뒤 다시 사망한 사람이 있어 다음 재상속 사건으로 분기됩니다.');

      panel.innerHTML =
        '<div class="report-head"><div class="eyebrow">' + (eventReport ? '사건 보고서' : '상속인 보고서') + '</div><div class="report-title">' + node.title + '</div><div class="report-sub">' + (eventReport ? '이 노드가 속한 상속지분 분배 사건의 계산 결과를 보고서 형식으로 표시합니다.' : '이 노드는 현재 분기에서 더 이상 사건으로 이어지지 않는 취득자 또는 배제 가지입니다.') + '</div></div>' +
        '<div class="report-body">' +
        '<div class="section"><h3>사건 요약</h3><div class="fact-grid">' +
        '<div class="fact"><span>' + (eventReport ? '피상속지분' : '상속지분') + '</span><b>' + inheritedShare + '</b></div>' +
        '<div class="fact"><span>기준일</span><b>' + (node.date || '미상') + '</b></div>' +
        '<div class="fact"><span>적용 법</span><b>' + (node.law || '-') + '</b></div>' +
        '<div class="fact"><span>노드 유형</span><b>' + node.kind + '</b></div>' +
        '</div></div>' +
        (eventReport ? '<div class="section"><h3>분배 명세</h3><table class="dist-table"><thead><tr><th>상속인</th><th>관계</th><th>지분</th><th>분기</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '') +
        (notes.length ? '<div class="section"><h3>검토 메모</h3>' + notes.map((n) => '<div class="note"><b>!</b><span>' + n + '</span></div>').join('<div style="height:8px"></div>') + '</div>' : '') +
        '</div>';
      panel.querySelectorAll('button[data-id]').forEach((btn) => {
        btn.onclick = () => { state.selectedId = btn.dataset.id; renderReport(); render(); focusNode(btn.dataset.id); };
      });
    }

    function applyTransform() {
      document.getElementById('stage').style.transform = 'translate(' + state.tx + 'px, ' + state.ty + 'px) scale(' + state.scale + ')';
      document.getElementById('zoomText').textContent = Math.round(state.scale * 100) + '%';
    }

    function fitView() {
      const shell = document.getElementById('canvasShell');
      const { positions, width, height } = layout();
      const scale = Math.min(1.2, Math.max(.32, Math.min((shell.clientWidth - 80) / width, (shell.clientHeight - 80) / height)));
      state.scale = scale;
      const selected = positions.get(state.selectedId);
      if (selected && (width * scale > shell.clientWidth || height * scale > shell.clientHeight)) {
        state.tx = shell.clientWidth / 2 - (selected.x + NODE_W / 2) * scale;
        state.ty = shell.clientHeight / 2 - (selected.y + NODE_H / 2) * scale;
      } else {
        state.tx = Math.max(24, (shell.clientWidth - width * scale) / 2);
        state.ty = Math.max(24, (shell.clientHeight - height * scale) / 2);
      }
      applyTransform();
    }

    function focusNode(id) {
      const shell = document.getElementById('canvasShell');
      const { positions } = layout();
      const p = positions.get(id);
      if (!p) return;
      state.tx = shell.clientWidth / 2 - (p.x + NODE_W / 2) * state.scale;
      state.ty = shell.clientHeight / 2 - (p.y + NODE_H / 2) * state.scale;
      applyTransform();
    }

    function collapseAll() {
      state.collapsed = new Set(Array.from(graph.nodes.keys()).filter((id) => graph.children.has(id)));
      state.selectedId = 'event:root';
      renderReport();
      render();
      fitView();
    }

    function expandAll() {
      state.collapsed.clear();
      render();
      fitView();
    }

    function setPanel(side) {
      state.panelSide = side;
      document.getElementById('reportPanel').className = 'report-panel ' + side;
      document.getElementById('canvasShell').className = 'canvas-shell panel-' + side;
      document.getElementById('panelLeft').classList.toggle('active', side === 'left');
      document.getElementById('panelRight').classList.toggle('active', side === 'right');
      setTimeout(fitView, 80);
    }

    document.getElementById('zoomIn').onclick = () => { state.scale = Math.min(1.8, state.scale + .1); applyTransform(); };
    document.getElementById('zoomOut').onclick = () => { state.scale = Math.max(.32, state.scale - .1); applyTransform(); };
    document.getElementById('fit').onclick = fitView;
    document.getElementById('collapseAll').onclick = collapseAll;
    document.getElementById('expandAll').onclick = expandAll;
    document.getElementById('panelLeft').onclick = () => setPanel('left');
    document.getElementById('panelRight').onclick = () => setPanel('right');

    const viewport = document.getElementById('viewport');
    const startPan = (e) => {
      if (!e.target.closest('#canvasShell')) return;
      if (e.target.closest('button')) return;
      e.preventDefault();
      state.didPan = false;
      drag = { x: e.clientX, y: e.clientY, tx: state.tx, ty: state.ty };
      viewport.classList.add('dragging');
      try { viewport.setPointerCapture(e.pointerId); } catch (_) {}
    };
    const movePan = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) state.didPan = true;
      state.tx = drag.tx + dx;
      state.ty = drag.ty + dy;
      applyTransform();
    };
    const endPan = () => {
      drag = null;
      viewport.classList.remove('dragging');
      setTimeout(() => { state.didPan = false; }, 0);
    };
    viewport.addEventListener('pointerdown', startPan, true);
    document.addEventListener('pointerdown', startPan, true);
    window.addEventListener('pointermove', movePan);
    window.addEventListener('pointerup', endPan);
    viewport.addEventListener('mousedown', startPan, true);
    document.addEventListener('mousedown', startPan, true);
    window.addEventListener('mousemove', movePan);
    window.addEventListener('mouseup', endPan);
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const next = Math.max(.32, Math.min(1.8, state.scale + (e.deltaY > 0 ? -.08 : .08)));
      state.scale = next;
      applyTransform();
    }, { passive: false });
    window.addEventListener('resize', fitView);

    graph = createGraph(VAULT);
    state.collapsed = new Set(Array.from(graph.nodes.keys()).filter((id) => graph.children.has(id)));
    renderReport();
    render();
    fitView();
  </script>
</body>
</html>`;

fs.writeFileSync(outPath, html);
fs.writeFileSync(outPathDownloads, html);
console.log(outPath);
console.log(outPathDownloads);
