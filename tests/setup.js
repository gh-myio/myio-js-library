import { JSDOM } from "jsdom";

global.$ = (html) => {
  const dom = new JSDOM(html);
  const el = dom.window.document.body.firstChild;

  // Métodos comuns do jQuery que você usa
  el.append = (child) => el.appendChild(child);
  el.click = () => {};
  el.addClass = (cls) => el.classList.add(cls);
  el.removeClass = (cls) => el.classList.remove(cls);

  // .on para click
  el.on = (event, handler) => {
    if (event === "click") el.addEventListener("click", handler);
  };

  // .find retorna elemento com .on também
  el.find = (selector) => {
    const found = el.querySelector(selector);
    if (found) {
      found.on = (event, handler) => {
        if (event === "click") found.addEventListener("click", handler);
      };
    }
    return found;
  };

  return el;
};
