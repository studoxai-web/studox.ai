(function codingWorkspaceModule() {
  const STORAGE_KEY = "studox-coding-workspace-v1";
  const CODE_LIMITS = {
    html: 12000,
    css: 12000,
    js: 8000,
    total: 30000,
  };
  const starterFiles = {
    html: `<h1>Welcome to Studox</h1>`,
    css: `body {
  font-family: Inter, system-ui, sans-serif;
  padding: 40px;
}

h1 {
  color: #101828;
}`,
    js: `// JavaScript will be used in later practice tasks.`,
  };

  const state = {
    files: { ...starterFiles },
    activeTab: "html",
    hasRun: false,
    isChecked: false,
    isCorrect: false,
    message: "",
    saveTimer: null,
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.files) state.files = { ...starterFiles, ...saved.files };
  } catch (_error) {
    // Ignore broken local drafts so the workspace always opens.
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ files: state.files }));
  }

  function normalizeCode(tab, value = "") {
    const limit = CODE_LIMITS[tab] || 8000;
    return String(value).slice(0, limit);
  }

  function totalCodeSize(files = state.files) {
    return Object.values(files).reduce((sum, value) => sum + String(value || "").length, 0);
  }

  function codeLimitMessage(tab) {
    const limit = CODE_LIMITS[tab] || 8000;
    return `${tab.toUpperCase()} code is limited to ${limit.toLocaleString()} characters for browser safety.`;
  }

  Object.keys(state.files).forEach((tab) => {
    state.files[tab] = normalizeCode(tab, state.files[tab]);
  });

  function scheduleSave() {
    window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(saveWorkspace, 350);
  }

  function h1Text() {
    const match = state.files.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    return match ? match[1].replace(/<[^>]+>/g, "").trim() : "";
  }

  function taskStatus() {
    const headingText = h1Text();
    return {
      hasHeading: /<h1[\s>]/i.test(state.files.html),
      hasText: headingText.length >= 3,
      hasRun: state.hasRun,
    };
  }

  function renderStep(label, done) {
    return `<li class="${done ? "done" : ""}"><span>${done ? "✓" : ""}</span>${label}</li>`;
  }

  function render() {
    const status = taskStatus();
    const totalSize = totalCodeSize();
    return `<section class="coding-lab" data-coding-workspace>
      <div class="coding-topbar">
        <div class="coding-brand"><span>&lt;/&gt;</span><div><h1>CODING WORKSPACE</h1><small>Live Practice</small></div></div>
        <div class="coding-progress"><strong>Topic 1</strong><span>HTML Practice</span><i><b style="width:${state.isCorrect ? 100 : state.hasRun ? 70 : 35}%"></b></i></div>
        <a class="coding-back" href="#journey">Back to Lesson</a>
      </div>

      <div class="coding-breadcrumb">Roadmap <span>›</span> Web Development <span>›</span> HTML & CSS <span>›</span> Add a Heading</div>

      <div class="coding-workspace-grid">
        <aside class="coding-task-card">
          <div class="coding-panel-label"><span>Your Task</span><b>01</b></div>
          <h2>Add a Heading</h2>
          <p>Write an HTML heading and see it appear in the preview.</p>
          <ul class="coding-task-steps">
            ${renderStep("Create an h1 element", status.hasHeading)}
            ${renderStep("Add meaningful text", status.hasText)}
            ${renderStep("Run the preview", status.hasRun)}
          </ul>
          <div class="coding-help-box"><div><strong>Need help?</strong><p>Use a hint if you are stuck.</p></div><button type="button" data-coding-action="hint">Hint</button></div>
          <button class="coding-check-btn" type="button" data-coding-action="check">Check Answer</button>
          <div class="coding-feedback ${state.isChecked ? state.isCorrect ? "success" : "error" : ""}" data-coding-feedback>${state.message ? escapeHtml(state.message) : "Complete the task, run the preview, then check your answer."}</div>
          <small class="coding-safety-note">Code stays in this browser and is capped at ${CODE_LIMITS.total.toLocaleString()} total characters.</small>
        </aside>

        <main class="coding-editor-card">
          <div class="coding-tabs">
            ${["html", "css", "js"].map((tab) => `<button class="${state.activeTab === tab ? "active" : ""}" type="button" data-coding-tab="${tab}">${tab.toUpperCase()}</button>`).join("")}
            <button type="button" data-coding-action="format">{} Format</button>
          </div>
          <div class="coding-editor-wrap">
            <div class="coding-line-numbers">${Array.from({ length: 8 }, (_, index) => `<span>${index + 1}</span>`).join("")}</div>
            ${["html", "css", "js"].map((tab) => `<textarea class="${state.activeTab === tab ? "active" : ""}" spellcheck="false" data-code-editor="${tab}" aria-label="${tab} editor">${escapeHtml(state.files[tab])}</textarea>`).join("")}
          </div>
          <div class="coding-editor-actions">
            <button type="button" data-coding-action="reset">Reset</button>
            <button type="button" data-coding-action="clear">Clear</button>
            <button class="primary" type="button" data-coding-action="run">Run Code</button>
          </div>
          <div class="coding-tip"><strong>Tip:</strong> The <code>&lt;h1&gt;</code> tag is used for the main heading of your page. <span>${totalSize.toLocaleString()}/${CODE_LIMITS.total.toLocaleString()} chars</span></div>
        </main>

        <aside class="coding-preview-column">
          <section class="coding-preview-card">
            <div class="coding-preview-head"><div><i></i><span>Live Preview</span></div><button type="button" data-coding-action="refresh">↻</button></div>
            <div class="coding-browser"><div class="coding-browser-bar"><span></span><span></span><span></span><b>preview.studox.ai</b></div><iframe data-coding-preview title="Live preview" sandbox="allow-scripts"></iframe></div>
          </section>
          ${state.isChecked && state.isCorrect ? `<section class="coding-success-card"><span>✓</span><div><strong>Great! Your heading is visible.</strong><p>Nice work. You successfully added a heading to your page.</p></div></section>` : `<section class="coding-empty-result"><strong>Result appears after checking.</strong><p>The success card will unlock only when the answer is correct.</p></section>`}
        </aside>
      </div>
    </section>`;
  }

  function buildPreviewDocument() {
    const csp = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    return `<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${state.files.css}</style></head><body>${state.files.html}<script>${state.files.js}<\/script></body></html>`;
  }

  function updatePreview(countRun = false) {
    const frame = document.querySelector("[data-coding-preview]");
    if (!frame) return;
    if (totalCodeSize() > CODE_LIMITS.total) {
      state.message = `Code is too large. Keep the total under ${CODE_LIMITS.total.toLocaleString()} characters.`;
      state.isChecked = false;
      return;
    }
    frame.srcdoc = buildPreviewDocument();
    if (countRun) state.hasRun = true;
    scheduleSave();
  }

  function rerender() {
    const root = document.querySelector("[data-coding-workspace]");
    if (!root) return;
    root.outerHTML = render();
    bind();
  }

  function checkAnswer() {
    const status = taskStatus();
    state.isChecked = true;
    state.isCorrect = status.hasHeading && status.hasText && status.hasRun;
    if (state.isCorrect) {
      state.message = "Correct. Your heading exists, has meaningful text, and the preview was run.";
    } else if (!status.hasHeading) {
      state.message = "Add one h1 heading first.";
    } else if (!status.hasText) {
      state.message = "Your h1 needs meaningful text.";
    } else {
      state.message = "Run the preview once before checking.";
    }
    rerender();
  }

  function bind() {
    const root = document.querySelector("[data-coding-workspace]");
    if (!root) return;
    root.querySelectorAll("[data-code-editor]").forEach((editor) => {
      editor.addEventListener("input", () => {
        const tab = editor.dataset.codeEditor;
        const normalized = normalizeCode(tab, editor.value);
        if (normalized !== editor.value) {
          editor.value = normalized;
          state.message = codeLimitMessage(tab);
        }
        state.files[tab] = normalized;
        state.isChecked = false;
        state.isCorrect = false;
        if (totalCodeSize() > CODE_LIMITS.total) {
          state.message = `Code is too large. Keep the total under ${CODE_LIMITS.total.toLocaleString()} characters.`;
        }
        updatePreview();
      });
    });
    root.querySelectorAll("[data-coding-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeTab = button.dataset.codingTab;
        rerender();
      });
    });
    root.addEventListener("click", (event) => {
      const action = event.target.closest("[data-coding-action]")?.dataset.codingAction;
      if (!action) return;
      if (action === "run" || action === "refresh") {
        updatePreview(action === "run");
        rerender();
      }
      if (action === "check") checkAnswer();
      if (action === "hint") {
        state.message = "Hint: write something like <h1>Welcome to Studox</h1> in the HTML tab.";
        state.isChecked = false;
        rerender();
      }
      if (action === "reset") {
        state.files = { ...starterFiles };
        state.hasRun = false;
        state.isChecked = false;
        state.isCorrect = false;
        state.message = "";
        rerender();
      }
      if (action === "clear") {
        state.files[state.activeTab] = "";
        state.isChecked = false;
        state.isCorrect = false;
        state.message = "";
        rerender();
      }
      if (action === "format") {
        state.message = "Formatting helper will be connected later. For now, keep your HTML clean and readable.";
        state.isChecked = false;
        rerender();
      }
    });
    updatePreview();
  }

  window.StudoxCodingWorkspace = { render, bind };
})();
