/* jshint esversion: 11 */
function exportToCSV(reportData, devices) {
  console.log('reportData', reportData);

  if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
    alert('Erro: Nenhum dado disponível para exportar.');
    return;
  }

  const separator = ','; // Pode mudar para ";" se necessário
  const rows = [];

  // Criando cabeçalho dinâmico
  rows.push(['Data', ...devices]);

  // Processando os dados
  reportData.forEach((data) => {
    const row = [data.date, ...devices.map((device) => data[device])];
    rows.push(row);
  });

  // Convertendo para formato CSV
  let csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(separator)).join('\n');

  // Criando link para download
  var encodedUri = encodeURI(csvContent);
  var link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', 'registro-afericao-de-gases.csv');
  document.body.appendChild(link); // Necessário para Firefox

  link.click();
}

function exportToPDF(reportData, devices) {
  const doc = new window.jspdf.jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const purple = [92, 48, 125];

  if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
    alert('Erro: Nenhum dado disponível para exportar.');
    return;
  }

  doc.setFillColor(purple[0], purple[1], purple[2]);
  doc.rect(0, 0, pageWidth, 50, 'F');

  const logoHeight = 25;
  const logoWidth = Math.round(logoHeight * (512 / 194));
  const logoX = 15;
  const logoY = 12;
  doc.addImage(
    'https://dashboard.myio-bas.com/api/images/public/TAfpmF6jEKPDi6hXHbnMUT8MWOHv5lKD',
    'PNG',
    logoX,
    logoY,
    logoWidth,
    logoHeight
  );

  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);

  const textStartX = logoX + logoWidth + 20;
  const availableWidth = pageWidth - textStartX - 15;
  const textCenterX = textStartX + availableWidth / 2;

  doc.text('Sistema Myio | Registro de aferição dos gases medicinais', textCenterX, 15, { align: 'center' });
  doc.text('Complexo Hospitalar Municipal Souza Aguiar', textCenterX, 25, { align: 'center' });
  doc.text(`Data de Expedição: ${new Date().toLocaleDateString('pt-BR')}`, textCenterX, 35, {
    align: 'center',
  });

  const fromDate = new Date(startDate).toLocaleDateString('pt-BR');
  const toDate = new Date(endDate).toLocaleDateString('pt-BR');
  doc.text(`Período de ${fromDate} até ${toDate}`, textCenterX, 45, { align: 'center' });

  let startY = 60;
  const lineHeight = 10;
  const margin = 10;
  const colWidth = (pageWidth - 2 * margin) / (devices.length + 1);

  doc.setFillColor(purple[0], purple[1], purple[2]);
  doc.rect(margin, startY, pageWidth - 2 * margin, lineHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);

  const headers = ['Data', ...devices];
  headers.forEach((header, i) => {
    const textX = margin + i * colWidth + colWidth / 2;
    doc.text(header, textX, startY + 7, { align: 'center' });
  });

  startY += lineHeight;
  doc.setTextColor(0, 0, 0);

  reportData.forEach((data, index) => {
    if (startY > doc.internal.pageSize.height - 20) {
      doc.addPage();
      startY = 20;
    }

    if (index % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(margin, startY, pageWidth - 2 * margin, lineHeight, 'F');
    }

    const rowData = [data.date, ...devices.map((device) => data[device])];

    rowData.forEach((text, i) => {
      const textX = margin + i * colWidth + colWidth / 2;
      doc.text(String(text), textX, startY + 7, { align: 'center' });
    });

    startY += lineHeight;
  });

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Página 1 de 1`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });

  doc.save('registro_gases_medicinais.pdf');
}

async function sendRPCGas(centralId, body) {
  const $http = self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('http'));
  try {
    const response = await $http
      .post(`https://${centralId}.y.myio.com.br/api/rpc/gas_report`, body)
      .toPromise();
    return response;
  } catch (error) {
    console.error('Erro no envio RPC:', error);
    throw error;
  }
}

