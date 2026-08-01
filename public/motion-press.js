(function studoxMotionPressLayer() {
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReducedMotion) return;

  const PRESS_TARGETS = [
    "button",
    "a.btn",
    ".btn",
    "[role='button']",
    "[data-action]",
    "[data-coding-action]",
    ".side-link",
    ".command-card",
    ".assessment-roadmap-card",
    ".tree-module-card[role='button']",
    ".journey-topic",
    ".admin-action-chip",
    ".coding-check-btn",
  ].join(",");

  const bound = new WeakSet();
  let animateFn = null;

  function canPress(element) {
    if (!element || bound.has(element)) return false;
    if (element.matches?.("input, textarea, select, option, label")) return false;
    if (element.disabled || element.getAttribute("aria-disabled") === "true") return false;
    if (element.closest?.("[data-motion-press='off']")) return false;
    return true;
  }

  function motionAnimate(element, keyframes, options) {
    if (animateFn) {
      animateFn(element, keyframes, options);
      return;
    }
    element.animate(keyframes, {
      duration: Math.round((options.duration || 0.16) * 1000),
      easing: options.easing || "ease-out",
      fill: "forwards",
    });
  }

  function pressIn(element) {
    element.dataset.motionPressing = "true";
    motionAnimate(element, { transform: "scale(0.97)" }, { duration: 0.12, easing: "cubic-bezier(.2,.8,.2,1)" });
  }

  function pressOut(element) {
    delete element.dataset.motionPressing;
    motionAnimate(element, { transform: "scale(1)" }, { duration: 0.18, easing: "cubic-bezier(.2,.8,.2,1)" });
  }

  function bindPress(element) {
    if (!canPress(element)) return;
    bound.add(element);
    element.style.transformOrigin = element.style.transformOrigin || "center";
    element.addEventListener("pointerdown", () => pressIn(element));
    element.addEventListener("pointerup", () => pressOut(element));
    element.addEventListener("pointercancel", () => pressOut(element));
    element.addEventListener("pointerleave", () => {
      if (element.dataset.motionPressing) pressOut(element);
    });
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") pressIn(element);
    });
    element.addEventListener("keyup", (event) => {
      if (event.key === "Enter" || event.key === " ") pressOut(element);
    });
  }

  function applyPress(root = document) {
    root.querySelectorAll?.(PRESS_TARGETS).forEach(bindPress);
  }

  function animateFlashLesson(root = document, direction = "next") {
    const card = root.querySelector?.(".flash-card");
    const progress = root.querySelector?.(".flash-lesson-progress b");
    const supportingItems = root.querySelectorAll?.(".flash-example-steps > div, .flash-diagram > div, .flash-task-list > div, .flash-note-list > div, .flash-options label") || [];
    const offset = direction === "prev" ? -34 : 34;

    if (animateFn) {
      animateFn(card, { opacity: [0, 1], x: [offset, 0], scale: [0.985, 1] }, { duration: 0.34, easing: "cubic-bezier(.22,1,.36,1)" });
      if (progress) animateFn(progress, { opacity: [0.55, 1], scaleX: [0.92, 1] }, { duration: 0.3, easing: "cubic-bezier(.22,1,.36,1)" });
      supportingItems.forEach((item, index) => {
        animateFn(item, { opacity: [0, 1], y: [10, 0] }, { duration: 0.28, delay: index * 0.035, easing: "cubic-bezier(.22,1,.36,1)" });
      });
      return;
    }

    card?.animate?.(
      [{ opacity: 0, transform: `translateX(${offset}px) scale(.985)` }, { opacity: 1, transform: "translateX(0) scale(1)" }],
      { duration: 340, easing: "cubic-bezier(.22,1,.36,1)" },
    );
    progress?.animate?.(
      [{ opacity: 0.55, transform: "scaleX(.92)" }, { opacity: 1, transform: "scaleX(1)" }],
      { duration: 300, easing: "cubic-bezier(.22,1,.36,1)" },
    );
    supportingItems.forEach((item, index) => {
      item.animate?.(
        [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 280, delay: index * 35, easing: "cubic-bezier(.22,1,.36,1)" },
      );
    });
  }

  async function boot() {
    try {
      const motion = await import("https://cdn.jsdelivr.net/npm/motion@12/+esm");
      animateFn = motion.animate;
    } catch (_error) {
      animateFn = null;
    }

    applyPress();
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          if (node.matches?.(PRESS_TARGETS)) bindPress(node);
          applyPress(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.StudoxMotionPress = { apply: applyPress, animateFlashLesson };
  }

  boot();
})();
