const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const esbuild = require('esbuild');
const JSZip = require('jszip');
const vm = require('vm');

async function buildDb2k003() {
  console.log('=== Building DEBOOGER2000 — DB2K-003 ===');

  // 1. Bundle react-router-dom and @tanstack/react-query for offline inclusion
  console.log('Bundling react-router-dom...');
  const rrBuild = await esbuild.build({
    entryPoints: ['react-router-dom'],
    bundle: true,
    format: 'esm',
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    minify: true,
    write: false
  });
  const rrGzipB64 = zlib.gzipSync(Buffer.from(rrBuild.outputFiles[0].text)).toString('base64');
  console.log('react-router-dom bundle gzipped base64 length:', rrGzipB64.length);

  console.log('Bundling @tanstack/react-query...');
  const tqBuild = await esbuild.build({
    entryPoints: ['@tanstack/react-query'],
    bundle: true,
    format: 'esm',
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    minify: true,
    write: false
  });
  const tqGzipB64 = zlib.gzipSync(Buffer.from(tqBuild.outputFiles[0].text)).toString('base64');
  console.log('@tanstack/react-query bundle gzipped base64 length:', tqGzipB64.length);

  // 2. Read DB2K-002 as base
  const srcPath = path.resolve(__dirname, '../public/DB2K-002.html');
  let content = fs.readFileSync(srcPath, 'utf-8');

  // 3. Update version markings to DB2K-003
  content = content.replace(/DB2K-002/g, 'DB2K-003');
  content = content.replace(/Build DB2K-002/g, 'Build DB2K-003');
  content = content.replace(
    "window.D2_ENGINE_VERSION = 'DB2K-003';",
    "window.D2_ENGINE_VERSION = 'DB2K-003'; window.D2_STORAGE_SCOPE = D2_STORAGE_SCOPE;"
  );

  // 4. Inject GZIP base64 constants for react-router-dom and @tanstack/react-query
  const extraLibs = `
    const D2_EMBEDDED_REACT_ROUTER_GZIP_B64 = "${rrGzipB64}";
    const D2_EMBEDDED_REACT_QUERY_GZIP_B64 = "${tqGzipB64}";
    let D2_REACT_ROUTER_SOURCE_PROMISE = null;
    let D2_REACT_QUERY_SOURCE_PROMISE = null;

    async function d2LoadEmbeddedReactRouter() {
      if (D2_REACT_ROUTER_SOURCE_PROMISE) return D2_REACT_ROUTER_SOURCE_PROMISE;
      D2_REACT_ROUTER_SOURCE_PROMISE = d2GunzipBase64Text(D2_EMBEDDED_REACT_ROUTER_GZIP_B64);
      return D2_REACT_ROUTER_SOURCE_PROMISE;
    }

    async function d2LoadEmbeddedReactQuery() {
      if (D2_REACT_QUERY_SOURCE_PROMISE) return D2_REACT_QUERY_SOURCE_PROMISE;
      D2_REACT_QUERY_SOURCE_PROMISE = d2GunzipBase64Text(D2_EMBEDDED_REACT_QUERY_GZIP_B64);
      return D2_REACT_QUERY_SOURCE_PROMISE;
    }
  `;

  content = content.replace(
    /const D2_EMBEDDED_TYPESCRIPT_GZIP_B64\s*=/,
    extraLibs + '\n    const D2_EMBEDDED_TYPESCRIPT_GZIP_B64 ='
  );

  // 5. Update d2CoreReactImportMap to load react-router and react-query offline asynchronously
  const oldCoreMap = `function d2CoreReactImportMap(pkg) {
      const npmImports = {
        'react': d2ModuleDataUrl(D2_REACT_ESM_SOURCE),
        'react/jsx-runtime': d2ModuleDataUrl(D2_JSX_ESM_SOURCE),
        'react/jsx-dev-runtime': d2ModuleDataUrl(D2_JSX_DEV_ESM_SOURCE),
        'react-dom': d2ModuleDataUrl(D2_REACT_DOM_ESM_SOURCE),
        'react-dom/client': d2ModuleDataUrl(D2_REACT_DOM_CLIENT_ESM_SOURCE),
        'scheduler': d2ModuleDataUrl(D2_SCHEDULER_ESM_SOURCE),
        'lucide-react': d2ModuleDataUrl(D2_LUCIDE_ESM_SOURCE),
        'clsx': d2ModuleDataUrl(D2_CLSX_ESM_SOURCE),
        'tailwind-merge': d2ModuleDataUrl(D2_TAILWIND_MERGE_ESM_SOURCE),
        'class-variance-authority': d2ModuleDataUrl(D2_CVA_ESM_SOURCE)
      };
      return npmImports;
    }`;

  const newCoreMap = `async function d2CoreReactImportMapAsync(pkg) {
      const npmImports = {
        'react': d2ModuleDataUrl(D2_REACT_ESM_SOURCE),
        'react/jsx-runtime': d2ModuleDataUrl(D2_JSX_ESM_SOURCE),
        'react/jsx-dev-runtime': d2ModuleDataUrl(D2_JSX_DEV_ESM_SOURCE),
        'react-dom': d2ModuleDataUrl(D2_REACT_DOM_ESM_SOURCE),
        'react-dom/client': d2ModuleDataUrl(D2_REACT_DOM_CLIENT_ESM_SOURCE),
        'scheduler': d2ModuleDataUrl(D2_SCHEDULER_ESM_SOURCE),
        'lucide-react': d2ModuleDataUrl(D2_LUCIDE_ESM_SOURCE),
        'clsx': d2ModuleDataUrl(D2_CLSX_ESM_SOURCE),
        'tailwind-merge': d2ModuleDataUrl(D2_TAILWIND_MERGE_ESM_SOURCE),
        'class-variance-authority': d2ModuleDataUrl(D2_CVA_ESM_SOURCE)
      };
      try {
        const rrSource = await d2LoadEmbeddedReactRouter();
        if (rrSource) {
          const rrUrl = d2ModuleDataUrl(rrSource);
          npmImports['react-router'] = rrUrl;
          npmImports['react-router-dom'] = rrUrl;
        }
      } catch (e) {
        addConsoleLog('warn', '[PACKAGES] Offline react-router-dom decompression failed: ' + e.message);
      }
      try {
        const tqSource = await d2LoadEmbeddedReactQuery();
        if (tqSource) {
          const tqUrl = d2ModuleDataUrl(tqSource);
          npmImports['@tanstack/react-query'] = tqUrl;
        }
      } catch (e) {
        addConsoleLog('warn', '[PACKAGES] Offline @tanstack/react-query decompression failed: ' + e.message);
      }
      return npmImports;
    }
    function d2CoreReactImportMap(pkg) {
      return {
        'react': d2ModuleDataUrl(D2_REACT_ESM_SOURCE),
        'react/jsx-runtime': d2ModuleDataUrl(D2_JSX_ESM_SOURCE),
        'react/jsx-dev-runtime': d2ModuleDataUrl(D2_JSX_DEV_ESM_SOURCE),
        'react-dom': d2ModuleDataUrl(D2_REACT_DOM_ESM_SOURCE),
        'react-dom/client': d2ModuleDataUrl(D2_REACT_DOM_CLIENT_ESM_SOURCE),
        'scheduler': d2ModuleDataUrl(D2_SCHEDULER_ESM_SOURCE),
        'lucide-react': d2ModuleDataUrl(D2_LUCIDE_ESM_SOURCE),
        'clsx': d2ModuleDataUrl(D2_CLSX_ESM_SOURCE),
        'tailwind-merge': d2ModuleDataUrl(D2_TAILWIND_MERGE_ESM_SOURCE),
        'class-variance-authority': d2ModuleDataUrl(D2_CVA_ESM_SOURCE)
      };
    }`;

  content = content.replace(oldCoreMap, newCoreMap);

  // 6. Update buildLiveReactPreviewHtml to use d2CoreReactImportMapAsync
  content = content.replace(
    /const npmImports = d2CoreReactImportMap\(pkg\);/,
    `const npmImports = await d2CoreReactImportMapAsync(pkg);`
  );

  // 7. Update findReactSourceEntry to synthesize a clean preview shell if index.html is missing
  content = content.replace(
    /return any \? \{ entry: any, htmlKey: htmlKey \|\| '' \} : null;/,
    `if (any) return { entry: any, htmlKey: htmlKey || '', synthesizedHtml: !htmlKey };
      return null;`
  );

  // 8. In extractHtmlShell, handle synthesized shell when htmlKey is empty
  content = content.replace(
    /function extractHtmlShell\(files, htmlKey\) \{/,
    `function extractHtmlShell(files, htmlKey) {
      if (!htmlKey || !files[htmlKey]) return '<div id="root"></div>';`
  );

  // 9. Update 6-stage structured progress in queueLiveReactPreview
  const oldStageLogs = `addConsoleLog('info','[REACT] [1/5] Detecting React entry point and package manifest...');
        const statusEl = document.getElementById('d2-preview-status');
        if (statusEl) { statusEl.hidden = false; statusEl.textContent = 'Compiling React modules with embedded engine…'; }
        addConsoleLog('info','[REACT] [2/5] Resolving import graph, aliases and dependencies...');
        addConsoleLog('info','[REACT] [3/5] Transpiling TSX/JSX modules...');
        addConsoleLog('info','[REACT] [4/5] Bundling virtual ES modules...');`;

  const newStageLogs = `const statusEl = document.getElementById('d2-preview-status');
        const setStage = (num, text) => {
          addConsoleLog('info', '[BUILD] [' + num + '/6] ' + text);
          if (statusEl) { statusEl.hidden = false; statusEl.textContent = '[' + num + '/6] ' + text; }
        };
        setStage(1, 'Project root & React entry point detected');
        setStage(2, 'Resolving dependency graph, offline shims & path aliases');
        setStage(3, 'Transpiling TypeScript/JSX modules with offline compiler');
        setStage(4, 'Bundling virtual ES module map and stylesheets');
        setStage(5, 'Validating compiled output & initializing sandbox');`;

  content = content.replace(oldStageLogs, newStageLogs);

  // In queueLiveReactPreview, after mounted:
  content = content.replace(
    /const mounted=await waitForMount;/,
    `const mounted=await waitForMount;
        if(mounted.ok){
          addConsoleLog('info','[BUILD] [6/6] Runtime mount verified: DOM rendered successfully.');
          if(statusEl){ statusEl.hidden = true; }
        }`
  );

  // 10. Update sample React project to demonstrate React Router & TanStack Query offline!
  const sampleReactV3 = `import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Search, Plus, CheckCircle, ChevronRight, BarChart3, Users, Settings, ArrowLeft } from "lucide-react";
import { clsx } from "clsx";

const queryClient = new QueryClient();

const mockLeads = [
  { id: "1", name: "Acme Cloud Corp", contact: "sarah@acme.io", deal: "$48,000", status: "Active", stage: "Proposal Sent", region: "North America" },
  { id: "2", name: "Starlight Digital", contact: "alex@starlight.co", deal: "$19,500", status: "Won", stage: "Signed Contract", region: "EMEA" },
  { id: "3", name: "Nexus BioTech", contact: "dr.chen@nexusbio.org", deal: "$112,000", status: "Active", stage: "Discovery Call", region: "APAC" },
  { id: "4", name: "Vanguard Logistics", contact: "ops@vanguardlog.com", deal: "$34,200", status: "Pending", stage: "Security Review", region: "North America" }
];

function LeadList() {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  // Using TanStack Query hook
  const { data: leads = mockLeads } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => mockLeads,
    initialData: mockLeads
  });

  const filtered = leads.filter(l => l.name.toLowerCase().includes(search.toLowerCase()) && (tab === "all" || l.status.toLowerCase() === tab));

  return (
    <div style={{ padding: "28px", maxWidth: "1200px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div style={{ background: "#ffffff", padding: "18px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "500" }}>Total Pipeline Value</div>
          <div style={{ fontSize: "24px", fontWeight: "700", color: "#0f172a", marginTop: "4px" }}>$213,700</div>
          <div style={{ fontSize: "12px", color: "#16a34a", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}><CheckCircle size={13} /> +18.4% this quarter</div>
        </div>
        <div style={{ background: "#ffffff", padding: "18px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "500" }}>Active Accounts</div>
          <div style={{ fontSize: "24px", fontWeight: "700", color: "#0f172a", marginTop: "4px" }}>14 Accounts</div>
          <div style={{ fontSize: "12px", color: "#0284c7", marginTop: "4px" }}>React Router & TanStack Query Verified</div>
        </div>
        <div style={{ background: "#ffffff", padding: "18px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "500" }}>Offline Build Engine</div>
          <div style={{ fontSize: "24px", fontWeight: "700", color: "#059669", marginTop: "4px" }}>DB2K-003</div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>Single-File Standalone Bundle</div>
        </div>
      </div>

      <div style={{ background: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            {["all", "active", "won", "pending"].map(k => (
              <button key={k} onClick={() => setTab(k)} style={{ border: "none", background: tab === k ? "#e0f2fe" : "transparent", color: tab === k ? "#0369a1" : "#64748b", padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: tab === k ? "600" : "500", cursor: "pointer", textTransform: "capitalize" }}>{k} Leads</button>
            ))}
          </div>
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>Showing {filtered.length} leads</span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                <th style={{ padding: "12px 20px", fontWeight: "600" }}>Company</th>
                <th style={{ padding: "12px 20px", fontWeight: "600" }}>Contact</th>
                <th style={{ padding: "12px 20px", fontWeight: "600" }}>Deal Value</th>
                <th style={{ padding: "12px 20px", fontWeight: "600" }}>Pipeline Stage</th>
                <th style={{ padding: "12px 20px", fontWeight: "600" }}>Status</th>
                <th style={{ padding: "12px 20px", fontWeight: "600" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "14px 20px", fontWeight: "600", color: "#0f172a" }}>{row.name}</td>
                  <td style={{ padding: "14px 20px", color: "#64748b" }}>{row.contact}</td>
                  <td style={{ padding: "14px 20px", fontWeight: "600" }}>{row.deal}</td>
                  <td style={{ padding: "14px 20px", color: "#475569" }}>{row.stage}</td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: "12px", fontSize: "11px", fontWeight: "600", background: row.status === "Won" ? "#dcfce7" : row.status === "Active" ? "#e0f2fe" : "#fef3c7", color: row.status === "Won" ? "#15803d" : row.status === "Active" ? "#0369a1" : "#b45309" }}>{row.status}</span>
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <button onClick={() => navigate("/lead/" + row.id)} style={{ border: "1px solid #cbd5e1", background: "#fff", padding: "4px 8px", borderRadius: "5px", cursor: "pointer", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>Details <ChevronRight size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const lead = mockLeads.find(l => l.id === id) || mockLeads[0];

  return (
    <div style={{ padding: "28px", maxWidth: "800px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <button onClick={() => navigate("/")} style={{ display: "inline-flex", alignItems: "center", gap: "6px", border: "none", background: "transparent", color: "#0284c7", fontWeight: "600", fontSize: "13px", cursor: "pointer", marginBottom: "16px" }}>
        <ArrowLeft size={16} /> Back to Pipeline
      </button>
      <div style={{ background: "#ffffff", padding: "24px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: "20px", color: "#0f172a" }}>{lead.name}</h2>
        <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "18px" }}>Primary Contact: {lead.contact}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", padding: "16px", background: "#f8fafc", borderRadius: "8px" }}>
          <div><strong>Deal Value:</strong> {lead.deal}</div>
          <div><strong>Stage:</strong> {lead.stage}</div>
          <div><strong>Region:</strong> {lead.region}</div>
          <div><strong>Status:</strong> {lead.status}</div>
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>
          <nav style={{ height: "60px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#059669", color: "#fff", display: "grid", placeItems: "center", fontWeight: "700", fontSize: "14px" }}>DB</div>
              <span style={{ fontWeight: "700", fontSize: "16px", color: "#0f172a" }}>CustomerHub CRM</span>
              <span style={{ fontSize: "11px", background: "#ecfdf5", color: "#047857", padding: "2px 8px", borderRadius: "12px", fontWeight: "600" }}>DB2K-003 Engine Verified</span>
            </div>
            <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: "#64748b" }}>
              <Link to="/" style={{ color: "#059669", fontWeight: "600", textDecoration: "none" }}>Pipeline</Link>
              <Link to="/lead/1" style={{ color: "#64748b", textDecoration: "none" }}>Lead #1</Link>
            </div>
          </nav>
          <main style={{ flex: 1 }}>
            <Routes>
              <Route path="/" element={<LeadList />} />
              <Route path="/lead/:id" element={<LeadDetail />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
`;

  content = content.replace(
    /dependencies:\s*\{\s*'react':\s*'\^19\.0\.0',\s*'react-dom':\s*'\^19\.0\.0',\s*'lucide-react':\s*'\^0\.400\.0',\s*'clsx':\s*'\^2\.1\.0'\s*\}/,
    `dependencies: { 'react': '^19.0.0', 'react-dom': '^19.0.0', 'react-router-dom': '^6.26.0', '@tanstack/react-query': '^5.50.0', 'lucide-react': '^0.400.0', 'clsx': '^2.1.0' }`
  );

  content = content.replace(
    /content:\s*sampleReactCode/,
    `content: ${JSON.stringify(sampleReactV3)}`
  );

  // Write DB2K-003.html
  const outPath = path.resolve(__dirname, '../public/DB2K-003.html');
  console.log('Writing DB2K-003.html to:', outPath);
  fs.writeFileSync(outPath, content, 'utf-8');
  console.log('Successfully generated DB2K-003.html! Size:', fs.statSync(outPath).size);

  // 11. Put DB2K-003.html in DB2K-003.zip
  console.log('Creating DB2K-003.zip archive...');
  const zip = new JSZip();
  zip.file('DB2K-003.html', content);
  zip.file('README.txt', 'DEBOOGER2000 — DB2K-003\nStandalone Visual Project Viewer, Compiler, Inspector & Auditor.\nDouble-click DB2K-003.html to run locally offline in any modern web browser.\n');
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  const zipPath = path.resolve(__dirname, '../public/DB2K-003.zip');
  fs.writeFileSync(zipPath, zipBuffer);
  console.log('Successfully generated DB2K-003.zip! Size:', fs.statSync(zipPath).size);

  // 12. Syntax validation
  console.log('Validating inline scripts in DB2K-003.html...');
  const scripts = [...content.matchAll(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi)];
  scripts.forEach((s, idx) => {
    const code = s[1].trim();
    if (!code) return;
    if (content.slice(content.indexOf(s[0]), content.indexOf(s[0]) + 50).includes('importmap')) return;
    try {
      new vm.Script(code);
      console.log(`Script ${idx}: SYNTAX OK (${code.length} bytes)`);
    } catch (e) {
      console.error(`Script ${idx} SYNTAX ERROR:`, e.message);
      process.exit(1);
    }
  });

  console.log('=== DB2K-003 Build Complete ===');
}

buildDb2k003().catch(err => {
  console.error('Build error:', err);
  process.exit(1);
});
