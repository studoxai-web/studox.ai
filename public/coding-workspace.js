(function codingWorkspaceModule() {
  const STORAGE_KEY = "studox-coding-workspace-v1";
  const starterFiles = {
    "index.html": `<main class="learning-card">
  <span class="eyebrow">My first webpage</span>
  <h1>Hello, web developer!</h1>
  <p>I am learning how HTML, CSS and JavaScript work together.</p>
  <button id="welcomeButton">Try the interaction</button>
</main>`,
    "style.css": `* { box-sizing: border-box; }

body {
  min-height: 100vh;
  display: grid;
  place-items: center;
  margin: 0;
  font-family: Inter, system-ui, sans-serif;
  color: #eaf0ff;
  background: linear-gradient(135deg, #081225, #171044);
}

.learning-card {
  width: min(520px, 90vw);
  padding: 42px;
  border: 1px solid rgba(255,255,255,.16);
  border-radius: 24px;
  background: rgba(255,255,255,.08);
  box-shadow: 0 24px 70px rgba(0,0,0,.35);
  text-align: center;
}

.eyebrow { color: #8d7cff; }
button {
  padding: 12px 18px;
  color: white;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(90deg, #3478ff, #7c5cff);
  cursor: pointer;
}`,
    "script.js": `const button = document.querySelector("#welcomeButton");

button.addEventListener("click", () => {
  button.textContent = "You connected JavaScript! 🚀";
  console.log("Great work — the click event ran successfully.");
});`,
  };

  const languageByFile = {
    "index.html": "html",
    "style.css": "css",
    "script.js": "javascript",
  };

  const state = {
    files: { ...starterFiles },
    activeFile: "index.html",
    device: "desktop",
    bottomTab: "problems",
    learnedConcepts: new Set(["HTML structure"]),
    hintsUsed: 0,
    mistakesFixed: 0,
    runs: 0,
    editors: {},
    saveTimer: null,
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.files) state.files = { ...starterFiles, ...saved.files };
    if (saved?.activeFile && state.files[saved.activeFile]) state.activeFile = saved.activeFile;
    if (Array.isArray(saved?.learnedConcepts)) state.learnedConcepts = new Set(saved.learnedConcepts);
    state.hintsUsed = Number(saved?.hintsUsed || 0);
    state.mistakesFixed = Number(saved?.mistakesFixed || 0);
    state.runs = Number(saved?.runs || 0);
  } catch (_error) {
    // A corrupt local draft should never block the learner.
  }

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function saveWorkspace() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      files: state.files,
      activeFile: state.activeFile,
      learnedConcepts: [...state.learnedConcepts],
      hintsUsed: state.hintsUsed,
      mistakesFixed: state.mistakesFixed,
      runs: state.runs,
    }));
    const status = document.querySelector("[data-coding-save-status]");
    if (status) status.textContent = "Saved";
  }

  function scheduleSave() {
    const status = document.querySelector("[data-coding-save-status]");
    if (status) status.textContent = "Saving…";
    window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(saveWorkspace, 450);
  }

  function iconForFile(file) {
    if (file.endsWith(".html")) return '<span class="file-icon html">5</span>';
    if (file.endsWith(".css")) return '<span class="file-icon css">#</span>';
    return '<span class="file-icon js">JS</span>';
  }

  function render() {
    return `<section class="coding-lab" data-coding-workspace>
      <header class="coding-lab-head">
        <div><span class="coding-lab-orb">&lt;/&gt;</span><div><small>BEGINNER LEARNING WORKSPACE</small><h1>Coding Session</h1></div><span class="coding-live"><i></i> Auto save</span></div>
        <div class="coding-head-actions"><button type="button" data-coding-action="explain-file">Explain file</button><button type="button" data-coding-action="find-bug">Find bug</button><button class="primary" type="button" data-coding-action="run">Run project ▶</button></div>
      </header>
      <div class="coding-topic-strip"><div><small>CURRENT LESSON</small><strong>Build your first interactive webpage</strong></div><div class="coding-lesson-progress"><span>Lesson progress</span><div><i style="width:38%"></i></div><b>38%</b></div><span class="coding-xp">⚡ +120 XP available</span></div>
      <div class="coding-workspace-grid">
        <aside class="coding-explorer">
          <div class="coding-panel-label"><span>EXPLORER</span><button type="button" title="Starter project">•••</button></div>
          <div class="coding-project-name">⌄ FIRST-WEBPAGE</div>
          <div class="coding-file-list">${Object.keys(state.files).map((file) => `<button class="${file === state.activeFile ? "active" : ""}" type="button" data-coding-file="${file}">${iconForFile(file)}<span>${file}</span><i></i></button>`).join("")}</div>
          <div class="coding-side-section">
            <div class="coding-panel-label"><span>PROJECT PROGRESS</span><b>${state.learnedConcepts.size}/8</b></div>
            <div class="coding-mini-progress"><i style="width:${Math.min(100, state.learnedConcepts.size * 12.5)}%"></i></div>
            <ul><li><span>Code executed</span><b data-coding-runs>${state.runs}</b></li><li><span>Concepts learned</span><b data-coding-concepts>${state.learnedConcepts.size}</b></li><li><span>Mistakes fixed</span><b data-coding-fixed>${state.mistakesFixed}</b></li><li><span>Hints used</span><b data-coding-hints>${state.hintsUsed}</b></li></ul>
          </div>
          <div class="coding-current-task"><small>CURRENT TASK</small><strong>Add a clear page heading</strong><p>Use one semantic <code>&lt;h1&gt;</code> inside the main content.</p><span>1 of 4 tasks</span></div>
        </aside>
        <main class="coding-editor-area">
          <div class="coding-tabs">${Object.keys(state.files).map((file) => `<button class="${file === state.activeFile ? "active" : ""}" type="button" data-coding-file="${file}">${iconForFile(file)} ${file}<i data-unsaved="${file}"></i></button>`).join("")}<span data-coding-save-status>Saved</span></div>
          <div class="coding-toolbar"><div><button type="button" data-coding-action="undo" title="Undo">↶</button><button type="button" data-coding-action="redo" title="Redo">↷</button><button type="button" data-coding-action="format" title="Format document">Format</button></div><div><span>${languageByFile[state.activeFile]}</span><b>Spaces: 2</b></div></div>
          <div class="coding-editor-stack">${Object.keys(state.files).map((file) => `<div class="coding-editor-host ${file === state.activeFile ? "active" : ""}" data-editor-host="${file}"><textarea spellcheck="false" data-code-editor="${file}" aria-label="${file} code editor">${escapeHtml(state.files[file])}</textarea></div>`).join("")}</div>
          <div class="coding-mentor-hint" data-coding-hint><span>💡</span><div><small>AI LEARNING HINT</small><strong>Your page already has a semantic heading.</strong><p>Try changing its text and watch the preview update instantly.</p></div><div><button type="button" data-coding-action="explain-hint">Explain</button><button type="button" data-coding-action="dismiss-hint">Got it</button></div></div>
          <section class="coding-bottom-panel">
            <div class="coding-bottom-tabs">${["problems", "console", "suggestions", "output"].map((tab) => `<button class="${tab === state.bottomTab ? "active" : ""}" type="button" data-bottom-tab="${tab}">${tab === "suggestions" ? "AI Suggestions" : tab[0].toUpperCase() + tab.slice(1)}<span data-${tab}-count></span></button>`).join("")}</div>
            <div class="coding-bottom-content" data-bottom-content></div>
          </section>
        </main>
        <aside class="coding-preview-area">
          <div class="coding-preview-head"><div><i></i><span>LIVE PREVIEW</span></div><div class="coding-device-switch"><button class="active" type="button" data-device="desktop">Desktop</button><button type="button" data-device="tablet">Tablet</button><button type="button" data-device="mobile">Mobile</button></div><button type="button" data-coding-action="refresh" title="Refresh preview">↻</button></div>
          <div class="coding-preview-stage"><div class="coding-browser ${state.device}" data-preview-frame-wrap><div class="coding-browser-bar"><span></span><span></span><span></span><b>studox.local/preview</b></div><iframe data-coding-preview title="Live project preview" sandbox="allow-scripts"></iframe></div></div>
          <div class="coding-learning-inspector">
            <div class="coding-inspector-tabs"><button class="active" type="button" data-inspector="concept">Concept</button><button type="button" data-inspector="dom">DOM Tree</button><button type="button" data-inspector="review">AI Review</button></div>
            <div data-inspector-content></div>
          </div>
        </aside>
      </div>
    </section>`;
  }

  function buildPreviewDocument() {
    const bridge = `<script>
      const send=(type,value)=>parent.postMessage({source:"studox-preview",type,value},"*");
      ["log","warn","error"].forEach(type=>{const original=console[type];console[type]=(...args)=>{send(type,args.map(String).join(" "));original(...args);};});
      window.onerror=(message)=>send("error",String(message));
    <\/script>`;
    return `<!doctype html><html><head><meta charset="UTF-8"><style>${state.files["style.css"]}</style></head><body>${state.files["index.html"]}${bridge}<script>${state.files["script.js"]}<\/script></body></html>`;
  }

  function updatePreview(countRun = false) {
    const frame = document.querySelector("[data-coding-preview]");
    if (!frame) return;
    frame.srcdoc = buildPreviewDocument();
    if (countRun) {
      state.runs += 1;
      document.querySelector("[data-coding-runs]")?.replaceChildren(String(state.runs));
      scheduleSave();
    }
    updateLearningSignals();
  }

  function detectConcepts() {
    const html = state.files["index.html"];
    const css = state.files["style.css"];
    const js = state.files["script.js"];
    const concepts = [];
    if (/<h1[\s>]/i.test(html)) concepts.push(["Heading Tag", "Defines the main heading and gives the page a clear content hierarchy."]);
    if (/<button[\s>]/i.test(html)) concepts.push(["Button Element", "Creates an accessible interactive control for a user action."]);
    if (/<(main|header|nav|section|article)[\s>]/i.test(html)) concepts.push(["Semantic HTML", "Describes the purpose of content to browsers and assistive technology."]);
    if (/display\s*:\s*(flex|grid)/i.test(css)) concepts.push(["Modern Layout", "Flexbox or Grid controls how child elements are arranged and aligned."]);
    if (/linear-gradient|radial-gradient/i.test(css)) concepts.push(["CSS Gradient", "Blends multiple colors without requiring an image asset."]);
    if (/addEventListener/i.test(js)) concepts.push(["Event Listener", "Waits for a user or browser event and then runs a function."]);
    if (/\b(const|let)\s+\w+/i.test(js)) concepts.push(["JavaScript Variable", "Stores a value or reference so the program can use it later."]);
    concepts.forEach(([name]) => state.learnedConcepts.add(name));
    return concepts;
  }

  function analyzeProblems() {
    const html = state.files["index.html"];
    const issues = [];
    if (/<img\b(?![^>]*\balt=)[^>]*>/i.test(html)) issues.push({ type: "Accessibility", text: "Image is missing alt text.", hint: "Describe the image for learners using screen readers." });
    if (!/<h1[\s>]/i.test(html)) issues.push({ type: "Structure", text: "The page has no main heading.", hint: "Add one <h1> that describes the page." });
    const openingButtons = (html.match(/<button\b/gi) || []).length;
    const closingButtons = (html.match(/<\/button>/gi) || []).length;
    if (openingButtons !== closingButtons) issues.push({ type: "HTML", text: "A button tag is not closed.", hint: "Every <button> needs a matching </button>." });
    if (/onclick\s*=/i.test(html)) issues.push({ type: "Good practice", text: "Inline onclick handler detected.", hint: "Keep behaviour in script.js with addEventListener." });
    return issues;
  }

  function domTreeHtml() {
    const parsed = new DOMParser().parseFromString(state.files["index.html"], "text/html");
    function nodeHtml(node, depth = 0) {
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      const children = [...node.children].map((child) => nodeHtml(child, depth + 1)).join("");
      return `<li style="--depth:${depth}"><span>&lt;${node.tagName.toLowerCase()}&gt;</span>${children ? `<ul>${children}</ul>` : ""}</li>`;
    }
    return `<div class="coding-dom-tree"><p>Live hierarchy from index.html</p><ul>${nodeHtml(parsed.body)}</ul></div>`;
  }

  function updateInspector(tab = document.querySelector(".coding-inspector-tabs .active")?.dataset.inspector || "concept") {
    const target = document.querySelector("[data-inspector-content]");
    if (!target) return;
    const concepts = detectConcepts();
    if (tab === "dom") {
      target.innerHTML = domTreeHtml();
    } else if (tab === "review") {
      const issues = analyzeProblems();
      target.innerHTML = `<div class="coding-review"><strong>${issues.length ? `${issues.length} improvement${issues.length > 1 ? "s" : ""} found` : "Excellent foundation"}</strong><p>${issues.length ? "Use the guided hints to improve semantics and accessibility." : "Your current project follows the lesson’s core practices."}</p><div><span>✓ Semantic structure</span><span>✓ Separate CSS</span><span>✓ Event-based JavaScript</span></div></div>`;
    } else {
      const latest = concepts.at(-1) || ["Start coding", "Add an HTML element and its concept will appear here."];
      target.innerHTML = `<article class="coding-concept-card"><span>NEW CONCEPT DETECTED</span><strong>${escapeHtml(latest[0])}</strong><p>${escapeHtml(latest[1])}</p><button type="button" data-coding-action="learn-more">Learn more →</button></article>`;
    }
    document.querySelector("[data-coding-concepts]")?.replaceChildren(String(state.learnedConcepts.size));
  }

  function updateBottomPanel() {
    const target = document.querySelector("[data-bottom-content]");
    if (!target) return;
    const problems = analyzeProblems();
    document.querySelector("[data-problems-count]")?.replaceChildren(problems.length ? String(problems.length) : "");
    if (state.bottomTab === "problems") {
      target.innerHTML = problems.length ? problems.map((issue) => `<div class="coding-problem"><span>!</span><div><strong>${escapeHtml(issue.type)} · ${escapeHtml(issue.text)}</strong><p>💡 ${escapeHtml(issue.hint)}</p></div></div>`).join("") : `<div class="coding-panel-success">✓ No problems found. Your project is ready to run.</div>`;
    } else if (state.bottomTab === "suggestions") {
      target.innerHTML = `<div class="coding-suggestion-grid"><button type="button" data-coding-action="tool-explain">Explain this line</button><button type="button" data-coding-action="tool-summary">Summarize code</button><button type="button" data-coding-action="find-bug">Find bug</button><button type="button" data-coding-action="tool-notes">Generate notes</button></div>`;
    } else if (state.bottomTab === "console") {
      target.innerHTML = `<div class="coding-console" data-coding-console><span>Console ready. Run or interact with the preview.</span></div>`;
    } else {
      target.innerHTML = `<div class="coding-output-log"><span>Workspace initialized</span><span>Preview compiled successfully</span><span>Auto-save connected</span></div>`;
    }
  }

  function updateLearningSignals() {
    detectConcepts();
    updateInspector();
    updateBottomPanel();
    document.querySelector("[data-coding-concepts]")?.replaceChildren(String(state.learnedConcepts.size));
    scheduleSave();
  }

  function showHint(title, copy) {
    const hint = document.querySelector("[data-coding-hint]");
    if (!hint) return;
    hint.classList.remove("hidden");
    hint.querySelector("strong").textContent = title;
    hint.querySelector("p").textContent = copy;
  }

  function syncEditor(file, value) {
    state.files[file] = value;
    document.querySelector(`[data-unsaved="${file}"]`)?.classList.add("visible");
    updatePreview();
  }

  function switchFile(file) {
    if (!state.files[file]) return;
    state.activeFile = file;
    document.querySelectorAll("[data-coding-file]").forEach((button) => button.classList.toggle("active", button.dataset.codingFile === file));
    document.querySelectorAll("[data-editor-host]").forEach((host) => host.classList.toggle("active", host.dataset.editorHost === file));
    document.querySelector(".coding-toolbar > div:last-child span")?.replaceChildren(languageByFile[file]);
    state.editors[file]?.layout?.();
    saveWorkspace();
  }

  function loadMonaco() {
    if (window.monaco?.editor) return initializeMonaco();
    if (document.querySelector("[data-monaco-loader]")) return;
    const loader = document.createElement("script");
    loader.src = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js";
    loader.dataset.monacoLoader = "true";
    loader.onload = () => {
      window.require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs" } });
      window.require(["vs/editor/editor.main"], initializeMonaco);
    };
    document.head.appendChild(loader);
  }

  function initializeMonaco() {
    if (!window.monaco?.editor || !document.querySelector("[data-coding-workspace]")) return;
    Object.keys(state.files).forEach((file) => {
      if (state.editors[file]) return;
      const host = document.querySelector(`[data-editor-host="${file}"]`);
      const fallback = host?.querySelector("textarea");
      if (!host || !fallback) return;
      fallback.hidden = true;
      const editor = window.monaco.editor.create(host, {
        value: state.files[file],
        language: languageByFile[file],
        theme: "vs-dark",
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineHeight: 23,
        padding: { top: 18 },
        roundedSelection: true,
        scrollBeyondLastLine: false,
        formatOnPaste: true,
        tabSize: 2,
      });
      editor.onDidChangeModelContent(() => syncEditor(file, editor.getValue()));
      state.editors[file] = editor;
    });
  }

  function bind() {
    const root = document.querySelector("[data-coding-workspace]");
    if (!root) return;
    Object.values(state.editors).forEach((editor) => editor.dispose?.());
    state.editors = {};
    root.querySelectorAll("[data-coding-file]").forEach((button) => button.addEventListener("click", () => switchFile(button.dataset.codingFile)));
    root.querySelectorAll("[data-code-editor]").forEach((editor) => editor.addEventListener("input", () => syncEditor(editor.dataset.codeEditor, editor.value)));
    root.querySelectorAll("[data-device]").forEach((button) => button.addEventListener("click", () => {
      state.device = button.dataset.device;
      root.querySelectorAll("[data-device]").forEach((item) => item.classList.toggle("active", item === button));
      const frame = root.querySelector("[data-preview-frame-wrap]");
      frame.className = `coding-browser ${state.device}`;
    }));
    root.querySelectorAll("[data-bottom-tab]").forEach((button) => button.addEventListener("click", () => {
      state.bottomTab = button.dataset.bottomTab;
      root.querySelectorAll("[data-bottom-tab]").forEach((item) => item.classList.toggle("active", item === button));
      updateBottomPanel();
    }));
    root.querySelectorAll("[data-inspector]").forEach((button) => button.addEventListener("click", () => {
      root.querySelectorAll("[data-inspector]").forEach((item) => item.classList.toggle("active", item === button));
      updateInspector(button.dataset.inspector);
    }));
    root.addEventListener("click", (event) => {
      const action = event.target.closest("[data-coding-action]")?.dataset.codingAction;
      if (!action) return;
      if (action === "run" || action === "refresh") updatePreview(action === "run");
      if (action === "dismiss-hint") event.target.closest("[data-coding-hint]")?.classList.add("hidden");
      if (action === "explain-hint" || action === "explain-file" || action === "tool-explain") {
        state.hintsUsed += 1;
        document.querySelector("[data-coding-hints]")?.replaceChildren(String(state.hintsUsed));
        showHint("How these files work together", "HTML creates content, CSS presents it, and JavaScript responds to user actions. The preview combines all three safely.");
      }
      if (action === "find-bug") {
        const issue = analyzeProblems()[0];
        showHint(issue ? issue.text : "No blocking bug found", issue ? issue.hint : "Try changing one element at a time and use the preview to confirm its behaviour.");
      }
      if (action === "format") {
        const editor = state.editors[state.activeFile];
        editor?.getAction?.("editor.action.formatDocument")?.run();
        showHint("Document formatted", "Consistent indentation makes nested structure easier to understand.");
      }
      if (action === "undo") state.editors[state.activeFile]?.trigger?.("toolbar", "undo");
      if (action === "redo") state.editors[state.activeFile]?.trigger?.("toolbar", "redo");
      if (["tool-summary", "tool-notes", "learn-more"].includes(action)) showHint("Learning note ready", "Focus on the relationship between structure, presentation and behaviour. Make one small change, predict the result, then run it.");
    });
    window.addEventListener("message", (event) => {
      if (event.data?.source !== "studox-preview") return;
      const consoleNode = document.querySelector("[data-coding-console]");
      if (consoleNode) consoleNode.insertAdjacentHTML("beforeend", `<span class="${escapeHtml(event.data.type)}">${escapeHtml(event.data.value)}</span>`);
    });
    updatePreview();
    updateBottomPanel();
    updateInspector();
    loadMonaco();
  }

  window.StudoxCodingWorkspace = { render, bind };
})();
