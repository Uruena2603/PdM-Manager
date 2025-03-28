/**
 * PdM-Manager - JavaScript Gráficos v2.0.0
 * Funciones para la inicialización y actualización de gráficos
 * 
 * Última actualización: 2024-03-29
 */

// ==========================================================================
// VARIABLES GLOBALES PARA GRÁFICOS
// ==========================================================================

// Gráficos
let vibrationChartX = null;
let vibrationChartY = null;
let vibrationChartZ = null;
let alertsHistoryChart = null;

// Datos de los gráficos
let chartData = {
    timestamps: [],
    x: [],
    y: [],
    z: [],
    status: []
};

// ==========================================================================
// INICIALIZACIÓN DE GRÁFICOS
// ==========================================================================

// Inicializar gráficos de vibración (todos los ejes)
function initVibrationChart() {
    initAxisChart('vibrationChartX', 'Vibración Eje X', 'x');
    initAxisChart('vibrationChartY', 'Vibración Eje Y', 'y');
    initAxisChart('vibrationChartZ', 'Vibración Eje Z', 'z');
}

// Inicializar un gráfico de vibración para un eje específico
function initAxisChart(canvasId, title, axis) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    
    // Comprobar si el gráfico ya existe y destruirlo
    if (window[`vibrationChart${axis.toUpperCase()}`]) {
        window[`vibrationChart${axis.toUpperCase()}`].destroy();
    }
    
    // Obtener los límites del estado global
    const stats = getGlobalState('stats');
    const chartOptions = getGlobalState('chartOptions');
    
    // Configuración de colores y opciones
    const chartColors = {
        x: '#FF6384',
        y: '#36A2EB',
        z: '#4BC0C0'
    };
    
    // Conjuntos de datos base
    const datasets = [
        {
            label: `Aceleración eje ${axis.toUpperCase()} (m/s²)`,
            data: chartData[axis],
            borderColor: chartColors[axis],
            borderWidth: 2,
            fill: false,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4
        }
    ];
    
    // Añadir líneas estadísticas si están disponibles y activadas
    if (stats && stats[axis]) {
        // Límites 2-sigma
        if (chartOptions && chartOptions.show2Sigma && stats[axis].sigma2) {
            datasets.push({
                label: `+2σ (${axis.toUpperCase()})`,
                data: Array(chartData.timestamps.length).fill(stats[axis].sigma2.upper),
                borderColor: 'rgba(255, 159, 64, 0.5)',
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            });
            
            datasets.push({
                label: `-2σ (${axis.toUpperCase()})`,
                data: Array(chartData.timestamps.length).fill(stats[axis].sigma2.lower),
                borderColor: 'rgba(255, 159, 64, 0.5)',
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            });
        }
        
        // Límites 3-sigma
        if (chartOptions && chartOptions.show3Sigma && stats[axis].sigma3) {
            datasets.push({
                label: `+3σ (${axis.toUpperCase()})`,
                data: Array(chartData.timestamps.length).fill(stats[axis].sigma3.upper),
                borderColor: 'rgba(255, 99, 132, 0.5)',
                borderWidth: 1,
                borderDash: [2, 2],
                pointRadius: 0,
                fill: false
            });
            
            datasets.push({
                label: `-3σ (${axis.toUpperCase()})`,
                data: Array(chartData.timestamps.length).fill(stats[axis].sigma3.lower),
                borderColor: 'rgba(255, 99, 132, 0.5)',
                borderWidth: 1,
                borderDash: [2, 2],
                pointRadius: 0,
                fill: false
            });
        }
    }
    
    // Crear gráfico
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.timestamps,
            datasets: datasets
        },
        options: {
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                title: {
                    display: true,
                    text: title,
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    borderColor: 'white',
                    borderWidth: 1,
                    caretPadding: 5,
                    displayColors: true,
                    callbacks: {
                        afterBody: function(context) {
                            const dataIndex = context[0].dataIndex;
                            const status = chartData.status[dataIndex];
                            let statusText = '';
                            
                            switch(status) {
                                case 0:
                                    statusText = 'Normal';
                                    break;
                                case 1:
                                    statusText = 'Advertencia';
                                    break;
                                case 2:
                                    statusText = 'Alerta';
                                    break;
                                case 3:
                                    statusText = 'Crítico';
                                    break;
                                default:
                                    statusText = 'Desconocido';
                            }
                            
                            return `Estado: ${statusText}`;
                        }
                    }
                },
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        font: {
                            size: 12
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        font: {
                            size: 10
                        },
                        color: '#666'
                    },
                    grid: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Tiempo',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                },
                y: {
                    ticks: {
                        font: {
                            size: 10
                        },
                        color: '#666'
                    },
                    grid: {
                        color: 'rgba(200, 200, 200, 0.1)'
                    },
                    title: {
                        display: true,
                        text: 'Aceleración (g)',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                }
            }
        }
    });
    
    // Guardar referencia
    window[`vibrationChart${axis.toUpperCase()}`] = chart;
    
    return chart;
}

