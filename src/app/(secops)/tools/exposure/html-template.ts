// src/app/(secops)/tools/exposure/template.ts

export interface ReportMetadata {
  title: string;
  date: string;
}

export function generateHTML(data: any, metadata: ReportMetadata, visJsSource: string): string {
  const safeJsonData = JSON.stringify(data).replace(/</g, '\\u003c');
  const safeMetadata = JSON.stringify(metadata).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.title || 'Network Exposure Live Report'}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <script>
      ${visJsSource}
    </script>
    <style>
        :root {
            --bg: #f8fafc;
            --sidebar-bg: #D5EDF2;
            --accent: #0339A6;
            --accent-glow: rgba(3, 57, 166, 0.4);
            --border: #7EC8D9;
            --text-main: #0f172a;
            --text-dim: #475569;
            --crit: #ef4444;
            --high: #f97316;
            --med: #eab308;
            --low: #5684BF;
            --info: #033E8C;
            --glass: #ffffff;
        }

        * {
            box-sizing: border-box;
            scrollbar-width: thin;
            scrollbar-color: var(--accent) transparent;
        }

        body, html {
            margin: 0;
            padding: 0;
            height: 100%;
            background: var(--bg);
            color: var(--text-main);
            font-family: 'Inter', sans-serif;
            overflow: hidden;
        }

        #layout {
            display: grid;
            grid-template-columns: 450px 1fr;
            height: 100vh;
        }

        aside {
            background: var(--sidebar-bg);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            backdrop-filter: blur(12px);
            z-index: 10;
            overflow: hidden;
        }

        .header {
            padding: 25px;
            border-bottom: 1px solid var(--border);
            background: linear-gradient(to bottom, rgba(0, 0, 0, 0.3), transparent);
        }

        .header h1 {
            font-size: 18px;
            font-weight: 700;
            margin: 0;
            color: var(--text-main);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .header h1 span {
            color: var(--accent);
            text-shadow: 0 0 10px var(--accent-glow);
        }

        .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 15px;
            font-size: 11px;
            color: var(--text-dim);
        }

        .meta-item strong {
            color: var(--text-main);
            display: block;
            margin-bottom: 2px;
        }

        .tabs {
            display: flex;
            border-bottom: 1px solid var(--border);
            background: rgba(255, 255, 255, 0.5);
        }

        .tab {
            flex: 1;
            text-align: center;
            padding: 12px;
            font-size: 12px;
            font-weight: 600;
            color: var(--text-dim);
            cursor: pointer;
            transition: all 0.2s;
            border-bottom: 2px solid transparent;
        }

        .tab:hover {
            color: var(--text-main);
            background: var(--glass);
        }

        .tab.active {
            color: var(--accent);
            border-bottom-color: var(--accent);
            background: rgba(3, 57, 166, 0.05);
        }

        .stats-panel {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            padding: 15px 20px;
            border-bottom: 1px solid var(--border);
        }

        .stat-card {
            background: var(--glass);
            padding: 10px;
            border-radius: 8px;
            border: 1px solid var(--border);
            text-align: center;
        }

        .stat-value {
            font-size: 16px;
            font-weight: 700;
            font-family: 'JetBrains Mono', monospace;
            display: block;
        }

        .stat-label {
            font-size: 9px;
            color: var(--text-dim);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 4px;
        }

        .content-area {
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            padding: 20px;
        }

        .search-box {
            width: 100%;
            background: var(--glass);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 10px 15px;
            color: var(--text-main);
            font-size: 13px;
            margin-bottom: 15px;
            outline: none;
            transition: border-color 0.2s;
        }

        .search-box:focus {
            border-color: var(--accent);
        }

        /* Lists */
        .list-item {
            background: var(--glass);
            border: 1px solid var(--border);
            border-radius: 8px;
            margin-bottom: 10px;
            overflow: hidden;
        }

        .list-header {
            padding: 12px 15px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .list-header:hover {
            background: rgba(0,0,0,0.02);
        }

        .list-title {
            font-weight: 600;
            font-size: 13px;
        }

        .list-subtitle {
            font-size: 11px;
            color: var(--text-dim);
            font-family: 'JetBrains Mono', monospace;
            margin-top: 4px;
        }

        .list-body {
            display: none;
            padding: 15px;
            border-top: 1px solid var(--border);
            background: rgba(255,255,255,0.5);
            font-size: 12px;
            line-height: 1.5;
        }

        .list-item.open .list-body {
            display: block;
        }

        .badge {
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .badge.crit { background: rgba(239, 68, 68, 0.2); color: var(--crit); border: 1px solid var(--crit); }
        .badge.high { background: rgba(249, 115, 22, 0.2); color: var(--high); border: 1px solid var(--high); }
        .badge.med { background: rgba(234, 179, 8, 0.2); color: var(--med); border: 1px solid var(--med); }
        .badge.low { background: rgba(59, 130, 246, 0.2); color: var(--low); border: 1px solid var(--low); }
        .badge.info { background: rgba(34, 197, 94, 0.2); color: var(--info); border: 1px solid var(--info); }
        .badge.none { background: rgba(156, 163, 175, 0.2); color: var(--text-dim); border: 1px solid var(--text-dim); }

        .port-tag {
            display: inline-block;
            background: var(--glass);
            border: 1px solid var(--border);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            margin: 2px;
            font-family: 'JetBrains Mono';
        }

        .vuln-detail {
            margin-bottom: 12px;
        }
        
        .vuln-detail strong {
            color: var(--accent);
            display: block;
            font-size: 11px;
            text-transform: uppercase;
            margin-bottom: 4px;
        }

        .vuln-detail pre {
            background: rgba(0,0,0,0.03);
            padding: 10px;
            border-radius: 6px;
            border: 1px solid var(--border);
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            overflow-x: auto;
            white-space: pre-wrap;
            color: var(--text-dim);
        }

        .vuln-item-row {
            margin-bottom: 4px; display:flex; gap: 8px; align-items: flex-start; cursor: pointer; transition: background 0.2s; padding: 4px; border-radius: 4px;
        }
        .vuln-item-row:hover {
            background: rgba(0,0,0,0.05);
        }
        .terminal-output {
            background: #0f172a;
            color: #10b981;
            font-family: 'JetBrains Mono', monospace;
            padding: 10px;
            border-radius: 4px;
            border: 1px solid #1e293b;
            overflow-x: auto;
            white-space: pre-wrap;
            margin-top: 4px;
            font-size: 10px;
        }

        main {
            position: relative;
            background: #e2e8f0;
        }

        #mynetwork {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }

        .controls {
            position: absolute;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 15px;
            background: rgba(255, 255, 255, 0.9);
            padding: 10px 20px;
            border-radius: 50px;
            border: 1px solid var(--border);
            backdrop-filter: blur(10px);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
            z-index: 100;
        }

        button.btn-glass {
            background: transparent;
            border: none;
            color: var(--text-main);
            padding: 8px 16px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.2s;
        }

        button.btn-glass:hover {
            background: var(--glass);
            color: var(--accent);
        }

        button.btn-glass.active {
            background: var(--accent);
            color: white;
        }

        .loader-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: var(--bg);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            transition: opacity 0.5s;
        }
        .spinner {
            width: 50px; height: 50px;
            border: 4px solid var(--border);
            border-top-color: var(--accent);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        .progress-bar-container {
            width: 300px;
            height: 6px;
            background: var(--border);
            border-radius: 10px;
            margin-top: 15px;
            overflow: hidden;
        }
        .progress-bar-fill {
            height: 100%;
            background: var(--accent);
            width: 0%;
            transition: width 0.1s linear;
        }

        /* SVG Icons embedded for offline use */
        .icon {
            width: 16px;
            height: 16px;
            fill: none;
            stroke: currentColor;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
            display: inline-block;
            vertical-align: middle;
        }
    </style>
</head>
<body>

<div id="loader" class="loader-overlay">
    <div class="spinner"></div>
    <div style="margin-top:20px; font-weight:600; color:var(--text-main); font-size:14px;">Mapping Exposure Network...</div>
    <div class="progress-bar-container"><div id="progressBar" class="progress-bar-fill"></div></div>
</div>

<div id="layout">
    <aside>
        <div class="header">
            <h1>
                <svg class="icon" style="width:24px;height:24px;color:var(--accent)" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                <span>Network</span> Exposure
            </h1>
            <div class="meta-grid">
                <div class="meta-item"><strong>Report</strong> <span id="m-title"></span></div>
                <div class="meta-item"><strong>Date</strong> <span id="m-date"></span></div>
            </div>
        </div>

        <div class="stats-panel">
            <div class="stat-card"><span class="stat-value" id="s-hosts">0</span><span class="stat-label">Hosts</span></div>
            <div class="stat-card"><span class="stat-value" id="s-ports">0</span><span class="stat-label">Ports</span></div>
            <div class="stat-card"><span class="stat-value" id="s-vulns" style="color:var(--crit)">0</span><span class="stat-label">Vulns</span></div>
            <div class="stat-card"><span class="stat-value" id="s-crit" style="color:var(--crit)">0</span><span class="stat-label">Critical</span></div>
        </div>

        <div class="tabs">
            <div class="tab active" onclick="switchTab('hosts')">Hosts</div>
            <div class="tab" onclick="switchTab('vulns')">Vulnerabilities</div>
        </div>

        <div class="content-area">
            <input type="text" class="search-box" id="searchBox" placeholder="Filter..." onkeyup="renderLists()">
            <div id="list-container"></div>
        </div>
    </aside>

    <main>
        <div id="mynetwork"></div>
        <div class="controls">
            <button class="btn-glass" id="btn-ports" onclick="togglePorts()"><svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg> Ports</button>
            <button class="btn-glass" id="btn-vulns" onclick="toggleVulns()"><svg class="icon" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Vulns</button>
            <button class="btn-glass" onclick="network.fit()"><svg class="icon" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg> Fit Scan</button>
            <button class="btn-glass active" id="btn-physics" onclick="togglePhysics()"><svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg> Physics</button>
        </div>
    </main>
</div>

<script id="report-data" type="application/json">${safeJsonData}</script>
<script id="report-metadata" type="application/json">${safeMetadata}</script>
<script>
    const reportData = JSON.parse(document.getElementById('report-data').textContent);
    const metadata = JSON.parse(document.getElementById('report-metadata').textContent);
    
    function escapeHtml(unsafe) {
        if(!unsafe) return '';
        return unsafe.toString()
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
    
    let currentTab = 'hosts';
    let network = null;
    let physicsEnabled = true;

    // Initialize Metadata
    document.getElementById('m-title').innerText = metadata.title || 'N/A';
    document.getElementById('m-date').innerText = metadata.date || 'N/A';

    // Stats
    const vulns = reportData.vulnerabilities || [];
    const hosts = reportData.hosts || [];
    
    let portCount = 0;
    let critCount = 0;
    
    hosts.forEach(h => portCount += (h.ports ? h.ports.length : 0));
    vulns.forEach((v, idx) => {
        v._id = idx; // Assign internal ID for fast lazy-loading
        if(v.risk && v.risk.toLowerCase() === 'critical') critCount++;
    });

    // Performance Optimization: O(1) Lookup Maps
    const vulnsByHost = {};
    vulns.forEach(v => {
        if(!vulnsByHost[v.host]) vulnsByHost[v.host] = [];
        vulnsByHost[v.host].push(v);
    });

    document.getElementById('s-hosts').innerText = hosts.length;
    document.getElementById('s-ports').innerText = portCount;
    document.getElementById('s-vulns').innerText = vulns.length;
    document.getElementById('s-crit').innerText = critCount;

    function getRiskClass(risk) {
        if(!risk) return 'none';
        const r = risk.toLowerCase();
        if(r.includes('critical')) return 'crit';
        if(r.includes('high')) return 'high';
        if(r.includes('medium')) return 'med';
        if(r.includes('low')) return 'low';
        return 'none';
    }

    function switchTab(tab) {
        currentTab = tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        event.target.classList.add('active');
        renderLists();
    }

    function toggleItem(el) {
        el.parentElement.classList.toggle('open');
    }

    function renderLists() {
        const container = document.getElementById('list-container');
        const query = document.getElementById('searchBox').value.toLowerCase();
        let html = '';

        if (currentTab === 'hosts') {
            const filtered = hosts.filter(h => 
                h.ip.toLowerCase().includes(query) || 
                (h.hostname && h.hostname.toLowerCase().includes(query))
            );

            filtered.forEach((h, i) => {
                const ipVulns = vulnsByHost[h.ip] || [];
                const nameVulns = h.hostname && vulnsByHost[h.hostname] ? vulnsByHost[h.hostname] : [];
                let hostVulns = [...ipVulns, ...nameVulns];
                
                // Deduplicate by name
                const uniqueVulns = new Map();
                hostVulns.forEach(v => {
                    if(!uniqueVulns.has(v.name)) uniqueVulns.set(v.name, v);
                });
                hostVulns = Array.from(uniqueVulns.values());
                
                // Sort vulns by risk
                const riskWeights = { 'critical': 5, 'high': 4, 'medium': 3, 'low': 2, 'none': 1 };
                hostVulns.sort((a, b) => {
                    const rA = riskWeights[a.risk ? a.risk.toLowerCase() : 'none'] || 1;
                    const rB = riskWeights[b.risk ? b.risk.toLowerCase() : 'none'] || 1;
                    return rB - rA;
                });
                
                const maxRisk = hostVulns.some(v => v.risk.toLowerCase() === 'critical') ? 'crit' : 
                                hostVulns.some(v => v.risk.toLowerCase() === 'high') ? 'high' : 
                                hostVulns.some(v => v.risk.toLowerCase() === 'medium') ? 'med' : 
                                hostVulns.some(v => v.risk.toLowerCase() === 'low') ? 'low' : 'none';

                let portsHtml = '';
                if(h.ports) {
                    h.ports.forEach(p => {
                        portsHtml += \`<span class="port-tag">\${p.port}/\${p.protocol} \${p.service}</span>\`;
                    });
                }

                let vulnsHtml = '';
                if(hostVulns.length > 0) {
                    vulnsHtml = \`<div class="vuln-detail" style="margin-top: 10px;">
                        <strong>Findings (\${hostVulns.length})</strong>
                        \`;
                    hostVulns.forEach(v => {
                        vulnsHtml += \`<div>
                            <div class="vuln-item-row" onclick="toggleVulnDetails(this, \${v._id})">
                                <span class="badge \${getRiskClass(v.risk)}">\${escapeHtml(v.risk)}</span> 
                                <span style="flex:1; line-height:1.4;">\${escapeHtml(v.name)}</span>
                            </div>
                            <div class="vuln-expanded-content" style="display:none; padding-left:10px; border-left:2px solid var(--border); font-size:11px; margin-bottom:10px; color:var(--text-main);"></div>
                        </div>\`;
                    });
                    vulnsHtml += \`</div>\`;
                }

                html += \`
                <div class="list-item" id="host-item-\${i}">
                    <div class="list-header" onclick="toggleItem(this); focusNode('\${h.ip}')">
                        <div>
                            <div class="list-title">\${escapeHtml(h.ip)} \${h.hostname ? \`(\${escapeHtml(h.hostname)})\` : ''}</div>
                            <div class="list-subtitle">\${escapeHtml(h.os || 'OS Unknown')}</div>
                        </div>
                        <span class="badge \${maxRisk}">\${hostVulns.length} Vulns</span>
                    </div>
                    <div class="list-body">
                        <div class="vuln-detail">
                            <strong>Ports</strong>
                            <div>\${portsHtml || 'No open ports'}</div>
                        </div>
                        \${vulnsHtml}
                    </div>
                </div>\`;
            });
        } else {
            const filtered = vulns.filter(v => 
                v.name.toLowerCase().includes(query) || 
                v.host.toLowerCase().includes(query) ||
                (v.cve && v.cve.toLowerCase().includes(query)) ||
                (v.pluginId && v.pluginId.toLowerCase().includes(query))
            );

            // Group by name for cleaner display
            const grouped = {};
            filtered.forEach(v => {
                if(!grouped[v.name]) grouped[v.name] = { ...v, affectedHosts: new Set() };
                grouped[v.name].affectedHosts.add(v.host + (v.port && v.port !== 0 ? \`:\${v.port}\` : ''));
            });

            Object.values(grouped).forEach((v, i) => {
                const hostsArr = Array.from(v.affectedHosts);
                html += \`
                <div class="list-item">
                    <div class="list-header" onclick="toggleItem(this)">
                        <div style="flex:1; padding-right: 10px;">
                            <div class="list-title" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">\${escapeHtml(v.name)}</div>
                            <div class="list-subtitle">\${hostsArr.length} affected host(s)</div>
                        </div>
                        <span class="badge \${getRiskClass(v.risk)}">\${v.risk} \${v.cvss ? v.cvss : ''}</span>
                    </div>
                    <div class="list-body">
                        <div class="vuln-detail"><strong>Plugin ID / CVE</strong> \${escapeHtml(v.pluginId)} \${v.cve ? ' | ' + escapeHtml(v.cve) : ''}</div>
                        \${v.synopsis ? \`<div class="vuln-detail"><strong>Synopsis</strong>\${escapeHtml(v.synopsis)}</div>\` : ''}
                        \${v.description ? \`<div class="vuln-detail"><strong>Description</strong>\${escapeHtml(v.description)}</div>\` : ''}
                        \${v.solution ? \`<div class="vuln-detail"><strong>Solution</strong>\${escapeHtml(v.solution)}</div>\` : ''}
                        \${v.pluginOutput ? \`<div class="vuln-detail"><strong>Output Evidence</strong><pre>\${escapeHtml(v.pluginOutput)}</pre></div>\` : ''}
                        <div class="vuln-detail">
                            <strong>Affected Hosts/Ports</strong>
                            <div style="display:flex; flex-wrap:wrap; gap:4px;">
                                \${hostsArr.map(h => \`<span class="port-tag" onclick="focusNode('\${h.split(':')[0]}')">\${h}</span>\`).join('')}
                            </div>
                        </div>
                    </div>
                </div>\`;
            });
        }

        container.innerHTML = html;
    }

    // Network Initialization
    function initNetwork() {
        if(typeof vis === 'undefined') {
            console.error('vis is not loaded');
            return;
        }

        const nodesData = [];
        const edgesData = [];

        nodesData.push({
            id: 'root',
            label: 'TARGET NETWORK',
            fixed: true,
            x: 0,
            y: 0,
            color: { background: '#0339A6', border: '#033E8C' },
            font: { color: '#ffffff', size: 16, weight: 'bold' },
            shape: 'hexagon',
            size: 40
        });

        const hostsBySeverity = { 'critical': [], 'high': [], 'medium': [], 'low': [], 'info': [] };
        
        hosts.forEach(h => {
            const ipVulns = vulnsByHost[h.ip] || [];
            const nameVulns = h.hostname && vulnsByHost[h.hostname] ? vulnsByHost[h.hostname] : [];
            const hostVulns = [...ipVulns, ...nameVulns];
            
            const hasCrit = hostVulns.some(v => v.risk.toLowerCase() === 'critical');
            const hasHigh = hostVulns.some(v => v.risk.toLowerCase() === 'high');
            const hasMed = hostVulns.some(v => v.risk.toLowerCase() === 'medium');
            const hasLow = hostVulns.some(v => v.risk.toLowerCase() === 'low');
            
            if (hasCrit) hostsBySeverity['critical'].push({ h, hostVulns });
            else if (hasHigh) hostsBySeverity['high'].push({ h, hostVulns });
            else if (hasMed) hostsBySeverity['medium'].push({ h, hostVulns });
            else if (hasLow) hostsBySeverity['low'].push({ h, hostVulns });
            else hostsBySeverity['info'].push({ h, hostVulns });
        });
        
        // Define exact radii for concentric circles (Increased spacing for better visibility)
        const radiusMap = { 'critical': 350, 'high': 650, 'medium': 950, 'low': 1250, 'info': 1550 };
        
        // Define colors per severity
        const colorMap = {
            'critical': { background: '#9333ea', border: '#7e22ce' }, // Purple
            'high': { background: '#ef4444', border: '#b91c1c' }, // Red
            'medium': { background: '#eab308', border: '#a16207' }, // Yellow
            'low': { background: '#22c55e', border: '#15803d' }, // Green
            'info': { background: '#3b82f6', border: '#1d4ed8' }, // Blue
            'none': { background: '#3b82f6', border: '#1d4ed8' } // Blue fallback
        };
        
        window.lazyPortNodes = [];
        window.lazyPortEdges = [];
        window.lazyVulnNodes = [];
        window.lazyVulnEdges = [];
        
        Object.keys(hostsBySeverity).forEach(severity => {
            const groupHosts = hostsBySeverity[severity];
            const radius = radiusMap[severity];
            const angleStep = (2 * Math.PI) / (groupHosts.length || 1);
            
            groupHosts.forEach((item, index) => {
                const { h, hostVulns } = item;
                const angle = index * angleStep;
                
                // Add a slight alternating radius offset for an organic, less rigid look
                const organicOffset = (index % 2 === 0) ? 25 : -25;
                const finalRadius = radius + organicOffset;
                
                const hx = finalRadius * Math.cos(angle);
                const hy = finalRadius * Math.sin(angle);
                
                const hostColor = colorMap[severity] || colorMap['info'];

                nodesData.push({
                    id: h.ip,
                    label: h.ip,
                    fixed: true, // Perfect fixed geometric circles
                    x: hx,
                    y: hy,
                    color: { background: hostColor.background, border: hostColor.border, highlight: { background: hostColor.background, border: '#ffffff' } },
                    borderWidth: hostVulns.length > 0 ? 3 : 1,
                    shape: 'dot',
                    size: hostVulns.length > 0 ? 25 : 15,
                    font: { color: '#ffffff', size: 12, face: 'JetBrains Mono' }
                });

                edgesData.push({
                    from: 'root',
                    to: h.ip,
                    color: { color: 'rgba(255,255,255,0.1)' } // Faint background edge
                });
                
                // Add Port Nodes (Collect from both Nmap ports AND Nessus Vulns)
                const uniquePorts = new Set();
                if(h.ports) h.ports.forEach(p => uniquePorts.add(p.port));
                hostVulns.forEach(v => { if(v.port && v.port !== 0) uniquePorts.add(v.port); });
                
                Array.from(uniquePorts).forEach(portNum => {
                    const portId = h.ip + ':' + portNum;
                    window.lazyPortNodes.push({
                        id: portId,
                        group: 'port',
                        label: portNum.toString(),
                        shape: 'diamond',
                        size: 10,
                        color: { background: '#7EC8D9', border: '#5684BF' },
                        font: { size: 10, color: '#033E8C' }
                    });
                    window.lazyPortEdges.push({
                        from: h.ip,
                        to: portId,
                        length: 50,
                        color: { color: '#D5EDF2' }
                    });
                });
                
                // Add Vulnerability Nodes (ALL SEVERITIES)
                const groupedVulns = {};
                hostVulns.forEach(v => {
                    const risk = v.risk ? v.risk.toLowerCase() : 'info';
                    const p = (v.port && v.port !== 0) ? v.port : 0;
                    const vId = h.ip + ':' + p + ':' + v.pluginId;
                    if(!groupedVulns[vId]) {
                        groupedVulns[vId] = { name: v.name, risk: risk, port: p };
                    }
                });
                
                Object.keys(groupedVulns).forEach(vId => {
                    const v = groupedVulns[vId];
                    const vConfig = colorMap[v.risk] || colorMap['info'];
                    let vSize = 10;
                    if(v.risk === 'critical') vSize = 18;
                    else if(v.risk === 'high') vSize = 14;
                    else if(v.risk === 'medium') vSize = 12;
                    
                    window.lazyVulnNodes.push({
                        id: vId,
                        group: 'vuln',
                        label: '',
                        title: v.name, // Hover Tooltip
                        shape: 'triangleDown',
                        size: vSize,
                        color: { background: vConfig.background, border: '#ffffff' },
                    });
                    
                    window.lazyVulnEdges.push({
                        from: h.ip, // Direct to host
                        to: vId,
                        length: 60,
                        color: { color: '#e2e8f0' }
                    });
                });
            });
        });

        const container = document.getElementById('mynetwork');
        const data = {
            nodes: new vis.DataSet(nodesData),
            edges: new vis.DataSet(edgesData)
        };
        const options = {
            layout: { improvedLayout: false },
            physics: {
                enabled: false,
                solver: 'barnesHut',
                barnesHut: { gravitationalConstant: -2000, centralGravity: 0.3, springLength: 150, springConstant: 0.04, damping: 0.09 },
                stabilization: false
            },
            interaction: { hover: true, hideEdgesOnDrag: true }
        };

        network = new vis.Network(container, data, options);
        window.networkNodes = data.nodes;
        window.networkEdges = data.edges;

        // Instantly hide loader
        document.getElementById('progressBar').style.width = '100%';
        setTimeout(() => {
            document.getElementById('loader').style.opacity = '0';
            setTimeout(() => document.getElementById('loader').style.display = 'none', 300);
        }, 100);
        
        physicsEnabled = false;
        document.getElementById('btn-physics').classList.remove('active');

        network.on("click", (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                if (nodeId !== 'root') {
                    // Find and open in list
                    switchTab('hosts');
                    document.getElementById('searchBox').value = nodeId;
                    renderLists();
                    const item = document.querySelector('.list-item');
                    if(item && !item.classList.contains('open')) {
                        item.classList.add('open');
                    }
                }
            }
        });
    }

    function focusNode(id) {
        if(network) {
            network.focus(id, { scale: 1.5, animation: true });
            network.selectNodes([id]);
        }
    }

    function togglePhysics() {
        physicsEnabled = !physicsEnabled;
        network.setOptions({ physics: physicsEnabled });
        document.getElementById('btn-physics').classList.toggle('active', physicsEnabled);
    }
    
    let showPorts = false;
    let showVulns = false;
    
    let portsInjected = false;
    let vulnsInjected = false;
    
    function enablePhysicsForInjection() {
        if(!physicsEnabled) {
            network.setOptions({ physics: true });
            physicsEnabled = true;
            document.getElementById('btn-physics').classList.add('active');
        }
    }

    function togglePorts() {
        if(!network || !window.networkNodes) return;
        showPorts = !showPorts;
        
        if (showPorts && !portsInjected) {
            window.networkNodes.add(window.lazyPortNodes);
            window.networkEdges.add(window.lazyPortEdges);
            portsInjected = true;
            enablePhysicsForInjection();
        } else if (portsInjected) {
            const updates = window.lazyPortNodes.map(n => ({ id: n.id, hidden: !showPorts }));
            window.networkNodes.update(updates);
        }
        
        document.getElementById('btn-ports').classList.toggle('active', showPorts);
    }
    
    function toggleVulns() {
        if(!network || !window.networkNodes) return;
        showVulns = !showVulns;
        
        if (showVulns && !vulnsInjected) {
            window.networkNodes.add(window.lazyVulnNodes);
            window.networkEdges.add(window.lazyVulnEdges);
            vulnsInjected = true;
            enablePhysicsForInjection();
        } else if (vulnsInjected) {
            const updates = window.lazyVulnNodes.map(n => ({ id: n.id, hidden: !showVulns }));
            window.networkNodes.update(updates);
        }
        
        document.getElementById('btn-vulns').classList.toggle('active', showVulns);
    }

    window.reportVulns = vulns;

    function toggleVulnDetails(el, vulnId) {
        const contentDiv = el.nextElementSibling;
        if(contentDiv.style.display === 'block') {
            contentDiv.style.display = 'none';
            return;
        }
        
        if(contentDiv.innerHTML === '') {
            const baseV = window.reportVulns[vulnId];
            if(baseV) {
                // Aggregating plugin outputs for all related vulnerabilities (to prevent data loss from deduplication)
                const relatedVulns = window.reportVulns.filter(x => x.name === baseV.name && (x.host === baseV.host || x.hostname === baseV.host || x.host === baseV.hostname));
                const outputs = [...new Set(relatedVulns.map(x => x.pluginOutput).filter(Boolean))];

                let html = '';
                if(baseV.description) html += '<div style="margin-bottom:8px;"><strong>Description</strong><br>' + escapeHtml(baseV.description) + '</div>';
                if(baseV.solution) html += '<div style="margin-bottom:8px;"><strong>Solution</strong><br>' + escapeHtml(baseV.solution) + '</div>';
                
                if(outputs.length > 0) {
                    html += '<div style="margin-bottom:8px;"><strong>Plugin Output</strong><div class="terminal-output">' + escapeHtml(outputs.join('\n\n')) + '</div></div>';
                }
                
                contentDiv.innerHTML = html || '<i>No additional details provided.</i>';
            }
        }
        contentDiv.style.display = 'block';
    }

    // Run
    renderLists();
    setTimeout(initNetwork, 100);

</script>
</body>
</html>`;
}
