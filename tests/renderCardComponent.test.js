/* eslint-disable */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { renderCardComponent } from "../src/thingsboard/main-dashboard-shopping/v-4.0.0/card/template-card";

// Mock do MyIO global
global.MyIO = {
  formatEnergyByGroup: (val, group) =>
    `${val} kWh${group ? " · " + group : ""}`,
  formatNumberReadable: (n) => Number(n ?? 0).toFixed(1),
};

describe("renderCardComponent com mockEntities", () => {
  let mockEntities;
  let dom;

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><body><div id="container"></div></body>`);
    global.document = dom.window.document;
    global.window = dom.window;

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
      const card = renderCardComponent({ entityObject: entity });
      container.appendChild(card);
    });
    expect(container.children.length).toBe(3);
  });

  it("aplica classe offline corretamente", () => {
    const card = renderCardComponent({ entityObject: mockEntities[1] });
    expect(card.classList.contains("offline")).toBe(true);
    const flashIcon = card.querySelector(".flash-icon");
    expect(flashIcon.textContent.trim()).toBe("🚨");
  });

  it("usa MyIOLibrary para formatar valores", () => {
    const card = renderCardComponent({ entityObject: mockEntities[0] });
    const consumo = card.querySelector(".consumption-value").textContent;
    expect(consumo).toBe("1250 kWh · entrada");
    const perc = card.querySelector(".device-title-percent").textContent;
    expect(perc).toBe("(85.0%)");
  });

  it("dispara handler ao clicar no dashboard", () => {
    const mockDashboard = vi.fn();
    const card = renderCardComponent({
      entityObject: mockEntities[0],
      handleActionDashboard: mockDashboard,
    });
    const dashboardBtn = card.querySelector(".action-dashboard");
    dashboardBtn.click();
    expect(mockDashboard).toHaveBeenCalledWith(mockEntities[0]);
  });

  it("dispara handler ao clicar no checkbox", () => {
    const mockSelect = vi.fn();
    const card = renderCardComponent({
      entityObject: mockEntities[1],
      handleSelect: mockSelect,
    });
    const checkbox = card.querySelector(".action-checker");
    checkbox.click();
    expect(mockSelect).toHaveBeenCalledWith(mockEntities[1]);
  });
});