// Actualizar gráfico para eje X
function updateVibrationChartX() {
    if (!vibrationChartX) return;
    updateAxisChart(vibrationChartX, 'x');
}

// Actualizar gráfico para eje Y
function updateVibrationChartY() {
    if (!vibrationChartY) return;
    updateAxisChart(vibrationChartY, 'y');
}

// Actualizar gráfico para eje Z
function updateVibrationChartZ() {
    if (!vibrationChartZ) return;
    updateAxisChart(vibrationChartZ, 'z');
}

// Actualizar gráfico para un eje específico
function updateAxisChart(chart, axis) {
    if (!chart) return;
    
    // Obtener datos actualizados para el eje específico
    const values = chartData[axis]; // Datos del eje específico (x, y o z)
    const timestamps = chartData.timestamps;
    
    // Actualizar datos principales
    chart.data.labels = timestamps;
    chart.data.datasets[0].data = values;
    
    // Obtener estadísticas y opciones de gráfico
    const stats = getGlobalState('stats');
    const chartOptions = getGlobalState('chartOptions') || { show2Sigma: true, show3Sigma: true };
    
    // Eliminar datasets adicionales (líneas estadísticas)
    while (chart.data.datasets.length > 1) {
        chart.data.datasets.pop();
    }
    
    // Añadir líneas estadísticas si están disponibles y activadas
    if (stats && stats[axis]) {
        // Límites 2-sigma (solo si show2Sigma está activo)
        if (chartOptions && chartOptions.show2Sigma && stats[axis].sigma2) {
            chart.data.datasets.push({
                label: `+2σ (${axis.toUpperCase()})`,
                data: Array(timestamps.length).fill(stats[axis].sigma2.upper),
                borderColor: 'rgba(255, 159, 64, 0.5)',
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            });
            
            chart.data.datasets.push({
                label: `-2σ (${axis.toUpperCase()})`,
                data: Array(timestamps.length).fill(stats[axis].sigma2.lower),
                borderColor: 'rgba(255, 159, 64, 0.5)',
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            });
        }
        
        // Límites 3-sigma (solo si show3Sigma está activo)
        if (chartOptions && chartOptions.show3Sigma && stats[axis].sigma3) {
            chart.data.datasets.push({
                label: `+3σ (${axis.toUpperCase()})`,
                data: Array(timestamps.length).fill(stats[axis].sigma3.upper),
                borderColor: 'rgba(255, 99, 132, 0.5)',
                borderWidth: 1,
                borderDash: [2, 2],
                pointRadius: 0,
                fill: false
            });
            
            chart.data.datasets.push({
                label: `-3σ (${axis.toUpperCase()})`,
                data: Array(timestamps.length).fill(stats[axis].sigma3.lower),
                borderColor: 'rgba(255, 99, 132, 0.5)',
                borderWidth: 1,
                borderDash: [2, 2],
                pointRadius: 0,
                fill: false
            });
        }
    }
    
    // Actualizar gráfico
    chart.update();
}