async function getData() {
  self.ctx.$scope.loading = true;

  if (!startDate || !endDate) {
    alert('Por favor, selecione datas de início e fim.');
    self.ctx.$scope.loading = false;
    return;
  }

  const newEndDate = new Date(endDate.getTime());

  newEndDate.setHours(23); // Set to 23rd hour
  newEndDate.setMinutes(59); // Set to 59th minute
  newEndDate.setSeconds(59); // Set to 59th second
  newEndDate.setMilliseconds(999); // Set to last millisecond

  const { centralId } = self.ctx.settings;
  const body = {
    devices: deviceList,
    dateStart: startDate.toISOString(),
    dateEnd: newEndDate.toISOString(),
  };

  try {
    const gasData = await sendRPCGas(centralId, body);
    //console.log('gasData: ', gasData);

    const processedData = gasData.map((data) => {
      return {
        reading_date: convertToBrazilTime(data.timestamp),
        gas: toFixed(data?.value / 100),
        deviceName: data.deviceName,
      };
    });

    const { transformedData, devices } = transformData(processedData);

    self.ctx.$scope.transformedData = transformedData;
    self.ctx.$scope.devices = devices;
    self.ctx.$scope.displayedColumns = ['date', ...devices]; // Update displayedColumns
    self.ctx.$scope.loading = false;
    self.ctx.detectChanges();
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    alert('Erro ao carregar os dados.');
    self.ctx.$scope.loading = false;
  }
}

function toFixed(value) {
  if (value == null) {
    return value;
  }
  //console.log('tofixed:', value);
  return Number(value).toFixed(2);
}

function insertCurrentDate() {
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('pt-BR');
  const issueDateElement = document.getElementById('issue-date');
  if (issueDateElement) {
    issueDateElement.innerText = formattedDate;
  } else {
    console.warn("Elemento 'issue-date' não encontrado.");
  }
}

function convertToBrazilTime(dateString) {
  const date = new Date(dateString);
  const adjustedDate = new Date(date.getTime());
  const year = adjustedDate.getFullYear();
  const month = String(adjustedDate.getMonth() + 1).padStart(2, '0');
  const day = String(adjustedDate.getDate()).padStart(2, '0');
  const hours = String(adjustedDate.getHours()).padStart(2, '0');
  const minutes = String(adjustedDate.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:00`;
}

let startDate = null;
let endDate = null;

function handleStartDateChange(event) {
  startDate = event.value;
  if (startDate && endDate) {
    getData();
  }
}

function handleEndDateChange(event) {
  endDate = event.value;
  if (startDate && endDate) {
    getData();
  }
}

function transformData(processedData) {
  const groupedData = {};

  processedData.forEach((data) => {
    const date = data.reading_date;
    const deviceName = data.deviceName;
    const gas = data.gas;

    if (!groupedData[date]) {
      groupedData[date] = {};
    }

    groupedData[date][deviceName] = gas;
  });

  const devices = [...new Set(processedData.map((data) => data.deviceName))];
  const transformedData = Object.keys(groupedData).map((date) => {
    const row = { date };
    devices.forEach((device) => {
      row[device] = groupedData[date][device] || '-';
    });
    return row;
  });

  return { transformedData, devices };
}

self.onInit = function () {
  deviceList = self.ctx.datasources.map((datasource) => datasource.entityName);
  insertCurrentDate();

  self.ctx.$scope.handleStartDateChange = handleStartDateChange;
  self.ctx.$scope.handleEndDateChange = handleEndDateChange;
  self.ctx.$scope.startDate = startDate;
  self.ctx.$scope.endDate = endDate;

  self.ctx.$scope.downloadPDF = () => {
    if (self.ctx.$scope.transformedData && self.ctx.$scope.transformedData.length > 0) {
      exportToPDF(self.ctx.$scope.transformedData, self.ctx.$scope.devices);
    } else {
      alert('Sem dados disponíveis para exportar.');
    }
  };
  self.ctx.$scope.downloadCSV = () => {
    if (self.ctx.$scope.transformedData && self.ctx.$scope.transformedData.length > 0) {
      exportToCSV(self.ctx.$scope.transformedData, self.ctx.$scope.devices);
    } else {
      alert('Sem dados disponíveis para exportar.');
    }
  };
  self.ctx.detectChanges();
};

self.onDataUpdated = function () {
  self.ctx.detectChanges();
};
