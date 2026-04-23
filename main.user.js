// ==UserScript==
// @name         Pony Town OffTab
// @namespace    http://tampermonkey.net/
// @version      8.1
// @updateURL    https://raw.githubusercontent.com/Nikowoo/Pony-Town-OffTab/refs/heads/main/main.user.js
// @downloadURL  https://raw.githubusercontent.com/Nikowoo/Pony-Town-OffTab/refs/heads/main/main.user.js
// @description  Quickly swap between saved ponies
// @author       Nikowoo
// @match        *://*.pony.town/*
// @icon         https://pony.town/favicon.ico
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const TAG = " (offtab)";
  let state = false;
  let running = false;

  const log = (...a) => console.log("[PT-FIX]", ...a);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const blocker = document.createElement("div");
  Object.assign(blocker.style, {
    position:       "fixed",
    inset:          "0",
    zIndex:         "2147483647",  

    pointerEvents:  "all",
    cursor:         "wait",
    display:        "none",

    background:     "transparent",
  });
  document.documentElement.appendChild(blocker);

  function blockInput()   { blocker.style.display = "block"; }
  function unblockInput() { blocker.style.display = "none";  }

  const HIDE_SELECTORS = ['ngb-modal-backdrop', 'ngb-modal-window'];
  const hiddenElements = new Map();

  function hide(el) {
    if (!el || hiddenElements.has(el)) return;
    hiddenElements.set(el, el.style.display);
    el.style.display = "none";
  }

  function showAll() {
    for (const [el, old] of hiddenElements) el.style.display = old;
    hiddenElements.clear();
  }

  function hideAutomationUI() {
    for (const sel of HIDE_SELECTORS) document.querySelectorAll(sel).forEach(hide);
    hide(input());
    hide(saveBtn());
  }

  let obsTimer = null;
  const observer = new MutationObserver(() => {
    if (!running) return;
    clearTimeout(obsTimer);
    obsTimer = setTimeout(() => {
      for (const sel of HIDE_SELECTORS)
        document.querySelectorAll(sel).forEach(el => { el.style.display = "none"; });
    }, 30);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const input = () => document.querySelector('input[aria-label="Name of your character"]');

  const saveBtn = () =>
    [...document.querySelectorAll("button")].find(b => b.textContent.includes("Save & Play"));

  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;

  function setValue(el, val) {
    nativeSetter.call(el, val);
    for (const type of ["input", "change"])
      el.dispatchEvent(new Event(type, { bubbles: true }));
  }

  async function waitFor(fn, timeout = 3000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const el = fn();
      if (el && (el.offsetParent !== null || el.offsetHeight > 0 || el.offsetWidth > 0)) return el;
      await sleep(50);
    }
    return null;
  }

  async function waitForSaveEnabled(timeout = 4000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const btn = saveBtn();
      if (btn && !btn.disabled && (btn.offsetParent !== null || btn.offsetHeight > 0)) return btn;
      await sleep(50);
    }
    return null;
  }

  async function openMenu() {
    document.body.dispatchEvent(new KeyboardEvent("keydown", {
      key: "j", code: "KeyJ", keyCode: 74, bubbles: true, cancelable: true
    }));
    await sleep(100);
  }

  function humanClick(el) {
    const opts = { bubbles: true, cancelable: true, view: window };
    for (const type of ["mousedown", "mouseup", "click"])
      el.dispatchEvent(new MouseEvent(type, opts));
  }

  async function applyTag(shouldAdd) {
    const el = await waitFor(input);
    if (!el) return false;

    try { el.focus({ preventScroll: true }); } catch { el.focus(); }

    const val = el.value;
    const hasTag = val.endsWith(TAG);

    if (shouldAdd && !hasTag) setValue(el, val + TAG);
    else if (!shouldAdd && hasTag) setValue(el, val.slice(0, -TAG.length));

    await sleep(100);
    return true;
  }

  async function clickSaveSafe() {
    const btn = await waitForSaveEnabled();
    if (!btn) return false;
    try { btn.focus({ preventScroll: true }); } catch { btn.focus(); }
    humanClick(btn);
    await sleep(150);
    return true;
  }

  async function runOfftab() {
    if (running || state) return;
    running = true;

    await sleep(2000);

    if (document.hasFocus()) {
      log("OFFTAB cancelled (user returned)");
      running = false;
      return;
    }

    state = true;
    log("OFFTAB confirmed");

    blockInput();        

    hideAutomationUI();
    await openMenu();
    await applyTag(true);
    await clickSaveSafe();
    showAll();
    unblockInput();      

    running = false;
  }

  async function runFocus() {
    if (running || !state) return;
    running = true;
    state = false;
    log("FOCUS detected");

    blockInput();
    hideAutomationUI();
    await openMenu();
    await sleep(100);
    await applyTag(false);
    await clickSaveSafe();
    showAll();
    unblockInput();
    running = false;
  }

  const visEvent =
    typeof document.hidden      !== "undefined" ? "visibilitychange"      :
    typeof document.msHidden    !== "undefined" ? "msvisibilitychange"    :
                                                  "webkitvisibilitychange";

  document.addEventListener(visEvent, () => {
    document.hidden ? runOfftab() : runFocus();
  });

  window.addEventListener("blur",  () => { if (!state)  runOfftab(); });
  window.addEventListener("focus", () => { if (state)   runFocus();  });

  log("Loaded (v8.1)");
})();