// Inicializar gráfico de historial de alertas
function initAlertsHistoryChart() {
    const canvas = document.getElementById('alertsHistoryChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Si ya existe, destruirlo
    if (alertsHistoryChart) {
        alertsHistoryChart.destroy();
    }
    
    // Preparar datos iniciales
    const labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const datasets = [
        {
            label: 'Nivel 1',
            data: [0, 0, 0, 0, 0, 0, 0],
            backgroundColor: SEVERITY_COLORS[1],
            borderColor: SEVERITY_COLORS[1],
            borderWidth: 1
        },
        {
            label: 'Nivel 2',
            data: [0, 0, 0, 0, 0, 0, 0],
            backgroundColor: SEVERITY_COLORS[2],
            borderColor: SEVERITY_COLORS[2],
            borderWidth: 1
        },
        {
            label: 'Nivel 3',
            data: [0, 0, 0, 0, 0, 0, 0],
            backgroundColor: SEVERITY_COLORS[3],
            borderColor: SEVERITY_COLORS[3],
            borderWidth: 1
        }
    ];
    
    // Crear gráfico
    alertsHistoryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(200, 200, 200, 0.1)'
                    }
                },
                y: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        boxWidth: 12,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
    
    // Cargar datos reales
    fetchAlertsHistoryData();
    
    return alertsHistoryChart;
}

// Cargar datos para el gráfico de historial de alertas
function fetchAlertsHistoryData() {
    // Obtener los datos reales de alertas simplificadas desde el API
    fetch('/api/alerts/simplified')
        .then(response => response.json())
        .then(data => {
            // Agrupar alertas por día de la semana
            const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            const alertsByDay = {
                'Lun': { level1: 0, level2: 0, level3: 0 },
                'Mar': { level1: 0, level2: 0, level3: 0 },
                'Mié': { level1: 0, level2: 0, level3: 0 },
                'Jue': { level1: 0, level2: 0, level3: 0 },
                'Vie': { level1: 0, level2: 0, level3: 0 },
                'Sáb': { level1: 0, level2: 0, level3: 0 },
                'Dom': { level1: 0, level2: 0, level3: 0 }
            };
            
            // Procesar cada alerta
            data.forEach(alert => {
                const date = new Date(alert.timestamp);
                const dayName = days[date.getDay()];
                
                // Determinar el nivel según el error_type o severidad
                // El backend genera valores 0, 1, 2 - se mantiene esta lógica para compatibilidad
                const severity = parseInt(alert.error_type) || parseInt(alert.severity) || 0;
                
                if (severity === 2) {
                    alertsByDay[dayName].level2++;
                } else if (severity === 1) {
                    alertsByDay[dayName].level1++;
                } else {
                    // Para valores desconocidos o 0, se consideran de nivel 1
                    alertsByDay[dayName].level1++;
                }
                
                // Nota: El nivel 3 actualmente no se implementa en el backend
                // Se mantiene la estructura por si se implementa en el futuro
            });
            
            // Extraer datos para las series
            const level1Data = [];
            const level2Data = [];
            const level3Data = [];
            
            // Mantener el orden correcto de los días
            ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].forEach(day => {
                level1Data.push(alertsByDay[day].level1);
                level2Data.push(alertsByDay[day].level2);
                level3Data.push(alertsByDay[day].level3);
            });
            
            updateAlertsHistoryChart(level1Data, level2Data, level3Data);
        })
        .catch(error => {
            console.error('Error al cargar datos de alertas:', error);
            // En caso de error, mostrar datos vacíos
            updateAlertsHistoryChart([0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]);
        });
}

// Actualizar el gráfico de historial de alertas con nuevos datos
function updateAlertsHistoryChart(level1Data, level2Data, level3Data) {
    if (!alertsHistoryChart) return;
    
    alertsHistoryChart.data.datasets[0].data = level1Data;
    alertsHistoryChart.data.datasets[1].data = level2Data;
    alertsHistoryChart.data.datasets[2].data = level3Data;
    
    alertsHistoryChart.update();
}

