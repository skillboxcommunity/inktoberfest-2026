/* Интерактив Skillbox: табы, карточки выбора и выпадающий список.
   Подключение: <script src="vendor/skillbox/components.js" defer></script>
   После добавления разметки: window.SkillboxComponents.init(container).
   Повторное подключение и повторный init не дублируют обработчики. */
(function () {
  "use strict";

  if (window.SkillboxComponents) {
    window.SkillboxComponents.init();
    return;
  }

  const initialized = new WeakSet();
  let openSelect = null;
  let nextId = 0;

  function find(root, selector) {
    const matches = Array.from(root.querySelectorAll(selector));
    if (root.matches && root.matches(selector)) matches.unshift(root);
    return matches;
  }

  function items(group, selector, groupSelector) {
    return Array.from(group.querySelectorAll(selector)).filter(
      (item) => item.closest(groupSelector) === group
    );
  }

  function enabled(item) {
    return !item.disabled && item.getAttribute("aria-disabled") !== "true";
  }

  function notify(group, type, button) {
    group.dispatchEvent(new CustomEvent("skillbox:change", {
      bubbles: true,
      detail: { type, value: button.dataset.value || button.textContent.trim(), button }
    }));
  }

  function moveIndex(event, current, count) {
    if (event.key === "Home") return 0;
    if (event.key === "End") return count - 1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") return (current + 1) % count;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") return (current - 1 + count) % count;
    return null;
  }

  function initGroup(group, kind) {
    if (initialized.has(group)) return;
    const isTab = kind === "tab";
    const selector = isTab ? ".tab" : ".selector-card";
    const groupSelector = isTab ? "[data-tab-group]" : "[data-selector-group]";
    const isTablist = isTab && group.getAttribute("role") === "tablist";
    const getItems = () => items(group, selector, groupSelector);

    function activate(active, emit) {
      getItems().forEach((item) => {
        const selected = item === active;
        item.classList.toggle("is-active", selected);
        if (isTablist) {
          item.setAttribute("role", "tab");
          item.setAttribute("aria-selected", String(selected));
          item.removeAttribute("aria-pressed");
          item.tabIndex = selected ? 0 : -1;
        } else {
          item.setAttribute("aria-pressed", String(selected));
        }
        const panelId = isTab && item.getAttribute("aria-controls");
        const panel = panelId && document.getElementById(panelId);
        if (panel) panel.hidden = !selected;
      });
      if (emit) notify(group, kind, active);
    }

    const available = getItems().filter(enabled);
    const initial = available.find((item) => item.classList.contains("is-active") ||
      item.getAttribute(isTablist ? "aria-selected" : "aria-pressed") === "true") || available[0];
    if (initial) activate(initial, false);

    group.addEventListener("click", (event) => {
      const button = event.target.closest(selector);
      if (button && button.closest(groupSelector) === group && enabled(button)) {
        activate(button, true);
      }
    });
    group.addEventListener("keydown", (event) => {
      const button = event.target.closest(selector);
      if (!button || button.closest(groupSelector) !== group || !enabled(button)) return;
      // Enter/Space оставлены нативному <button>; стрелки перемещают выбор.
      const available = getItems().filter(enabled);
      const index = moveIndex(event, available.indexOf(button), available.length);
      if (index === null) return;
      event.preventDefault();
      available[index].focus();
      activate(available[index], true);
    });
    initialized.add(group);
  }

  function positionSelect(select) {
    const rect = select.trigger.getBoundingClientRect();
    Object.assign(select.menu.style, {
      top: `${rect.bottom - 2}px`, left: `${rect.left}px`, width: `${rect.width}px`,
      maxHeight: `${Math.max(80, window.innerHeight - rect.bottom - 12)}px`
    });
  }

  function closeSelect(restoreFocus) {
    if (!openSelect) return;
    const select = openSelect;
    openSelect = null;
    select.group.classList.remove("is-open");
    select.trigger.setAttribute("aria-expanded", "false");
    select.menu.hidden = true;
    if (restoreFocus) select.trigger.focus();
  }

  function initSelect(group) {
    if (initialized.has(group)) return;
    const trigger = group.querySelector(".select-display");
    const menu = group.querySelector(".select-menu");
    const valueNode = group.querySelector(".select-display-value");
    if (!trigger || !menu || !valueNode) return;
    const select = { group, trigger, menu };
    const getOptions = () => items(group, ".select-option", "[data-select]");
    const hiddenInput = group.querySelector("input[type='hidden'][data-select-input]");
    if (!menu.id) {
      let id;
      do { id = `skillbox-select-${++nextId}`; }
      while (document.getElementById(id));
      menu.id = id;
    }
    menu.setAttribute("role", "listbox");
    menu.hidden = true;
    group.classList.remove("is-open");
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", menu.id);

    function choose(option, emit) {
      getOptions().forEach((item) => {
        const selected = item === option;
        item.classList.toggle("is-selected", selected);
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", String(selected));
        item.tabIndex = -1;
      });
      valueNode.textContent = option.textContent.trim();
      const value = option.dataset.value || option.textContent.trim();
      group.dataset.value = value;
      if (hiddenInput) {
        hiddenInput.value = value;
        if (emit) hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (emit) notify(group, "select", option);
    }

    function open(last) {
      if (!enabled(trigger)) return;
      closeSelect(false);
      openSelect = select;
      group.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      menu.hidden = false;
      positionSelect(select);
      const options = getOptions().filter(enabled);
      const target = last ? options[options.length - 1] :
        options.find((option) => option.classList.contains("is-selected")) || options[0];
      if (target) target.focus();
    }

    const options = getOptions();
    const initial = options.find((item) => item.classList.contains("is-selected") ||
      item.getAttribute("aria-selected") === "true") || options.find(enabled);
    if (initial) choose(initial, false);

    trigger.addEventListener("click", () => {
      if (openSelect === select) closeSelect(false);
      else open(false);
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        open(event.key === "ArrowUp");
      }
    });
    menu.addEventListener("click", (event) => {
      const option = event.target.closest(".select-option");
      if (!option || option.closest("[data-select]") !== group || !enabled(option)) return;
      choose(option, true);
      closeSelect(true);
    });
    menu.addEventListener("keydown", (event) => {
      const options = getOptions().filter(enabled);
      if (!options.length) return;
      const index = moveIndex(event, options.indexOf(document.activeElement), options.length);
      if (index === null) return;
      event.preventDefault();
      options[index].focus();
    });
    group.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && openSelect === select) {
        event.preventDefault();
        closeSelect(true);
      }
    });
    group.addEventListener("focusout", (event) => {
      if (openSelect === select && !group.contains(event.relatedTarget)) closeSelect(false);
    });
    initialized.add(group);
  }

  function init(root = document) {
    find(root, "[data-tab-group]").forEach((group) => initGroup(group, "tab"));
    find(root, "[data-selector-group]").forEach((group) => initGroup(group, "selector"));
    find(root, "[data-select]").forEach(initSelect);
  }

  document.addEventListener("click", (event) => {
    if (openSelect && !openSelect.group.contains(event.target)) closeSelect(false);
  });
  window.addEventListener("resize", () => { if (openSelect) positionSelect(openSelect); });
  document.addEventListener("scroll", () => { if (openSelect) positionSelect(openSelect); }, true);
  window.SkillboxComponents = Object.freeze({ init });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init(), { once: true });
  } else {
    init();
  }
})();
