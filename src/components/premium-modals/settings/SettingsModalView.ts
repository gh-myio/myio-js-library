import { ModalConfig } from "./types";
import { mapDeviceStatusToCardStatus } from "../../../utils/deviceStatus";

export class SettingsModalView {
  private container: HTMLElement;
  private modal: HTMLElement;
  private form: HTMLFormElement;
  private config: ModalConfig;
  private focusTrapElements: HTMLElement[] = [];
  private originalActiveElement: Element | null = null;

  constructor(config: ModalConfig) {
    this.config = config;
    this.createModal();
  }

  render(initialData: Record<string, any>): void {
    // Store current focus to restore later
    this.originalActiveElement = document.activeElement;

    // Portal to document.body to escape widget stacking contexts
    document.body.appendChild(this.container);
    this.populateForm(initialData);
    this.attachEventListeners(); // Attach event listeners after DOM is ready
    this.setupAccessibility();
    this.setupFocusTrap();
    this.applyTheme();
  }

  close(): void {
    this.teardownFocusTrap();

    // Restore focus to original element
    if (this.originalActiveElement && "focus" in this.originalActiveElement) {
      (this.originalActiveElement as HTMLElement).focus();
    }

    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  showError(message: string): void {
    const errorEl = this.modal.querySelector(".error-message") as HTMLElement;
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = "block";
      errorEl.setAttribute("role", "alert");
      errorEl.setAttribute("aria-live", "polite");
    }
  }

  hideError(): void {
    const errorEl = this.modal.querySelector(".error-message") as HTMLElement;
    if (errorEl) {
      errorEl.style.display = "none";
      errorEl.removeAttribute("role");
      errorEl.removeAttribute("aria-live");
    }
  }

  showLoadingState(isLoading: boolean): void {
    const saveBtn = this.modal.querySelector(".btn-save") as HTMLButtonElement;
    const cancelBtn = this.modal.querySelector(
      ".btn-cancel"
    ) as HTMLButtonElement;
    const formInputs = this.modal.querySelectorAll(
      "input, select, textarea"
    ) as NodeListOf<HTMLInputElement>;

    if (saveBtn) {
      saveBtn.disabled = isLoading;
      saveBtn.textContent = isLoading ? "Salvando..." : "Salvar";
    }

    if (cancelBtn) {
      cancelBtn.disabled = isLoading;
    }

    // Disable form inputs during save
    formInputs.forEach((input) => {
      input.disabled = isLoading;
    });
  }

  private formatDomainLabel(domain: string): string {
    const MAP: Record<Domain, string> = {
      energy: "de energia",
      water: "de água",
      temperature: "de temperatura",
    };
    return MAP[domain];
  }