// ==========================================================================
// ACTUALIZACIÓN DE LÍMITES
// ==========================================================================

// Actualizar gráficos con nuevos límites
function updateChartsWithNewLimits(limits) {
    console.log('Actualizando gráficos con nuevos límites:', limits);
    
    // Actualizar variable global de stats
    if (limits && typeof limits === 'object') {
        try {
            // Actualizar el estado global
            updateGlobalStats(limits);
            
            // Verificar que las variables de los gráficos existen
            if (typeof vibrationChartX === 'undefined' || 
                typeof vibrationChartY === 'undefined' || 
                typeof vibrationChartZ === 'undefined') {
                console.warn('Alguno de los gráficos no está inicializado:', {
                    x: typeof vibrationChartX !== 'undefined',
                    y: typeof vibrationChartY !== 'undefined',
                    z: typeof vibrationChartZ !== 'undefined'
                });
            }
            
            // Actualizar los gráficos inmediatamente
            if (vibrationChartX) {
                updateAxisChartLimits(vibrationChartX, 'x', limits);
                vibrationChartX.update('none'); // Actualizar sin animación para mejor rendimiento
            }
            
            if (vibrationChartY) {
                updateAxisChartLimits(vibrationChartY, 'y', limits);
                vibrationChartY.update('none');
            }
            
            if (vibrationChartZ) {
                updateAxisChartLimits(vibrationChartZ, 'z', limits);
                vibrationChartZ.update('none');
            }
            
            // Actualizar los valores estadísticos mostrados
            if (typeof updateStatisticalDisplayValues === 'function') {
                updateStatisticalDisplayValues();
            }
        } catch (error) {
            console.error('Error al actualizar gráficos con nuevos límites:', error);
        }
    } else {
        console.warn('Límites inválidos o no proporcionados:', limits);
    }
}

// Función auxiliar para actualizar límites en un gráfico específico
function updateAxisChartLimits(chart, axis, limits) {
    if (!chart || !chart.data || !chart.data.datasets || !limits || !limits[axis]) {
        console.warn(`No se pueden actualizar límites para eje ${axis}:`, { 
            chartExists: !!chart, 
            limitsExist: !!limits, 
            axisLimitsExist: limits && !!limits[axis] 
        });
        return;
    }
    
    const chartOptions = getGlobalState('chartOptions') || { show2Sigma: true, show3Sigma: true };
    console.log(`Actualizando límites para eje ${axis}:`, limits[axis]);
    
    // Buscar datasets de límites por su nombre (etiqueta)
    chart.data.datasets.forEach(dataset => {
        // Actualizar límites sigma 2
        if ((dataset.label === `+2σ (${axis.toUpperCase()})` || dataset.label === '+2σ') && chartOptions.show2Sigma) {
            dataset.data = Array(chart.data.labels.length).fill(limits[axis].sigma2.upper);
        }
        if ((dataset.label === `-2σ (${axis.toUpperCase()})` || dataset.label === '-2σ') && chartOptions.show2Sigma) {
            dataset.data = Array(chart.data.labels.length).fill(limits[axis].sigma2.lower);
        }
        
        // Actualizar límites sigma 3
        if ((dataset.label === `+3σ (${axis.toUpperCase()})` || dataset.label === '+3σ') && chartOptions.show3Sigma) {
            dataset.data = Array(chart.data.labels.length).fill(limits[axis].sigma3.upper);
        }
        if ((dataset.label === `-3σ (${axis.toUpperCase()})` || dataset.label === '-3σ') && chartOptions.show3Sigma) {
            dataset.data = Array(chart.data.labels.length).fill(limits[axis].sigma3.lower);
        }
    });
}

