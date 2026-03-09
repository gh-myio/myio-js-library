/* jshint esversion: 11 */

/*
 GAMBIARRA!!!!!!!!!!!
 PRECISAMOS MUDAR NO DEVICE O CENTRAL ID, MAS ATÉ LÁ, ISSO AQUI
 É A CENTRAL SOUZA MATERNIDADE OF
*/
function normalizeCentralId(centralId) {
  if (centralId === '3fd3b316-e74c-4cc8-a9a0-22ea707fea3a') {
    return 'cea3473b-6e46-4a2f-85b8-f228d2a8347a';
  }

  return centralId;
}

function exportToCSV(reportData) {
  if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
    alert('Erro: Nenhum dado disponível para exportar.');
    return;
  }
  const rows = [['Nome do Dispositivo', 'CO₂', 'Data']];
  let processedData = [];
  reportData.forEach((data, index) => {
    console.log('CSV DATA:', index, data);

    processedData.push({
      deviceName: data.deviceName,
      co2: data.co2,
      reading_date: data.reading_date,
    });
    rows.push([data.deviceName, data.co2, data.reading_date]);
  });
  console.log('CSV ALL DATA:', processedData);
  let csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(';')).join('\n');

  var encodedUri = encodeURI(csvContent);
  var link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', 'dispositivo_co2_horário.csv');
  document.body.appendChild(link); // Required for FF

  link.click();
}

function exportToPDF(reportData) {
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

  doc.text('Sistema Myio | Registro de aferição de CO2', textCenterX, 15, { align: 'center' });
  doc.text('Complexo Hospitalar Municipal Souza Aguiar', textCenterX, 25, { align: 'center' });
  doc.text(`Data de Expedição: ${new Date().toLocaleDateString('pt-BR')} | UNIDADE CER`, textCenterX, 35, {
    align: 'center',
  });

  const fromDate = new Date(startDate).toLocaleDateString('pt-BR');
  const toDate = new Date(endDate).toLocaleDateString('pt-BR');
  doc.text(`Período de ${fromDate} até ${toDate}`, textCenterX, 45, { align: 'center' });

  let startY = 60;
  const lineHeight = 10;
  const margin = 10;
  const colWidth = (pageWidth - 2 * margin) / 3;

  doc.setFillColor(purple[0], purple[1], purple[2]);
  doc.rect(margin, startY, pageWidth - 2 * margin, lineHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);

  const headers = ['Dispositivo', 'CO2 (ppm)', 'Data'];
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

    const rowData = [data.deviceName, data.co2, data.reading_date];

    rowData.forEach((text, i) => {
      const textX = margin + i * colWidth + colWidth / 2; // Centralizar texto na coluna
      doc.text(String(text), textX, startY + 7, { align: 'center' });
    });

    startY += lineHeight;
  });

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Página 1 de 1`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });

  doc.save('registro_gases_medicinais.pdf');
}

async function sendRPCGas(centralIds, body) {
  const $http = self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('http'));

  const results = {};
  for (const centralId of centralIds) {
    const updatedCentralId = normalizeCentralId(centralId);
    console.log({
      original: centralId,
      updated: updatedCentralId,
    });
    try {
      const response = await $http
        .post(`https://${normalizeCentralId(centralId)}.y.myio.com.br/api/rpc/gas_report`, body)
        .toPromise();
      results[centralId] = response;
    } catch (error) {
      console.error(`Erro no envio RPC para ${centralId}:`, error);
      results[centralId] = [];
    }
  }
  return results;
}

function parseDate(dateString) {
  const [datePart, timePart] = dateString.split(' ');
  const [day, month, year] = datePart.split('/');
  const [hours, minutes] = timePart.split(':');

  return new Date(year, month - 1, day, hours, minutes);
}

async function getData() {
  self.ctx.$scope.loading = true;

  if (!startDate || !endDate) {
    alert('Por favor, selecione datas de início e fim.');
    self.ctx.$scope.loading = false;
    return;
  }

  const centralIds = self.ctx.$scope.centralIdList;

  const newEndDate = new Date(endDate.getTime());

  newEndDate.setHours(23); // Set to 23rd hour
  newEndDate.setMinutes(59); // Set to 59th minute
  newEndDate.setSeconds(59); // Set to 59th second
  newEndDate.setMilliseconds(999); // Set to last millisecond

  const body = {
    devices: deviceList,
    dateStart: startDate.toISOString(),
    dateEnd: newEndDate.toISOString(),
  };

  console.log('startdate: ', startDate.toISOString().split('T')[0]);
  console.log('endDate: ', endDate.toISOString().split('T')[0]);

  try {
    const gasDataResponses = await sendRPCGas(centralIds, body);

    let processedData = [];

    for (const [centralId, deviceReadings] of Object.entries(gasDataResponses)) {
      for (const deviceReading of deviceReadings) {
        console.log('ReadingDate: ', convertToBrazilTime(deviceReading.timestamp));

        processedData.push({
          centralId,
          reading_date: convertToBrazilTime(deviceReading.timestamp),
          co2: toFixed(deviceReading?.value),
          deviceName: deviceNameLabelMap[deviceReading.deviceName]
            ? deviceNameLabelMap[deviceReading.deviceName]
            : deviceReading.deviceName,
        });
      }
    }

    // Sort by date first, then by device name, then by time
    processedData = _.orderBy(
      processedData,
      [
        // First by date (YYYY-MM-DD part)
        (item) => parseDate(item.reading_date).toISOString().split('T')[0],
        // Then by device name
        'deviceName',
        // Finally by the full timestamp
        (item) => new Date(item.reading_date).getTime(),
      ],
      ['asc', 'asc', 'asc']
    );

    console.log('Processed data:', processedData);

    self.ctx.$scope.dados = processedData;
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
  // console.log('tofixed:', value);
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
  return `${day}/${month}/${year} ${hours}:${minutes}`;
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

self.onInit = function () {
  deviceList = self.ctx.datasources.map((datasource) => datasource.entityName);
  deviceNameLabelMap = self.ctx.datasources.reduce((acc, datasource) => {
    acc[datasource.entityName.split(' ')[0]] = datasource.entityLabel;

    return acc;
  }, {});

  insertCurrentDate();

  const allCentralIds = self.ctx.data.map((item) => item.data?.[0]?.[1]).filter((id) => id);

  const centralIdList = [...new Set(allCentralIds)];
  console.log('lista centralId: ', centralIdList);
  self.ctx.$scope.centralIdList = centralIdList;
  self.ctx.$scope.handleStartDateChange = handleStartDateChange;
  self.ctx.$scope.handleEndDateChange = handleEndDateChange;
  self.ctx.$scope.startDate = startDate;
  self.ctx.$scope.endDate = endDate;

  self.ctx.$scope.downloadPDF = () => {
    if (self.ctx.$scope.dados && self.ctx.$scope.dados.length > 0) {
      exportToPDF(self.ctx.$scope.dados);
    } else {
      alert('Sem dados disponíveis para exportar.');
    }
  };
  self.ctx.$scope.downloadCSV = () => {
    if (self.ctx.$scope.dados && self.ctx.$scope.dados.length > 0) {
      exportToCSV(self.ctx.$scope.dados);
    } else {
      alert('Sem dados disponíveis para exportar.');
    }
  };
  self.ctx.detectChanges();
};

self.onDataUpdated = function () {
  self.ctx.detectChanges();
};