  getFormData(): Record<string, any> {
    const formData = new FormData(this.form);
    const data: Record<string, any> = {};

    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") {
        // Handle numeric fields (consumption, temperature, and water levels)
        if (
          [
            "maxDailyKwh",
            "maxNightKwh",
            "maxBusinessKwh",
            "minTemperature",
            "maxTemperature",
            "minWaterLevel",
            "maxWaterLevel",
          ].includes(key)
        ) {
          const num = parseFloat(value);
          if (!isNaN(num)) {
            // For consumption fields, ensure they are >= 0
            if (key.includes("Kwh") && num < 0) {
              continue;
            }
            // For water level fields, ensure they are between 0 and 100
            if (key.includes("WaterLevel")) {
              if (num < 0 || num > 100) {
                continue;
              }
            }
            data[key] = num;
          }
        } else if (value.trim()) {
          data[key] = value.trim();
        }
      }
    }

    return data;
  }

  private createModal(): void {
    this.container = document.createElement("div");
    this.container.className = "myio-settings-modal-overlay";
    this.container.innerHTML = this.getModalHTML();
    this.modal = this.container.querySelector(
      ".myio-settings-modal"
    ) as HTMLElement;
    this.form = this.modal.querySelector("form") as HTMLFormElement;
  }

  private getModalHTML(): string {
    const width =
      typeof this.config.width === "number"
        ? `${this.config.width}px`
        : this.config.width;

    return `
      <div class="myio-settings-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="myio-settings-modal" style="width: ${width}">
          <div class="modal-header">
            <h3 id="modal-title">Configurações</h3>
            <button type="button" class="close-btn" aria-label="Fechar">&times;</button>
          </div>
          <div class="modal-body">
            <div class="error-message" style="display: none;" role="alert" aria-live="polite"></div>
            <form novalidate>
              ${this.getFormHTML()}
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-cancel">Fechar</button>
            <button type="button" class="btn-save btn-primary">Salvar</button>
          </div>
        </div>
      </div>
      ${this.getModalCSS()}
    `;
  }

  private getFormHTML(): string {
    // Check deviceType for conditional rendering
    const deviceType = this.config.deviceType;

    // RFC-0077: Extract customerName for display
    const customerName = this.config.customerName;
    const hasCustomerName = customerName && customerName.trim() !== '';

    return `
      <div class="form-layout">
        ${hasCustomerName ? `
        <!-- RFC-0077: Shopping name display above device label -->
        <div class="customer-name-container">
          <div class="customer-name-label">Shopping</div>
          <div class="customer-name-value">
            <span class="customer-icon">🏢</span>
            <span class="customer-name-text">${customerName}</span>
          </div>
        </div>
        ` : ''}

        <!-- Top Row: Two cards side by side -->
        <div class="form-columns">
          <!-- Left Column: Device Label -->
          <div class="form-column">
            <div class="form-card">
              <h4 class="section-title device-label-title">${
                this.config.deviceLabel || "NÃO INFORMADO"
              }</h4>

              <div class="form-group">
                <label for="label">Etiqueta</label>
                <input type="text" id="label" name="label" required maxlength="255">
              </div>

              <div class="form-group">
                <label for="floor">Andar</label>
                <input type="text" id="floor" name="floor" maxlength="50">
              </div>

              <div class="form-group">
                <label for="identifier">Número da Loja</label>
                <input type="text" id="identifier" name="identifier" maxlength="20" readonly>
              </div>
            </div>
          </div>

          <!-- Right Column: Alarms -->
          <div class="form-column">
            ${this.getAlarmsHTML(deviceType)}
          </div>
        </div>

        <!-- Bottom Row: Connection Info spanning full width -->
        ${this.getConnectionInfoHTML()}

        <!-- RFC-0077: Power Limits Configuration (only for energy domain and when deviceType is available) -->
        ${this.config.domain === 'energy' && this.config.deviceType ? this.getPowerLimitsHTML() : ''}
      </div>
    `;
  }

  private getAlarmsHTML(deviceType?: string): string {
    switch (deviceType) {
      case "TERMOSTATO":
        return this.getThermostatAlarmsHTML();
      case "CAIXA_DAGUA":
        return this.getWaterTankAlarmsHTML();
      default:
        return this.getConsumptionAlarmsHTML();
    }
  }

  private getConsumptionAlarmsHTML(): string {
    // Determine unit based on domain
    const unit = this.config.domain === "water" ? "L" : "kWh";

    return `
      <div class="form-card">
        <h4 class="section-title">Alarmes ${this.formatDomainLabel(
          this.config.domain
        )}</h4>

        <div class="form-group">
          <label for="maxDailyKwh">Consumo Máximo Diário (${unit})</label>
          <input type="number" id="maxDailyKwh" name="maxDailyKwh" min="0" step="0.1">
        </div>

        <div class="form-group">
          <label for="maxNightKwh">Consumo Máximo na Madrugada (0h–06h)</label>
          <input type="number" id="maxNightKwh" name="maxNightKwh" min="0" step="0.1">
        </div>

        <div class="form-group">
          <label for="maxBusinessKwh">Consumo Máximo Horário Comercial (09h–22h)</label>
          <input type="number" id="maxBusinessKwh" name="maxBusinessKwh" min="0" step="0.1">
        </div>
      </div>
    `;
  }

  private getThermostatAlarmsHTML(): string {
    return `
      <div class="form-card">
        <h4 class="section-title">Alarmes de Temperatura</h4>

        <div class="form-group">
          <label for="minTemperature">Temperatura Mínima (°C)</label>
          <input type="number" id="minTemperature" name="minTemperature" step="0.1">
        </div>

        <div class="form-group">
          <label for="maxTemperature">Temperatura Máxima (°C)</label>
          <input type="number" id="maxTemperature" name="maxTemperature" step="0.1">
        </div>
      </div>
    `;
  }

  private getWaterTankAlarmsHTML(): string {
    return `
      <div class="form-card">
        <h4 class="section-title">Alarmes de Nível</h4>

        <div class="form-group">
          <label for="minWaterLevel">Nível Mínimo (%)</label>
          <input type="number" id="minWaterLevel" name="minWaterLevel" min="0" max="100" step="0.1" placeholder="Risco de falta d'água">
        </div>

        <div class="form-group">
          <label for="maxWaterLevel">Nível Máximo (%)</label>
          <input type="number" id="maxWaterLevel" name="maxWaterLevel" min="0" max="100" step="0.1" placeholder="Risco de transbordar">
        </div>
      </div>
    `;
  }

  /**
   * RFC-0077: Power Limits Configuration UI
   * Shows device-level and customer-level consumption limits
   */
  private getPowerLimitsHTML(): string {
    return `
      <div class="form-card power-limits-card">
        <div class="power-limits-header">
          <h4 class="section-title">Configuração de Limites de Potência</h4>
          <div class="power-limits-subtitle">
            Configure os limites de consumo para monitoramento do equipamento
          </div>
        </div>

        <div class="power-limits-table-wrapper">
          <table class="power-limits-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Mínimo (W)</th>
                <th>Máximo (W)</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>
              <tr class="limit-row standby-row">
                <td class="status-label">
                  <span class="status-icon">🔌</span>
                  <span>StandBy</span>
                </td>
                <td>
                  <input type="number"
                         id="standbyLimitDownConsumption"
                         name="standbyLimitDownConsumption"
                         class="limit-input"
                         min="0"
                         step="1"
                         placeholder="Min">
                </td>
                <td>
                  <input type="number"
                         id="standbyLimitUpConsumption"
                         name="standbyLimitUpConsumption"
                         class="limit-input"
                         min="0"
                         step="1"
                         placeholder="Max">
                </td>
                <td class="source-cell">
                  <span class="source-badge" id="standby-source">—</span>
                </td>
              </tr>

              <tr class="limit-row normal-row">
                <td class="status-label">
                  <span class="status-icon">⚡</span>
                  <span>Normal</span>
                </td>
                <td>
                  <input type="number"
                         id="normalLimitDownConsumption"
                         name="normalLimitDownConsumption"
                         class="limit-input"
                         min="0"
                         step="1"
                         placeholder="Min">
                </td>
                <td>
                  <input type="number"
                         id="normalLimitUpConsumption"
                         name="normalLimitUpConsumption"
                         class="limit-input"
                         min="0"
                         step="1"
                         placeholder="Max">
                </td>
                <td class="source-cell">
                  <span class="source-badge" id="normal-source">—</span>
                </td>
              </tr>

              <tr class="limit-row alert-row">
                <td class="status-label">
                  <span class="status-icon">⚠️</span>
                  <span>Alerta</span>
                </td>
                <td>
                  <input type="number"
                         id="alertLimitDownConsumption"
                         name="alertLimitDownConsumption"
                         class="limit-input"
                         min="0"
                         step="1"
                         placeholder="Min">
                </td>
                <td>
                  <input type="number"
                         id="alertLimitUpConsumption"
                         name="alertLimitUpConsumption"
                         class="limit-input"
                         min="0"
                         step="1"
                         placeholder="Max">
                </td>
                <td class="source-cell">
                  <span class="source-badge" id="alert-source">—</span>
                </td>
              </tr>

              <tr class="limit-row failure-row">
                <td class="status-label">
                  <span class="status-icon">🚨</span>
                  <span>Falha</span>
                </td>
                <td>
                  <input type="number"
                         id="failureLimitDownConsumption"
                         name="failureLimitDownConsumption"
                         class="limit-input"
                         min="0"
                         step="1"
                         placeholder="Min">
                </td>
                <td>
                  <input type="number"
                         id="failureLimitUpConsumption"
                         name="failureLimitUpConsumption"
                         class="limit-input"
                         min="0"
                         step="1"
                         placeholder="Max">
                </td>
                <td class="source-cell">
                  <span class="source-badge" id="failure-source">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="power-limits-actions">
          <button type="button" class="btn-copy-global" id="btnCopyFromGlobal">
            🌐 Copiar do Global
          </button>
          <button type="button" class="btn-clear-overrides" id="btnClearOverrides">
            🔵 Limpar Customizações
          </button>
        </div>

        <div class="power-limits-legend">
          <div class="legend-item">
            <span class="source-badge source-device">🔵 Device</span>
            <span class="legend-text">Configuração específica deste equipamento</span>
          </div>
          <div class="legend-item">
            <span class="source-badge source-global">🌐 Global</span>
            <span class="legend-text">Configuração padrão do shopping</span>
          </div>
          <div class="legend-item">
            <span class="source-badge source-hardcoded">💾 Sistema</span>
            <span class="legend-text">Valor padrão do sistema</span>
          </div>
        </div>
      </div>
    `;
  }

  private calculateTimeBetweenDates(data1, data2) {
    // 1. Validação das entradas
    if (!(data1 instanceof Date) || !(data2 instanceof Date)) {
      console.error(
        "Entradas inválidas. As duas entradas devem ser objetos Date."
      );
      return "Datas inválidas";
    }

    // 2. Calcular a diferença absoluta em milissegundos
    const diffMs = Math.abs(data1.getTime() - data2.getTime());

    // 3. Definir constantes de conversão
    const msPorMinuto = 1000 * 60;
    const msPorHora = msPorMinuto * 60;
    const msPorDia = msPorHora * 24;

    // 4. Decidir o formato da saída

    // Se a diferença for de 1 dia ou mais
    if (diffMs >= msPorDia) {
      const dias = Math.floor(diffMs / msPorDia);
      return `${dias} ${dias === 1 ? "dia" : "dias"}`;
    }

    // Se a diferença for de 1 hora ou mais (mas menos de 1 dia)
    if (diffMs >= msPorHora) {
      const horas = Math.floor(diffMs / msPorHora);
      return `${horas} ${horas === 1 ? "hora" : "horas"}`;
    }

    // Se a diferença for menor que 1 hora
    const minutos = Math.round(diffMs / msPorMinuto);
    return `${minutos} ${minutos === 1 ? "minuto" : "minutos"}`;
  }

  private getConnectionInfoHTML(): string {
    if (!this.config.connectionData) {
      return "";
    }

    const {
      centralName,
      connectionStatusTime,
      timeVal,
      deviceStatus,
      lastDisconnectTime,
    } = this.config.connectionData;

    // Format disconnection time
    let lastDisconnectTimeFormatted = "N/A";
    let disconectTime = "";
    if (lastDisconnectTime) {
      disconectTime = this.calculateTimeBetweenDates(
        new Date(connectionStatusTime),
        new Date(lastDisconnectTime)
      );

      try {
        const date = new Date(lastDisconnectTime);
        lastDisconnectTimeFormatted = date.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch (e) {
        lastDisconnectTimeFormatted = "Formato inválido";
      }
    }

    // Format connection time
    let connectionTimeFormatted = "N/A";
    if (connectionStatusTime) {
      try {
        const date = new Date(connectionStatusTime);
        connectionTimeFormatted = date.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch (e) {
        connectionTimeFormatted = "Formato inválido";
      }
    }

    // Format telemetry time
    let telemetryTimeFormatted = "N/A";
    let timeSinceLastTelemetry = "";
    if (timeVal) {
      try {
        const telemetryDate = new Date(timeVal);
        telemetryTimeFormatted = telemetryDate.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        // Calculate time difference
        const now = new Date();
        const diffMs = now.getTime() - telemetryDate.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) {
          timeSinceLastTelemetry = `(${diffDays}d atrás)`;
        } else if (diffHours > 0) {
          timeSinceLastTelemetry = `(${diffHours}h atrás)`;
        } else if (diffMinutes > 0) {
          timeSinceLastTelemetry = `(${diffMinutes}min atrás)`;
        } else {
          timeSinceLastTelemetry = "(agora)";
        }
      } catch (e) {
        telemetryTimeFormatted = "Formato inválido";
      }
    }

    const statusMap: Record<string, { text: string; color: string }> = {
      ok: { text: "Normal", color: "#22c55e" },
      alert: { text: "Atenção", color: "#f59e0b" },
      fail: { text: "Erro", color: "#ef4444" },
      unknown: { text: "Sem informação", color: "#94a3b8" },
    };

    const statusInfo = statusMap[
      mapDeviceStatusToCardStatus(deviceStatus) || ""
    ] || { text: "Desconhecido", color: "#6b7280" };

    return `
      <div class="form-card info-card-wide">
        <h4 class="section-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="vertical-align: text-bottom; margin-right: 6px;">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
            <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
          </svg>
          Informações de Conexão
        </h4>

        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Central:</span>
            <span class="info-value">${centralName || "N/A"}</span>
          </div>

          <div class="info-row">
            <span class="info-label">Status:</span>
            <span class="info-value" style="color: ${
              statusInfo.color
            }; font-weight: 600;">
              ${statusInfo.text}
            </span>
          </div>

          <div class="info-row">
            <span class="info-label">Última Conexão:</span>
            <span class="info-value">${connectionTimeFormatted}</span>
          </div>

          <div class="info-row">
            <span class="info-label">Última Telemetria:</span>
            <span class="info-value">
              ${telemetryTimeFormatted}
              ${
                timeSinceLastTelemetry
                  ? `<span class="time-since">${timeSinceLastTelemetry}</span>`
                  : ""
              }
            </span>
          </div>
            <div class="info-row">
            <span class="info-label">Último desconexão:</span>
            <span class="info-value">
              ${lastDisconnectTimeFormatted}
              ${
                disconectTime
                  ? `<span class="time-since">${disconectTime}</span>`
                  : ""
              }
            </span>
          </div>
        </div>
      </div>
    `;
  }

  private getModalCSS(): string {
    return `
      <style>
        .myio-settings-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .myio-settings-modal {
          background: white;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
          max-width: 95vw;
          max-height: 90vh;
          width: 1000px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        
        .modal-header {
          background: #3e1a7d;
          color: white;
          padding: 20px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: white;
        }
        
        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: white;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }
        
        .close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        
        .modal-body {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
          background: #f8f9fa;
        }
        
        .error-message {
          background: #fee;
          border: 1px solid #fcc;
          color: #c33;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 16px;
          font-size: 14px;
        }
        
        .form-layout {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* RFC-0077: Customer name display styles */
        .customer-name-container {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 8px;
          padding: 16px 20px;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
        }

        .customer-name-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 6px;
        }

        .customer-name-value {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .customer-icon {
          font-size: 24px;
          line-height: 1;
        }

        .customer-name-text {
          font-size: 18px;
          font-weight: 600;
          color: white;
          line-height: 1.2;
        }

        /* RFC-0077: Device label with monospace font */
        .device-label-title {
          font-family: 'Courier New', Courier, monospace;
          font-size: 15px;
          letter-spacing: 0.5px;
        }

        .form-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .form-column {
          display: flex;
          flex-direction: column;
        }

        .form-card {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          padding: 20px;
          height: fit-content;
        }

        .section-title {
          margin: 0 0 20px 0;
          font-size: 16px;
          font-weight: 600;
          color: #3e1a7d;
        }
        
        .form-group {
          display: flex;
          flex-direction: column;
          margin-bottom: 16px;
        }
        
        .form-group:last-child {
          margin-bottom: 0;
        }
        
        .form-group label {
          font-weight: 500;
          margin-bottom: 6px;
          color: #333;
          font-size: 14px;
        }
        
        .form-group input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        
        .form-group input:focus {
          outline: none;
          border-color: #3e1a7d;
          box-shadow: 0 0 0 2px rgba(62, 26, 125, 0.25);
        }
        
        .form-group input:invalid {
          border-color: #dc3545;
        }
        
        .form-group input[readonly] {
          background-color: #f8f9fa;
          color: #6c757d;
          cursor: not-allowed;
        }
        
        .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #e0e0e0;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          background: white;
        }
        
        .modal-footer button {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-cancel {
          background: #6c757d;
          color: white;
        }
        
        .btn-cancel:hover:not(:disabled) {
          background: #545b62;
        }
        
        .btn-primary {
          background: #3e1a7d;
          color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
          background: #2d1458;
        }
        
        .modal-footer button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        /* Responsive design */
        @media (max-width: 1700px) {
          .myio-settings-modal {
            width: 95vw !important;
          }
        }
        
        @media (max-width: 1024px) {
          .myio-settings-modal {
            width: 90vw !important;
          }
          
          .form-columns {
            gap: 16px;
          }
          
          .form-card {
            padding: 16px;
          }
        }
        
        @media (max-width: 768px) {
          .myio-settings-modal {
            width: 95vw !important;
            margin: 10px;
          }

          .form-columns {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .info-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .modal-header, .modal-body, .modal-footer {
            padding-left: 16px;
            padding-right: 16px;
          }

          .form-card {
            padding: 16px;
          }
        }
        
        /* Scrollbar styling for modal body */
        .modal-body::-webkit-scrollbar {
          width: 6px;
        }
        
        .modal-body::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }
        
        .modal-body::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 3px;
        }
        
        .modal-body::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }

        /* Connection Info Card Styles - Wide layout spanning 2 columns */
        .info-card-wide {
          margin-top: 20px;
          background: linear-gradient(135deg, #f8fafc 0%, #f0f9ff 100%);
          border: 1px solid #e0e7ff;
          grid-column: 1 / -1; /* Span all columns */
        }

        .info-card-wide .section-title {
          color: #2563eb;
          display: flex;
          align-items: center;
          margin-bottom: 12px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px 24px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 6px;
          border: 1px solid rgba(0, 0, 0, 0.05);
        }

        .info-label {
          font-weight: 600;
          color: #475569;
          font-size: 13px;
          flex-shrink: 0;
        }

        .info-value {
          text-align: right;
          color: #1e293b;
          font-size: 13px;
          word-break: break-word;
          margin-left: 12px;
        }

        .time-since {
          display: inline-block;
          margin-left: 6px;
          color: #64748b;
          font-size: 12px;
          font-style: italic;
        }

        /* RFC-0077: Power Limits Configuration Styles */
        .power-limits-card {
          grid-column: 1 / -1; /* Span full width */
          margin-top: 20px;
        }

        .power-limits-header {
          margin-bottom: 20px;
        }

        .power-limits-subtitle {
          font-size: 13px;
          color: #6c757d;
          margin-top: 8px;
        }

        .power-limits-table-wrapper {
          overflow-x: auto;
          margin-bottom: 16px;
        }

        .power-limits-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .power-limits-table thead {
          background: #f8f9fa;
        }

        .power-limits-table th {
          padding: 12px;
          text-align: left;
          font-weight: 600;
          color: #495057;
          border-bottom: 2px solid #dee2e6;
        }

        .power-limits-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #e9ecef;
        }

        .limit-row:hover {
          background: #f8f9fa;
        }

        .status-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
        }

        .status-icon {
          font-size: 18px;
        }

        .limit-input {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 14px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .limit-input:focus {
          outline: none;
          border-color: #3e1a7d;
          box-shadow: 0 0 0 2px rgba(62, 26, 125, 0.15);
        }

        .source-cell {
          text-align: center;
        }

        .source-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          background: #e9ecef;
          color: #495057;
        }

        .source-badge.source-device {
          background: #cfe2ff;
          color: #084298;
        }

        .source-badge.source-global {
          background: #d1e7dd;
          color: #0f5132;
        }

        .source-badge.source-hardcoded {
          background: #f8d7da;
          color: #842029;
        }

        .power-limits-actions {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }

        .btn-copy-global,
        .btn-clear-overrides {
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-copy-global {
          background: #198754;
          color: white;
        }

        .btn-copy-global:hover {
          background: #157347;
        }

        .btn-clear-overrides {
          background: #0d6efd;
          color: white;
        }

        .btn-clear-overrides:hover {
          background: #0b5ed7;
        }

        .power-limits-legend {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 6px;
          border-left: 3px solid #3e1a7d;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .legend-text {
          font-size: 13px;
          color: #495057;
        }

        @media (max-width: 768px) {
          .power-limits-table {
            font-size: 12px;
          }

          .power-limits-table th,
          .power-limits-table td {
            padding: 8px;
          }

          .limit-input {
            padding: 6px 8px;
            font-size: 12px;
          }

          .power-limits-actions {
            flex-direction: column;
          }

          .btn-copy-global,
          .btn-clear-overrides {
            width: 100%;
          }
        }
      </style>
    `;
  }

  private populateForm(data: Record<string, any>): void {
    for (const [key, value] of Object.entries(data)) {
      const input = this.form.querySelector(
        `[name="${key}"]`
      ) as HTMLInputElement;
      if (input && value !== undefined && value !== null) {
        input.value = String(value);
      }
    }
  }

  private setupAccessibility(): void {
    // Set initial focus to first input
    const firstInput = this.modal.querySelector("input") as HTMLInputElement;
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }

    // Setup ARIA relationships
    this.modal.setAttribute("aria-labelledby", "modal-title");
  }

  private setupFocusTrap(): void {
    // Get all focusable elements
    this.focusTrapElements = Array.from(
      this.modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ) as HTMLElement[];

    // Handle Tab key for focus trap
    this.modal.addEventListener("keydown", this.handleKeyDown.bind(this));
  }

  private teardownFocusTrap(): void {
    this.modal.removeEventListener("keydown", this.handleKeyDown.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape" && this.config.closeOnBackdrop !== false) {
      event.preventDefault();
      this.config.onClose();
      return;
    }

    if (event.key === "Tab") {
      const firstElement = this.focusTrapElements[0];
      const lastElement =
        this.focusTrapElements[this.focusTrapElements.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
  }

  private attachEventListeners(): void {
    // Handle form submission
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.hideError();

      const formData = this.getFormData();
      this.config.onSave(formData);
    });

    // Handle close button (X button)
    const closeBtn = this.modal.querySelector(
      ".close-btn"
    ) as HTMLButtonElement;
    if (closeBtn) {
      closeBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.config.onClose();
      });
    }

    // Handle cancel button (Fechar button)
    const cancelBtn = this.modal.querySelector(
      ".btn-cancel"
    ) as HTMLButtonElement;
    if (cancelBtn) {
      cancelBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.config.onClose();
      });
    }

    // Handle save button (Salvar button)
    const saveBtn = this.modal.querySelector(".btn-save") as HTMLButtonElement;
    if (saveBtn) {
      saveBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.hideError();

        const formData = this.getFormData();
        this.config.onSave(formData);
      });
    }

    // Handle backdrop click
    this.container.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;

      if (
        target.classList.contains("myio-settings-modal-overlay") &&
        this.config.closeOnBackdrop !== false
      ) {
        this.config.onClose();
      }
    });

    // Real-time validation
    this.form.addEventListener("input", this.handleInputValidation.bind(this));
  }

  private handleInputValidation(event: Event): void {
    const input = event.target as HTMLInputElement;

    // Clear previous validation state
    input.classList.remove("is-invalid");

    // GUID validation
    if (input.name === "guid" && input.value) {
      const guidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!guidPattern.test(input.value)) {
        input.classList.add("is-invalid");
        input.setCustomValidity("Invalid GUID format");
      } else {
        input.setCustomValidity("");
      }
    }

    // Numeric validation
    if (input.type === "number" && input.value) {
      const num = parseFloat(input.value);
      if (isNaN(num) || num < 0) {
        input.classList.add("is-invalid");
        input.setCustomValidity("Must be a positive number");
      } else {
        input.setCustomValidity("");
      }
    }
  }

  private applyTheme(): void {
    if (this.config.themeTokens) {
      const style = document.createElement("style");
      let css = "";

      for (const [property, value] of Object.entries(this.config.themeTokens)) {
        css += `--myio-${property}: ${value};\n`;
      }

      style.textContent = `.myio-settings-modal { ${css} }`;
      this.container.appendChild(style);
    }
  }

  private getI18nText(key: string, defaultText: string): string {
    return this.config.i18n?.t(key, defaultText) || defaultText;
  }
}