// Actualizar la visibilidad de los elementos en los gráficos
function updateChartsVisibility() {
    console.log('Actualizando visibilidad de elementos en gráficos...');
    
    // Obtener estados de los switches
    const show2Sigma = document.getElementById('show2Sigma')?.checked;
    const show3Sigma = document.getElementById('show3Sigma')?.checked;
    
    console.log('Estado de toggles:', { show2Sigma, show3Sigma });
    
    // Actualizar opciones de visualización en el estado global
    const chartOptions = getGlobalState('chartOptions') || {};
    chartOptions.show2Sigma = show2Sigma !== undefined ? show2Sigma : chartOptions.show2Sigma;
    chartOptions.show3Sigma = show3Sigma !== undefined ? show3Sigma : chartOptions.show3Sigma;
    setGlobalState('chartOptions', chartOptions);
    
    console.log('Opciones de gráfico actualizadas:', chartOptions);
    
    // Actualizar todos los gráficos de ejes
    if (typeof vibrationChartX !== 'undefined') {
        updateAxisChartVisibility(vibrationChartX, 'x', chartOptions);
    }
    
    if (typeof vibrationChartY !== 'undefined') {
        updateAxisChartVisibility(vibrationChartY, 'y', chartOptions);
    }
    
    if (typeof vibrationChartZ !== 'undefined') {
        updateAxisChartVisibility(vibrationChartZ, 'z', chartOptions);
    }
}

// Actualizar visibilidad específica de un gráfico de eje
function updateAxisChartVisibility(chart, axis, options) {
    if (!chart || !chart.data || !chart.data.datasets) {
        console.warn(`No se puede actualizar visibilidad del gráfico para eje ${axis}`);
        return;
    }
    
    const chartOptions = options || getGlobalState('chartOptions') || { show2Sigma: true, show3Sigma: true };
    console.log(`Actualizando visibilidad del gráfico para eje ${axis}:`, chartOptions);
    
    // Buscar y actualizar visibilidad de las líneas
    chart.data.datasets.forEach(dataset => {
        // Líneas 2-sigma
        if (dataset.label && dataset.label.includes('2σ')) {
            dataset.hidden = !chartOptions.show2Sigma;
        }
        
        // Líneas 3-sigma
        if (dataset.label && dataset.label.includes('3σ')) {
            dataset.hidden = !chartOptions.show3Sigma;
        }
    });
    
    // Actualizar gráfico
    chart.update();
}

// Exportar funciones para uso global
window.initVibrationChart = initVibrationChart;
window.initAxisChart = initAxisChart;
window.updateVibrationChartX = updateVibrationChartX;
window.updateVibrationChartY = updateVibrationChartY;
window.updateVibrationChartZ = updateVibrationChartZ;
window.updateAxisChart = updateAxisChart;
window.updateAxisChartLimits = updateAxisChartLimits;
window.initAlertsHistoryChart = initAlertsHistoryChart;
window.updateChartsWithNewLimits = updateChartsWithNewLimits;
window.chartData = chartData;
window.stats = getGlobalState('stats');

// Inicializar estado global para opciones de gráficos
document.addEventListener('DOMContentLoaded', function() {
    // Establecer las opciones iniciales de los gráficos
    const show2Sigma = document.getElementById('show2Sigma')?.checked || true; // Por defecto mostrar los límites
    const show3Sigma = document.getElementById('show3Sigma')?.checked || true; // Por defecto mostrar los límites
    
    // Actualizar el estado de los checkboxes si existen en el DOM
    if (document.getElementById('show2Sigma') && show2Sigma !== document.getElementById('show2Sigma').checked) {
        document.getElementById('show2Sigma').checked = show2Sigma;
    }
    
    if (document.getElementById('show3Sigma') && show3Sigma !== document.getElementById('show3Sigma').checked) {
        document.getElementById('show3Sigma').checked = show3Sigma;
    }
    
    // Establecer opciones en el estado global
    setGlobalState('chartOptions', {
        showMean: false,
        show2Sigma: show2Sigma, 
        show3Sigma: show3Sigma
    });
    
    console.log('Opciones de gráficos inicializadas:', getGlobalState('chartOptions'));
}); 