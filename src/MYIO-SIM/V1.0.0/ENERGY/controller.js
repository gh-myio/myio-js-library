self.onInit = function() {
    

    
  // Mock data (pode substituir com telemetria real do ThingsBoard)
  const lineCtx = document.getElementById("lineChart").getContext("2d");
  new Chart(lineCtx, {
    type: "line",
    data: {
      labels: ["00:00","02:00","04:00","06:00","08:00","10:00","12:00","14:00","16:00","18:00","20:00","22:00"],
      datasets: [{
        label: "Consumo Real",
        data: [900,750,650,700,1100,1400,1600,1900,1700,1500,1200,1000],
        borderColor: "#2563eb",
        backgroundColor: "transparent",
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 3
      },{
        label: "Meta",
        data: [850,700,600,680,1000,1300,1500,1800,1600,1400,1150,950],
        borderColor: "#9fc131",
        backgroundColor: "transparent",
        borderWidth: 2,
        borderDash: [5,5],
        tension: 0.3,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });

  const pieCtx = document.getElementById("pieChart").getContext("2d");
  new Chart(pieCtx, {
    type: "doughnut",
    data: {
      labels: ["HVAC 35%","Lojas 25%","Elevadores 15%","Equipamentos 10%","Iluminação 10%","Área Comum 5%"],
      datasets: [{
        data: [35,25,15,10,10,5],
        backgroundColor: ["#3b82f6","#8b5cf6","#f59e0b","#ef4444","#10b981","#a3e635"]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "right",
          labels: { usePointStyle: true }
        }
      },
      cutout: "70%"
    }
  });
  

}
