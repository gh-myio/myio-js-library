// @vitest-environment jsdom

/* eslint-disable */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderCardComponent } from "../src/thingsboard/main-dashboard-shopping/v-4.0.0/card/template-card";

// Mock jQuery for the component
global.$ = (selector) => {
  if (typeof selector === 'string') {
    // Check if it's HTML (contains < and >)
    if (selector.trim().startsWith('<') && selector.includes('>')) {
      // HTML string - create element from HTML
      const div = document.createElement('div');
      div.innerHTML = selector;
      const element = div.firstElementChild;
      return mockJQueryElement(element);
    } else {
      // CSS selector - query the document
      try {
        const element = document.querySelector(selector);
        return mockJQueryElement(element);
      } catch (e) {
        // Invalid selector, return empty jQuery object
        return mockJQueryElement(null);
      }
    }
  } else {
    // DOM element or other object
    return mockJQueryElement(selector);
  }
};

function mockJQueryElement(element) {
  return {
    get: (index) => index === 0 ? element : undefined,
    0: element,
    length: element ? 1 : 0,
    find: (selector) => {
      if (!element) return mockJQueryElement(null);
      const found = element.querySelector(selector);
      return mockJQueryElement(found);
    },
    on: (event, handler) => {
      if (element) element.addEventListener(event, handler);
      return mockJQueryElement(element);
    },
    click: (handler) => {
      if (handler && element) {
        element.addEventListener('click', handler);
      } else if (element) {
        element.click();
      }
      return mockJQueryElement(element);
    },
    addClass: (className) => {
      if (element) element.classList.add(className);
      return mockJQueryElement(element);
    },
    removeClass: (className) => {
      if (element) element.classList.remove(className);
      return mockJQueryElement(element);
    },
    hasClass: (className) => {
      return element ? element.classList.contains(className) : false;
    },
    attr: (name, value) => {
      if (!element) return undefined;
      if (value !== undefined) {
        element.setAttribute(name, value);
        return mockJQueryElement(element);
      }
      return element.getAttribute(name);
    },
    html: (content) => {
      if (!element) return '';
      if (content !== undefined) {
        element.innerHTML = content;
        return mockJQueryElement(element);
      }
      return element.innerHTML;
    },
    text: (content) => {
      if (!element) return '';
      if (content !== undefined) {
        element.textContent = content;
        return mockJQueryElement(element);
      }
      return element.textContent;
    },
    append: (content) => {
      if (element) {
        if (typeof content === 'string') {
          element.insertAdjacentHTML('beforeend', content);
        } else {
          element.appendChild(content);
        }
      }
      return mockJQueryElement(element);
    }
  };
}

// Mock do MyIO global
global.MyIO = {
  formatEnergyByGroup: (val, group) =>
    `${val} kWh${group ? " · " + group : ""}`,
  formatNumberReadable: (n) => Number(n ?? 0).toFixed(1),
};

describe("renderCardComponent com mockEntities", () => {
  let mockEntities;

  beforeEach(() => {
    // Clean up the DOM and add container
    document.body.innerHTML = '<div id="container"></div>';

    // Mock de entidades
    mockEntities = [
      {
        entityId: "dev-001",
        labelOrName: "Bomba Principal",
        entityType: "DEVICE",
        slaveId: "01",
        ingestionId: "ing-aaa",
        val: 1250,
        centralId: "21.111.222.333",
        img: "https://dashboard.myio-bas.com/api/images/public/f9Ce4meybsdaAhAkUlAfy5ei3I4kcN4k",
        isOn: true,
        perc: 85,
        group: "entrada",
        connectionStatus: "online",
      },
      {
        entityId: "dev-002",
        labelOrName: "Chiller Resfriamento",
        entityType: "DEVICE",
        slaveId: "02",
        ingestionId: "ing-bbb",
        val: 980,
        centralId: "21.111.222.334",
        img: "https://dashboard.myio-bas.com/api/images/public/f9Ce4meybsdaAhAkUlAfy5ei3I4kcN4k",
        isOn: false,
        perc: 30,
        group: "adm",
        connectionStatus: "offline",
      },
      {
        entityId: "dev-003",
        labelOrName: "Relógio Externo",
        entityType: "DEVICE",
        slaveId: "03",
        ingestionId: "ing-ccc",
        val: 1560,
        centralId: "21.111.222.335",
        img: "https://dashboard.myio-bas.com/api/images/public/f9Ce4meybsdaAhAkUlAfy5ei3I4kcN4k",
        isOn: true,
        perc: 75,
        group: "relógio",
        connectionStatus: "offline",
      },
    ];
  });

  it("renderiza todos os cards no container", () => {
    const container = document.getElementById("container");
    mockEntities.forEach((entity) => {
      const cardJQuery = renderCardComponent({ entityObject: entity });
      const card = cardJQuery.get(0); // Get the actual DOM element
      container.appendChild(card);
    });
    expect(container.children.length).toBe(3);
  });

  it("aplica classe offline corretamente", () => {
    const cardJQuery = renderCardComponent({ entityObject: mockEntities[1] });
    const card = cardJQuery.get(0); // Get the actual DOM element
    expect(card.classList.contains("offline")).toBe(true);
    const flashIcon = card.querySelector(".flash-icon");
    expect(flashIcon.textContent.trim()).toBe("🔌"); // offline status shows plug icon
  });

  it("usa MyIOLibrary para formatar valores", () => {
    const cardJQuery = renderCardComponent({ entityObject: mockEntities[0] });
    const card = cardJQuery.get(0); // Get the actual DOM element
    const consumo = card.querySelector(".consumption-value").textContent;
    expect(consumo).toBe("1250"); // The actual output is just the number
    const perc = card.querySelector(".device-title-percent").textContent;
    expect(perc).toBe("(85.0%)");
  });

  it("dispara handler ao clicar no dashboard", () => {
    const mockDashboard = vi.fn();
    const cardJQuery = renderCardComponent({
      entityObject: mockEntities[0],
      handleActionDashboard: mockDashboard,
    });
    const card = cardJQuery.get(0); // Get the actual DOM element
    const dashboardBtn = card.querySelector(".action-dashboard");
    dashboardBtn.click();
    expect(mockDashboard).toHaveBeenCalledWith(mockEntities[0]);
  });

  it("dispara handler ao clicar no checkbox", () => {
    const mockSelect = vi.fn();
    const cardJQuery = renderCardComponent({
      entityObject: mockEntities[1],
      handleSelect: mockSelect,
    });
    const card = cardJQuery.get(0); // Get the actual DOM element
    const checkbox = card.querySelector(".action-checker");
    checkbox.click();
    expect(mockSelect).toHaveBeenCalledWith(mockEntities[1]);
  });
});
