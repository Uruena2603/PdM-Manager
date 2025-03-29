/**
 * PdM-Manager - JavaScript Dashboard v2.0.0
 * Funciones específicas para el dashboard principal
 * 
 * Última actualización: 2023-09-15
 */

// ==========================================================================
// VARIABLES GLOBALES DEL DASHBOARD
// ==========================================================================

// Estado del monitoreo
let monitoringInterval = null;
let isMonitoring = false;
let hasValidConfiguration = false;

// ==========================================================================
// INICIALIZACIÓN DEL DASHBOARD
// ==========================================================================

function initDashboard() {
    try {
        // Inicializar componentes de UI y gráficos
        initCustomUIComponents();
        initVisualFilters();
        initExportButtons();
        initAdjustLimitsButton();
        
        // Inicializar nueva funcionalidad de monitoreo
        initMonitoringButton();
        
        // Ocultar gráficos hasta que se carguen datos
        hideCharts();
        
        // Inicializar botones de filtros
        initApplyFiltersButton();
        
        // Leer valores iniciales de filtros
        const initialFilters = getVibrationFilters();
        
        // Establecer valores iniciales en el estado global
        setGlobalState('selectedMachine', initialFilters.machineId || '');
        setGlobalState('selectedSensor', initialFilters.sensorId || '');
        setGlobalState('timeRange', initialFilters.timeRange || '24h');
        
        // Configurar opciones de visualización de gráficos
        setGlobalState('chartOptions', {
            showMean: false,
            show2Sigma: true,
            show3Sigma: true
        });
        
        // Crear objeto para cachear las respuestas (evita llamadas redundantes)
        setGlobalState('dashboardCache', {});
        
        // Mostrar indicador de carga mientras se inicializa
        showLoadingIndicator('Inicializando panel de control...');
        
        // Cargar datos en secuencia para optimizar rendimiento
        Promise.resolve()
            .then(() => {
                // Cargar máquinas primero
                return loadMachines();
            })
            .then(() => {
                // Cargar sensores después de que se hayan cargado las máquinas
                const selectedMachine = getGlobalState('selectedMachine');
                if (selectedMachine) {
                    return loadSensors(selectedMachine);
                }
                return Promise.resolve([]);
            })
            .then(() => {
                // Comprobar si hay una configuración válida antes de cargar datos
                hasValidConfiguration = checkValidConfiguration();
                if (!hasValidConfiguration) {
                    hideLoadingIndicator();
                    showNoConfigurationMessage();
                    return Promise.reject('No hay configuración válida');
                }
                
                // Una vez cargados los datos de configuración, cargar datos del dashboard
                return updateDashboardData();
            })
            .then(() => {
                // Cargar historial de alertas
                loadSimplifiedAlerts();
                
                console.log('Dashboard inicializado correctamente');
                hideLoadingIndicator();
                showToast('Panel de control inicializado', 'success');
            })
            .catch(error => {
                if (error !== 'No hay configuración válida') {
                    console.error('Error al inicializar dashboard:', error);
                    showToast('Error al inicializar el panel', 'error');
                }
                hideLoadingIndicator();
            });
        
    } catch (error) {
        console.error('Error catastrófico al inicializar dashboard:', error);
        showToast('Error crítico al inicializar el panel', 'error');
        hideLoadingIndicator();
    }
}

// Manejar cambios en el estado global
function handleGlobalStateChange(e) {
    const { key, value } = e.detail;
    
    // Actualizaciones basadas en cambios específicos
    if (key === 'selectedMachine' || key === 'selectedSensor' || key === 'timeRange') {
        updateDashboardData();
    } else if (key === 'stats') {
        updateStatisticalDisplayValues();
    } else if (key === 'simulation') {
        if (value.running) {
            startSimulationUpdates();
        } else {
            stopSimulationUpdates();
        }
    }
}

// Inicializar componentes de UI personalizados
function initCustomUIComponents() {
    // Inicializar dropdowns personalizados
    initCustomDropdowns();
    
    // Inicializar colapso de filtros
    initCollapseFilters();
    
    // Inicializar dropdowns de gráficos
    initChartDropdowns();
}

// Inicializar dropdowns personalizados
function initCustomDropdowns() {
    // Suscribirse al evento de cambio de dropdown
    document.addEventListener('dropdown-change', (e) => {
        const { dropdownId, value } = e.detail;
        handleDropdownChange(dropdownId, value);
    });
}

// Manejar cambio en dropdown
function handleDropdownChange(dropdownId, value) {
    switch (dropdownId) {
        case 'machineDropdown':
            setGlobalState('selectedMachine', value);
            // Actualizar lista de sensores si cambia la máquina
            loadSensors(value);
            break;
        case 'sensorDropdown':
            setGlobalState('selectedSensor', value);
            break;
        case 'timeRangeDropdown':
            setGlobalState('timeRange', value);
            break;
    }
}

// Inicializar colapso de filtros
function initCollapseFilters() {
    const expandBtn = document.getElementById('expandFiltersBtn');
    const filterPanel = document.querySelector('.filter-panel');
    const filterCard = document.querySelector('.filter-card');
    
    if (expandBtn && filterPanel) {
        expandBtn.addEventListener('click', () => {
            filterPanel.classList.toggle('show');
            
            // Cambiar icono
            const icon = expandBtn.querySelector('i');
            if (icon) {
                if (filterPanel.classList.contains('show')) {
                    icon.className = 'fas fa-chevron-up';
                    expandBtn.setAttribute('title', 'Minimizar filtros');
                } else {
                    icon.className = 'fas fa-chevron-down';
                    expandBtn.setAttribute('title', 'Expandir filtros');
                }
            }
        });
    }
}

// Inicializar dropdowns en gráficos
function initChartDropdowns() {
    const chartDropdowns = document.querySelectorAll('.chart-dropdown');
    
    chartDropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector('.chart-dropdown-toggle');
        
        if (toggle) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('active');
                
                // Cerrar otros dropdowns abiertos
                chartDropdowns.forEach(otherDropdown => {
                    if (otherDropdown !== dropdown && otherDropdown.classList.contains('active')) {
                        otherDropdown.classList.remove('active');
                    }
                });
            });
        }
    });
    
    // Cerrar dropdowns al hacer clic en cualquier parte
    document.addEventListener('click', () => {
        chartDropdowns.forEach(dropdown => {
            dropdown.classList.remove('active');
        });
    });
}

// Inicializar filtros visuales
function initVisualFilters() {
    // Obtener elementos del DOM
    const show2SigmaToggle = document.getElementById('show2Sigma');
    const show3SigmaToggle = document.getElementById('show3Sigma');
    
    if (show2SigmaToggle && show3SigmaToggle) {
        // Obtener estado actual (o usar valor por defecto)
        const chartOptions = getGlobalState('chartOptions') || {
            show2Sigma: true,
            show3Sigma: true
        };
        
        // Asegurarse de que los toggles reflejen el estado actual
        show2SigmaToggle.checked = chartOptions.show2Sigma;
        show3SigmaToggle.checked = chartOptions.show3Sigma;
        
        // Añadir evento change que actualiza los gráficos en tiempo real
        show2SigmaToggle.addEventListener('change', () => {
            // Actualizar estado global
            const chartOptions = getGlobalState('chartOptions') || {};
            chartOptions.show2Sigma = show2SigmaToggle.checked;
            setGlobalState('chartOptions', chartOptions);
            
            // Actualizar visualización de gráficos inmediatamente
            if (typeof updateChartsVisibility === 'function') {
                updateChartsVisibility();
            }
            
            // Mostrar mensaje de éxito
            const status = show2SigmaToggle.checked ? 'activadas' : 'desactivadas';
            showToast(`Líneas 2σ ${status}`, 'info', 1000);
        });
        
        show3SigmaToggle.addEventListener('change', () => {
            // Actualizar estado global
            const chartOptions = getGlobalState('chartOptions') || {};
            chartOptions.show3Sigma = show3SigmaToggle.checked;
            setGlobalState('chartOptions', chartOptions);
            
            // Actualizar visualización de gráficos inmediatamente
            if (typeof updateChartsVisibility === 'function') {
                updateChartsVisibility();
            }
            
            // Mostrar mensaje de éxito
            const status = show3SigmaToggle.checked ? 'activadas' : 'desactivadas';
            showToast(`Líneas 3σ ${status}`, 'info', 1000);
        });
    }
}

// ==========================================================================
// CARGA Y ACTUALIZACIÓN DE DATOS
// ==========================================================================

// Cargar datos iniciales
function loadInitialData() {
    showLoadingIndicator('Cargando datos iniciales...');
    
    // Cargar máquinas primero
    loadMachines()
        .then(() => {
            // Comprobar si hay una configuración válida
            if (cache.machines && cache.machines.length === 0) {
                hideLoadingIndicator();
                showNoConfigurationMessage();
                return Promise.reject('No hay máquinas configuradas');
            }
            
            // Cargar sensores para la máquina seleccionada (o primera máquina)
            return loadSensors(getGlobalState('selectedMachine'));
        })
        .then(() => {
            // Actualizar datos del dashboard
            return updateDashboardData();
        })
        .catch(error => {
            console.error('Error al cargar datos iniciales:', error);
            if (error !== 'No hay máquinas configuradas') {
                showToast('Error al cargar datos iniciales', 'error');
            }
        })
        .finally(() => {
            hideLoadingIndicator();
        });
}

// Mostrar mensaje de no configuración
function showNoConfigurationMessage() {
    const noConfigMessage = document.getElementById('noConfigurationMessage');
    const chartsContainers = document.querySelectorAll('.chart-container');
    const warningMessage = document.getElementById('configurationWarning');
    
    if (noConfigMessage) {
        noConfigMessage.classList.remove('d-none');
    }
    
    if (warningMessage) {
        warningMessage.classList.remove('d-none');
    }
    
    chartsContainers.forEach(container => {
        if (container.id !== 'noConfigurationMessage') {
            container.classList.add('d-none');
        }
    });
    
    // Desactivar el botón de monitoreo
    const startMonitoringBtn = document.getElementById('startMonitoringBtn');
    if (startMonitoringBtn) {
        startMonitoringBtn.disabled = true;
    }
}

// Ocultar mensaje de no configuración
function hideNoConfigurationMessage() {
    const noConfigMessage = document.getElementById('noConfigurationMessage');
    const chartsContainers = document.querySelectorAll('.chart-container');
    const warningMessage = document.getElementById('configurationWarning');
    
    if (noConfigMessage) {
        noConfigMessage.classList.add('d-none');
    }
    
    if (warningMessage) {
        warningMessage.classList.add('d-none');
    }
    
    chartsContainers.forEach(container => {
        if (container.id !== 'noConfigurationMessage') {
            container.classList.remove('d-none');
        }
    });
    
    // Activar el botón de monitoreo
    const startMonitoringBtn = document.getElementById('startMonitoringBtn');
    if (startMonitoringBtn) {
        startMonitoringBtn.disabled = false;
    }
}

// Cargar lista de máquinas
function loadMachines() {
    return fetch('/api/machines')
        .then(response => response.json())
        .then(machines => {
            // Guardar en caché
            cache.machines = machines;
            
            // Obtener el dropdown de máquinas
            const machineDropdownMenu = document.getElementById('machineDropdownMenu');
            if (!machineDropdownMenu) return;
            
            // Limpiar opciones anteriores, manteniendo la opción "Todas"
            const allOption = machineDropdownMenu.querySelector('.filter-dropdown-item[data-value=""]');
            machineDropdownMenu.innerHTML = '';
            
            if (allOption) {
                machineDropdownMenu.appendChild(allOption);
            } else {
                const newAllOption = document.createElement('div');
                newAllOption.className = 'filter-dropdown-item selected';
                newAllOption.setAttribute('data-value', '');
                newAllOption.textContent = 'Todas las máquinas';
                machineDropdownMenu.appendChild(newAllOption);
            }
            
            // Añadir máquinas al dropdown
            machines.forEach(machine => {
                const option = document.createElement('div');
                option.className = 'filter-dropdown-item';
                option.setAttribute('data-value', machine.machine_id);
                option.textContent = machine.name;
                machineDropdownMenu.appendChild(option);
            });
            
            // Si hay máquinas y no hay selección previa, seleccionar la primera
            if (machines.length > 0 && !getGlobalState('selectedMachine')) {
                setGlobalState('selectedMachine', machines[0].machine_id);
                
                // Actualizar texto del dropdown
                const machineDropdownText = document.getElementById('selectedMachineText');
                if (machineDropdownText) {
                    machineDropdownText.textContent = machines[0].name;
                }
            }
        })
        .catch(error => {
            console.error('Error al cargar máquinas:', error);
            return Promise.reject(error);
        });
}

// Cargar sensores para una máquina
function loadSensors(machineId) {
    // Si no hay máquina seleccionada y hay máquinas disponibles, seleccionar la primera
    if (!machineId && cache.machines && cache.machines.length > 0) {
        machineId = cache.machines[0].machine_id;
        setGlobalState('selectedMachine', machineId);
    }
    
    // Si no hay máquina, detener
    if (!machineId) {
        return Promise.resolve([]);
    }
    
    // Si ya tenemos los sensores en caché, usarlos
    if (cache.sensors[machineId]) {
        updateSensorDropdown(cache.sensors[machineId]);
        return Promise.resolve(cache.sensors[machineId]);
    }
    
    // Obtener sensores de la API
    return fetch(`/api/machines/${machineId}/sensors`)
        .then(response => response.json())
        .then(sensors => {
            // Guardar en caché
            cache.sensors[machineId] = sensors;
            
            // Actualizar dropdown
            updateSensorDropdown(sensors);
            
            return sensors;
        });
}

// Actualizar dropdown de sensores
function updateSensorDropdown(sensors) {
    // Obtener el dropdown de sensores
    const sensorDropdownMenu = document.getElementById('sensorDropdownMenu');
    const sensorDropdownText = document.getElementById('selectedSensorText');
    
    if (!sensorDropdownMenu || !sensorDropdownText) return;
    
    // Limpiar opciones anteriores
    sensorDropdownMenu.innerHTML = '';
    
    // Si no hay sensores, mostrar mensaje
    if (!sensors || sensors.length === 0) {
        const noSensorsItem = document.createElement('li');
        noSensorsItem.className = 'filter-dropdown-item disabled';
        noSensorsItem.textContent = 'No hay sensores disponibles';
        sensorDropdownMenu.appendChild(noSensorsItem);
        
        sensorDropdownText.textContent = 'Sin sensores';
        setGlobalState('selectedSensor', '');
        return;
    }
    
    // Añadir sensores al dropdown
    sensors.forEach(sensor => {
        const sensorItem = document.createElement('li');
        sensorItem.className = 'filter-dropdown-item';
        sensorItem.dataset.value = sensor.sensor_id;
        sensorItem.textContent = sensor.sensor_name;
        
        sensorItem.addEventListener('click', () => {
            // Actualizar texto visible
            sensorDropdownText.textContent = sensor.sensor_name;
            
            // Cerrar dropdown
            sensorDropdownMenu.classList.remove('show');
            
            // Actualizar variable global
            setGlobalState('selectedSensor', sensor.sensor_id);
        });
        
        sensorDropdownMenu.appendChild(sensorItem);
    });
    
    // Seleccionar el primer sensor si no hay uno seleccionado o si el seleccionado no existe
    const selectedSensor = getGlobalState('selectedSensor');
    const sensorExists = sensors.some(s => s.sensor_id === selectedSensor);
    
    if (!selectedSensor || !sensorExists) {
        // Seleccionar el primer sensor
        const firstSensor = sensors[0];
        setGlobalState('selectedSensor', firstSensor.sensor_id);
        sensorDropdownText.textContent = firstSensor.sensor_name;
    } else {
        // Mantener la selección actual y actualizar el texto
        const sensor = sensors.find(s => s.sensor_id === selectedSensor);
        sensorDropdownText.textContent = sensor.sensor_name;
    }
}

// Actualizar datos del dashboard
function updateDashboardData() {
    showLoadingIndicator('Actualizando dashboard...');
    
    // Obtener filtros actuales
    const selectedMachine = getGlobalState('selectedMachine');
    const selectedSensor = getGlobalState('selectedSensor');
    const timeRange = getGlobalState('timeRange');
    
    // Construir objeto de filtros
    const filters = {
        sensor_id: selectedSensor || '',
        machine_id: selectedMachine || '',
        time_range: timeRange || '24h'
    };
    
    // Generar clave para el caché
    const cacheKey = `dashboard_${filters.sensor_id}_${filters.machine_id}_${filters.time_range}`;
    const dashboardCache = getGlobalState('dashboardCache') || {};
    
    // Verificar si hay datos en caché y si son recientes (menos de 30 segundos)
    const cachedData = dashboardCache[cacheKey];
    const now = Date.now();
    if (cachedData && (now - cachedData.timestamp < 30000)) {
        console.log('Usando datos en caché para el dashboard');
        processVibrationData(cachedData.data);
        updateAlertCounters(cachedData.alerts);
        hideLoadingIndicator();
        return Promise.resolve(cachedData);
    }
    
    // Si no hay datos en caché o son antiguos, obtener nuevos datos
    return fetch(`/api/vibration-data?${new URLSearchParams(filters)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al obtener datos de vibración: ${response.status}`);
            }
            return response.json();
        })
        .then(vibrationData => {
            // Si no hay datos, mostrar mensaje apropiado
            if (!vibrationData || vibrationData.length === 0) {
                hideCharts();
                showNoConfigurationMessage();
                hideLoadingIndicator();
                return Promise.reject('No hay datos disponibles');
            }
            
            // Mostrar gráficos si estaban ocultos
            showCharts();
            hideNoConfigurationMessage();
            
            // Procesar datos de vibración
            processVibrationData(vibrationData);
            
            // Cargar alertas correspondientes a estos mismos filtros
            return fetch(`/api/alerts?${new URLSearchParams(filters)}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Error al obtener alertas: ${response.status}`);
                    }
                    return response.json();
                })
                .then(alertData => {
                    // Actualizar contadores de alertas
                    updateAlertCounters(alertData);
                    
                    // Guardar en caché
                    const newCacheData = {
                        data: vibrationData,
                        alerts: alertData,
                        timestamp: now
                    };
                    
                    // Actualizar caché global
                    dashboardCache[cacheKey] = newCacheData;
                    setGlobalState('dashboardCache', dashboardCache);
                    
                    hideLoadingIndicator();
                    return {
                        vibrationData,
                        alertData
                    };
                });
        })
        .catch(error => {
            console.error('Error al actualizar dashboard:', error);
            if (error !== 'No hay datos disponibles') {
                showToast('Error al cargar datos del dashboard', 'error');
            }
            hideLoadingIndicator();
            return Promise.reject(error);
        });
}

// Función para verificar si hay una configuración válida
function checkValidConfiguration() {
    const cache = getGlobalState('dashboardCache') || {};
    
    // Verificar si hay al menos una máquina con sensor asignado
    if (!cache.machines || cache.machines.length === 0) {
        return false;
    }
    
    // Verificar que al menos una máquina tenga sensor y que el sensor tenga modelo
    let hasValidSetup = false;
    
    // Obtener datos de sensores desde el caché
    const sensors = cache.sensors || {};
    
    // Verificar cada máquina para encontrar una configuración válida
    for (const machine of cache.machines) {
        if (machine.sensor_id) {
            // Buscar información del sensor para esta máquina
            if (sensors[machine.sensor_id] && sensors[machine.sensor_id].model_id) {
                hasValidSetup = true;
                break;
            }
        }
    }
    
    return hasValidSetup;
}

// Procesamiento de datos de vibración actualizado
function processVibrationData(vibrationData) {
    if (!vibrationData || vibrationData.length === 0) {
        console.warn('No hay datos de vibración para procesar');
        return;
    }
    
    console.log('Procesando datos de vibración:', vibrationData.length);
    
    // Asegurarse de que los datos estén ordenados por timestamp
    vibrationData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Actualizar datos de gráficos
    chartData.timestamps = vibrationData.map(item => new Date(item.date).toLocaleTimeString());
    
    // Preparar datos para cada eje
    chartData.x = vibrationData.map(item => item.acceleration_x !== undefined ? parseFloat(item.acceleration_x) : null);
    chartData.y = vibrationData.map(item => item.acceleration_y !== undefined ? parseFloat(item.acceleration_y) : null);
    chartData.z = vibrationData.map(item => item.acceleration_z !== undefined ? parseFloat(item.acceleration_z) : null);
    chartData.status = vibrationData.map(item => item.severity !== undefined ? parseInt(item.severity) : 0);
    
    console.log('Datos procesados para gráficas', {
        timestamps: chartData.timestamps.length,
        x: chartData.x.length,
        y: chartData.y.length,
        z: chartData.z.length
    });
}

// Obtener texto según la severidad
function getSeverityText(severity) {
    switch (parseInt(severity)) {
        case 0:
            return 'Normal';
        case 1:
            return 'Alerta Nivel 1';
        case 2:
            return 'Alerta Nivel 2';
        case 3:
            return 'Crítico (Nivel 3)';
        default:
            return 'Normal';
    }
}

// Mostrar alerta crítica
function showCriticalAlert() {
    // Solo mostrar la alerta si no estamos en modo silencioso
    const isSilent = localStorage.getItem('silentAlerts') === 'true';
    
    if (!isSilent) {
        // Crear elemento de alerta crítica
        const alertEl = document.createElement('div');
        alertEl.className = 'critical-alert-popup';
        alertEl.innerHTML = `
            <div class="critical-alert-content">
                <div class="alert-icon">
                    <i class="fas fa-radiation-alt fa-pulse"></i>
                </div>
                <div class="alert-message">
                    <h3>¡Alerta Crítica!</h3>
                    <p>Se ha detectado un nivel crítico de vibración (Nivel 3).</p>
                    <p>Se recomienda revisión inmediata del equipo.</p>
                </div>
                <button class="alert-close-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Agregar a la página
        document.body.appendChild(alertEl);
        
        // Efecto de entrada
        setTimeout(() => {
            alertEl.classList.add('show');
        }, 100);
        
        // Configurar botón de cierre
        const closeBtn = alertEl.querySelector('.alert-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                alertEl.classList.remove('show');
                setTimeout(() => {
                    alertEl.remove();
                }, 300);
            });
        }
        
        // Reproducir sonido de alerta
        playAlertSound();
        
        // Auto-cerrar después de 10 segundos
        setTimeout(() => {
            if (alertEl.parentNode) {
                alertEl.classList.remove('show');
                setTimeout(() => {
                    if (alertEl.parentNode) {
                        alertEl.remove();
                    }
                }, 300);
            }
        }, 10000);
    }
}

// Reproducir sonido de alerta
function playAlertSound() {
    const isMuted = localStorage.getItem('muteAlerts') === 'true';
    
    if (!isMuted) {
        try {
            const audio = new Audio('/static/audio/alert.mp3');
            audio.volume = 0.5;
            audio.play();
        } catch (e) {
            console.warn('No se pudo reproducir el sonido de alerta:', e);
        }
    }
}

// Inicializar botón de monitoreo
function initMonitoringButton() {
    console.log('Inicializando botón de monitoreo...');
    const startMonitoringBtn = document.getElementById('startMonitoringBtn');
    
    if (!startMonitoringBtn) {
        console.error('Error: No se encontró el botón de monitoreo');
        return;
    }
    
    // Estado actual del monitoreo
    const updateButtonState = () => {
        const monitoringStatus = document.getElementById('monitoringStatus');
        const statusText = monitoringStatus ? monitoringStatus.querySelector('.status-text') : null;
        const statusIndicator = monitoringStatus ? monitoringStatus.querySelector('.status-indicator') : null;
        
        if (isMonitoring) {
            startMonitoringBtn.innerHTML = '<i class="fas fa-stop-circle mr-2"></i> Detener Monitoreo';
            startMonitoringBtn.classList.remove('btn-primary');
            startMonitoringBtn.classList.add('btn-danger');
            
            if (statusText) statusText.textContent = 'Monitoreo activo';
            if (statusIndicator) statusIndicator.classList.add('active');
        } else {
            startMonitoringBtn.innerHTML = '<i class="fas fa-play-circle mr-2"></i> Iniciar Monitoreo';
            startMonitoringBtn.classList.remove('btn-danger');
            startMonitoringBtn.classList.add('btn-primary');
            
            if (statusText) statusText.textContent = 'Monitoreo detenido';
            if (statusIndicator) statusIndicator.classList.remove('active');
        }
    };
    
    // Verificar si hay una configuración válida
    checkValidConfiguration().then(isValid => {
        hasValidConfiguration = isValid;
        
        // Mostrar advertencia si no hay configuración válida
        const configWarning = document.getElementById('configurationWarning');
        if (configWarning) {
            if (!hasValidConfiguration) {
                configWarning.classList.remove('d-none');
            } else {
                configWarning.classList.add('d-none');
            }
        }
        
        // Actualizar estado inicial del botón
        updateButtonState();
    });
    
    // Evento de clic para iniciar/detener monitoreo
    startMonitoringBtn.addEventListener('click', () => {
        if (!hasValidConfiguration) {
            showToast('Configure al menos una máquina con sensor y modelo para iniciar el monitoreo', 'warning');
            
            // Ofrecer ir a configuración
            if (confirm('¿Desea ir a la sección de configuración para configurar una máquina?')) {
                navigateTo('configuracion');
            }
            return;
        }
        
        if (isMonitoring) {
            // Detener monitoreo
            stopMonitoring();
            showToast('Monitoreo detenido', 'info');
        } else {
            // Iniciar monitoreo
            startMonitoring();
            showToast('Monitoreo iniciado', 'success');
        }
        
        // Actualizar estado del botón
        updateButtonState();
    });
}

// Iniciar monitoreo
function startMonitoring() {
    if (monitoringInterval !== null) {
        clearInterval(monitoringInterval);
    }
    
    // Realizar una actualización inmediata
    updateDashboardData();
    
    // Establecer intervalo de actualización (cada 5 segundos)
    monitoringInterval = setInterval(() => {
        updateDashboardData();
    }, 5000);
    
    // Actualizar estado
    isMonitoring = true;
    
    showToast('Monitoreo iniciado correctamente', 'success');
}

// Detener monitoreo
function stopMonitoring() {
    if (monitoringInterval !== null) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
    
    // Actualizar estado
    isMonitoring = false;
    
    showToast('Monitoreo detenido', 'info');
}

// ==========================================================================
// CONTADORES Y VALORES ESTADÍSTICOS
// ==========================================================================

// Actualizar contadores de alertas
function updateAlertCounters(alerts) {
    // Actualizar contadores en las tarjetas de alerta
    document.getElementById('level1Count').textContent = alerts.level1 || 0;
    document.getElementById('level2Count').textContent = alerts.level2 || 0;
    document.getElementById('level3Count').textContent = alerts.level3 || 0;
    document.getElementById('totalCount').textContent = 
        (alerts.level1 || 0) + (alerts.level2 || 0) + (alerts.level3 || 0);
}

// Actualizar valores de parámetros estadísticos
function updateStatisticalDisplayValues() {
    console.log('Actualizando valores estadísticos en la interfaz...');
    
    // Obtener estadísticas del estado global
    const stats = getGlobalState('stats');
    
    if (!stats) {
        console.warn('No hay estadísticas disponibles en el estado global');
        return;
    }
    
    try {
        // Formato para valores numéricos
        const formatValue = (value) => value.toFixed(2);
        
        // Actualizar todos los ejes de forma consistente
        ['x', 'y', 'z'].forEach(axis => {
            if (!stats[axis]) {
                console.warn(`No hay datos para el eje ${axis.toUpperCase()}`);
                return;
            }
            
            // Actualizar límites 2-sigma
            if (stats[axis].sigma2) {
                updateDisplayValue(
                    `${axis}2SigmaLowerDisplay`, 
                    formatValue(stats[axis].sigma2.lower)
                );
                
                updateDisplayValue(
                    `${axis}2SigmaUpperDisplay`, 
                    formatValue(stats[axis].sigma2.upper)
                );
            }
            
            // Actualizar límites 3-sigma
            if (stats[axis].sigma3) {
                updateDisplayValue(
                    `${axis}3SigmaLowerDisplay`, 
                    formatValue(stats[axis].sigma3.lower)
                );
                
                updateDisplayValue(
                    `${axis}3SigmaUpperDisplay`, 
                    formatValue(stats[axis].sigma3.upper)
                );
            }
        });
        
        // Añadir animación para destacar cambios
        const statValues = document.querySelectorAll('.stat-value');
        statValues.forEach(el => {
            el.classList.add('value-updated');
            setTimeout(() => {
                el.classList.remove('value-updated');
            }, 1000);
        });
        
        console.log('Valores estadísticos actualizados correctamente');
    } catch (error) {
        console.error('Error al actualizar valores estadísticos:', error);
    }
    
    // Función auxiliar para actualizar un único elemento
    function updateDisplayValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `${value}<span class="stat-unit">m/s²</span>`;
        } else {
            console.warn(`Elemento no encontrado: ${elementId}`);
        }
    }
}

// ==========================================================================
// BOTONES Y ACCIONES
// ==========================================================================

// Inicializar botones de exportación
function initExportButtons() {
    // Exportación a PDF para cada eje
    const exportPdfXBtn = document.getElementById('exportPdfX');
    if (exportPdfXBtn) {
        exportPdfXBtn.addEventListener('click', () => {
            exportAxisToPDF('x');
        });
    }
    
    const exportPdfYBtn = document.getElementById('exportPdfY');
    if (exportPdfYBtn) {
        exportPdfYBtn.addEventListener('click', () => {
            exportAxisToPDF('y');
        });
    }
    
    const exportPdfZBtn = document.getElementById('exportPdfZ');
    if (exportPdfZBtn) {
        exportPdfZBtn.addEventListener('click', () => {
            exportAxisToPDF('z');
        });
    }
}

// Exportar datos de un eje a PDF
function exportAxisToPDF(axis) {
    // Mostrar indicador de carga
    showLoadingIndicator(`Generando PDF para eje ${axis.toUpperCase()}...`);
    
    // Obtener información del sensor y máquina seleccionados
    const machineId = getGlobalState('selectedMachine');
    const sensorId = getGlobalState('selectedSensor');
    const timeRange = getGlobalState('timeRange');
    
    // Verificar que hay datos para exportar
    if (!machineId || !sensorId) {
        showToast('Seleccione una máquina y un sensor para exportar datos', 'warning');
        hideLoadingIndicator();
        return;
    }
    
    try {
        // Preparar datos para el reporte
        // Capturar el gráfico como imagen base64
        const canvas = document.getElementById(`vibrationChart${axis.toUpperCase()}`);
        if (!canvas) {
            throw new Error(`No se encuentra el gráfico para el eje ${axis.toUpperCase()}`);
        }
        
        const imageData = canvas.toDataURL('image/png');
        
        // Obtener límites y estadísticas actuales
        const limits = getGlobalState('limits') || {};
        const stats = getGlobalState('stats') || {};
        
        // Preparar datos para enviar al servidor
        const reportData = {
            imageData,
            axis: axis.toUpperCase(),
            machineId,
            sensorId,
            timeRange,
            limits: limits[axis] || {},
            stats: stats[axis] || {},
            timestamp: new Date().toISOString()
        };
        
        // Enviar datos al servidor para generar PDF
        fetch('/api/export/axis-pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(reportData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al generar PDF');
            }
            return response.blob();
        })
        .then(blob => {
            // Crear URL para descargar el PDF
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `reporte-vibracion-eje-${axis}-${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            
            // Mostrar mensaje de éxito
            showToast(`PDF para eje ${axis.toUpperCase()} generado correctamente`, 'success');
        })
        .catch(error => {
            console.error('Error al capturar gráfico:', error);
            showToast('Error al preparar datos para PDF', 'error');
            hideLoadingIndicator();
        });
    } catch (error) {
        console.error('Error al capturar gráfico:', error);
        showToast('Error al preparar datos para PDF', 'error');
        hideLoadingIndicator();
    }
}

// Inicializar botón de ajuste de límites
function initAdjustLimitsButton() {
    const adjustLimitsBtn = document.getElementById('adjustLimitsBtn');
    
    if (adjustLimitsBtn) {
        adjustLimitsBtn.addEventListener('click', (event) => {
            event.preventDefault();
            console.log('Redirigiendo a configuración de límites');
            
            // Usar navigateTo para la redirección
            if (typeof navigateTo === 'function') {
                navigateTo('configuracion:limites');
            } else {
                // Fallback directo si navigateTo no está disponible
                window.location.hash = 'configuracion:limites';
            }
        });
    }
    
    // Eliminado código redundante de manejo modal
    // El modal de límites ahora se maneja solo en la sección de configuración
}

// Inicializar botón de aplicar filtros
function initApplyFiltersButton() {
    console.log('Inicializando botón de filtros...');
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    
    if (!applyFiltersBtn) {
        console.error('Error: No se encontró el botón de aplicar filtros');
        return;
    }
    
    // Evento de clic para aplicar filtros
    applyFiltersBtn.addEventListener('click', () => {
        // Leer valores de los filtros desde los elementos del DOM
        const selectedMachine = document.getElementById('selectedMachineText').getAttribute('data-value') || '';
        const selectedSensor = document.getElementById('selectedSensorText').getAttribute('data-value') || '';
        const selectedTimeRange = document.getElementById('selectedTimeRangeText').getAttribute('data-value') || '24h';
        
        // Actualizar estado global con los valores de los filtros
        setGlobalState('selectedMachine', selectedMachine);
        setGlobalState('selectedSensor', selectedSensor);
        setGlobalState('timeRange', selectedTimeRange);
        
        // Actualizar las opciones de visualización
        const show2Sigma = document.getElementById('show2Sigma').checked;
        const show3Sigma = document.getElementById('show3Sigma').checked;
        
        setGlobalState('chartOptions', {
            show2Sigma,
            show3Sigma
        });
        
        // Actualizar datos del dashboard con los nuevos filtros
        updateDashboardData();
        
        // Mostrar notificación
        showToast('Filtros aplicados correctamente', 'success');
    });
    
    // Inicializar dropdowns
    initDashboardDropdowns();
}

// Inicializar dropdowns personalizados
function initDashboardDropdowns() {
    // Dropdown de máquinas
    initDropdown('machineDropdown', (value, text) => {
        // Cargar sensores cuando se selecciona una máquina
        if (value !== undefined) {
            loadSensors(value);
        }
    });
    
    // Dropdown de sensores
    initDropdown('sensorDropdown');
    
    // Dropdown de rango de tiempo
    initDropdown('timeRangeDropdown');
}

// Inicializar un dropdown específico
function initDropdown(dropdownId, callback) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    
    const toggle = dropdown.querySelector('.filter-dropdown-toggle');
    const menu = dropdown.querySelector('.filter-dropdown-menu');
    const selectedText = dropdown.querySelector('span[id$="Text"]');
    
    if (!toggle || !menu || !selectedText) return;
    
    // Toggle del menú
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('show');
        
        // Cerrar otros dropdowns abiertos
        document.querySelectorAll('.filter-dropdown-menu.show').forEach(openMenu => {
            if (openMenu !== menu) {
                openMenu.classList.remove('show');
            }
        });
    });
    
    // Selección de items
    const items = menu.querySelectorAll('.filter-dropdown-item');
    items.forEach(item => {
        item.addEventListener('click', () => {
            // Obtener valor seleccionado
            const value = item.getAttribute('data-value');
            const text = item.textContent;
            
            // Actualizar texto visible
            selectedText.textContent = text;
            selectedText.setAttribute('data-value', value);
            
            // Marcar item seleccionado
            items.forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            
            // Cerrar dropdown
            menu.classList.remove('show');
            
            // Ejecutar callback si existe
            if (typeof callback === 'function') {
                callback(value, text);
            }
        });
    });
    
    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
            menu.classList.remove('show');
        }
    });
}

// ==========================================================================
// SIMULACIÓN (PARA ACTUALIZACIÓN AUTOMÁTICA)
// ==========================================================================

// Comprobar estado de simulación
function checkSimulationStatus() {
    fetch('/api/simulation/status')
        .then(response => response.json())
        .then(data => {
            if (data.running) {
                // Actualizar estado global
                setGlobalState('simulation', {
                    running: true,
                    timer: getGlobalState('simulation').timer
                });
            }
        })
        .catch(error => {
            console.error('Error al comprobar estado de simulación:', error);
        });
}

// Iniciar actualizaciones automáticas por simulación
function startSimulationUpdates() {
    // Establecer un temporizador para actualizar cada 10 segundos
    const timer = setInterval(() => {
        updateDashboardData();
    }, 10000);
    
    // Guardar el temporizador
    setGlobalState('simulation', {
        running: true,
        timer: timer
    });
}

// Detener actualizaciones automáticas por simulación
function stopSimulationUpdates() {
    const simulation = getGlobalState('simulation');
    
    // Detener el temporizador si existe
    if (simulation.timer) {
        clearInterval(simulation.timer);
    }
    
    // Actualizar estado
    setGlobalState('simulation', {
        running: false,
        timer: null
    });
}

// ==========================================================================
// TABLA DE ALERTAS SIMPLIFICADA
// ==========================================================================

// Cargar alertas simplificadas
function loadSimplifiedAlerts() {
    showLoadingIndicator('Cargando alertas...');
    
    // Aplicar filtros globales si están disponibles
    const selectedMachine = getGlobalState('selectedMachine');
    const selectedSensor = getGlobalState('selectedSensor');
    const timeRange = getGlobalState('timeRange');
    
    // Construir URL con filtros
    let url = '/api/alerts?';
    
    if (selectedSensor) {
        url += `sensor_id=${selectedSensor}&`;
    } else if (selectedMachine) {
        url += `machine_id=${selectedMachine}&`;
    }
    
    // Añadir filtro de tiempo si está seleccionado
    if (timeRange) {
        const currentTime = new Date();
        let startTime = new Date(currentTime);
        
        switch(timeRange) {
            case '1h':
                startTime.setHours(currentTime.getHours() - 1);
                break;
            case '6h':
                startTime.setHours(currentTime.getHours() - 6);
                break;
            case '24h':
                startTime.setDate(currentTime.getDate() - 1);
                break;
            case '7d':
                startTime.setDate(currentTime.getDate() - 7);
                break;
        }
        
        url += `start_date=${startTime.toISOString()}&end_date=${currentTime.toISOString()}&`;
    }
    
    // Eliminar el último '&' si existe
    if (url.endsWith('&')) {
        url = url.slice(0, -1);
    }
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error en la respuesta: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Actualizar contadores de alertas
            updateAlertCounters(data);
            
            // Actualizar tabla de alertas con los datos obtenidos
            updateAlertsTable(data);
            hideLoadingIndicator();
        })
        .catch(err => {
            console.error('Error al cargar alertas:', err);
            hideLoadingIndicator();
            showToast('Error al cargar historial de alertas', 'error');
        });
}

// Actualizar tabla de alertas
function updateAlertsTable(alerts) {
    const tableBody = document.getElementById('alertsTableBody');
    if (!tableBody) return;
    
    // Limpiar tabla
    tableBody.innerHTML = '';
    
    // Si no hay alertas, mostrar mensaje
    if (!alerts || alerts.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5; // Actualizado a 5 columnas
        cell.textContent = 'No hay alertas registradas';
        cell.className = 'text-center';
        return;
    }
    
    // Agregar filas de alertas
    for (const alert of alerts) {
        const row = tableBody.insertRow();
        
        // Determinar el nivel de alerta y aplicar clase según el error_type numérico
        const errorType = parseInt(alert.error_type);
        switch (errorType) {
            case 3:
                row.classList.add('level-3');
                break;
            case 2:
                row.classList.add('level-2');
                break;
            case 1:
                row.classList.add('level-1');
                break;
            default:
                row.classList.add('level-1');
        }
        
        // ID
        const idCell = row.insertCell();
        idCell.textContent = alert.log_id;
        idCell.className = 'column-id';
        
        // Sensor ID
        const sensorCell = row.insertCell();
        sensorCell.textContent = alert.sensor_id;
        
        // Fecha y hora
        const timestampCell = row.insertCell();
        const date = new Date(alert.timestamp);
        timestampCell.textContent = date.toLocaleString();
        timestampCell.className = 'column-datetime';
        
        // Data ID
        const dataIdCell = row.insertCell();
        if (alert.data_id) {
            // Si hay data_id, mostrar como un enlace para ver detalles
            dataIdCell.innerHTML = `<a href="#" class="view-vibration-data" data-alert-id="${alert.log_id}" data-id="${alert.data_id}">${alert.data_id}</a>`;
        } else {
            dataIdCell.textContent = 'N/A';
        }
        
        // Tipo de Error
        const errorTypeCell = row.insertCell();
        const severityText = getSeverityText(errorType);
        errorTypeCell.innerHTML = `<span class="status-level${errorType}">${severityText}</span>`;
    }
    
    // Añadir manejadores de eventos para ver datos de vibración
    const vibrationLinks = document.querySelectorAll('.view-vibration-data');
    vibrationLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const alertId = link.getAttribute('data-alert-id');
            const dataId = link.getAttribute('data-id');
            viewAlertDetails(alertId, dataId);
        });
    });
    
    // Inicializar el botón de actualizar
    const refreshBtn = document.getElementById('refreshAlertsTable');
    if (refreshBtn) {
        refreshBtn.removeEventListener('click', loadSimplifiedAlerts);
        refreshBtn.addEventListener('click', loadSimplifiedAlerts);
    }
}

// Actualizar contadores de alertas en el dashboard
function updateDashboardAlertCounts() {
    // Obtener los filtros actuales
    const selectedMachine = getGlobalState('selectedMachine');
    const selectedSensor = getGlobalState('selectedSensor');
    
    if (!selectedMachine || !selectedSensor) {
        // Si no hay selección, mostrar 0 en todos los contadores
        document.getElementById('level1Count').textContent = '0';
        document.getElementById('level2Count').textContent = '0';
        document.getElementById('level3Count').textContent = '0';
        document.getElementById('totalCount').textContent = '0';
        return;
    }
    
    // Realizar petición para obtener los contadores según los filtros
    fetch(`/api/alerts/count?machine_id=${selectedMachine}&sensor_id=${selectedSensor}`)
        .then(response => response.json())
        .then(data => {
            // Actualizar contadores en la UI
            document.getElementById('level1Count').textContent = data.level1 || '0';
            document.getElementById('level2Count').textContent = data.level2 || '0';
            document.getElementById('level3Count').textContent = data.level3 || '0';
            document.getElementById('totalCount').textContent = data.total || '0';
        })
        .catch(error => {
            console.error('Error al actualizar contadores de alertas:', error);
        });
}

// Obtener filtros actuales para los datos de vibración
function getVibrationFilters() {
    return {
        machine_id: getGlobalState('selectedMachine'),
        sensor_id: getGlobalState('selectedSensor'),
        timeRange: getGlobalState('timeRange')
    };
}

// Ocultar gráficos hasta que se apliquen filtros
function hideCharts() {
    const chartContainers = document.querySelectorAll('.charts-container .chart-container');
    chartContainers.forEach(container => {
        container.style.display = 'none';
    });
}

// Mostrar gráficos después de aplicar filtros
function showCharts() {
    const chartContainers = document.querySelectorAll('.charts-container .chart-container');
    chartContainers.forEach(container => {
        container.style.display = 'block';
    });
}

// Mostrar un modal con contenido dinámico
function showModal(title, content) {
    // Crear el HTML del modal
    const modalHtml = `
        <div class="modal" id="dynamicModal">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${title}</h5>
                        <button type="button" class="modal-close" id="closeModalBtn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn" id="closeModalActionBtn">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Eliminar modal anterior si existe
    const oldModal = document.getElementById('dynamicModal');
    if (oldModal) {
        oldModal.remove();
    }
    
    // Añadir el nuevo modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Configurar eventos de cierre
    const modal = document.getElementById('dynamicModal');
    const closeBtn = document.getElementById('closeModalBtn');
    const closeActionBtn = document.getElementById('closeModalActionBtn');
    
    const closeModal = () => {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
        }, 300);
    };
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    if (closeActionBtn) {
        closeActionBtn.addEventListener('click', closeModal);
    }
    
    // Mostrar el modal
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

// Exportar funciones para uso global
window.initDashboard = initDashboard;
window.updateDashboardData = updateDashboardData;
window.initCustomUIComponents = initCustomUIComponents;
window.initVisualFilters = initVisualFilters;
window.hideCharts = hideCharts;
window.showCharts = showCharts;
window.initApplyFiltersButton = initApplyFiltersButton;
window.initExportButtons = initExportButtons;
window.exportAxisToPDF = exportAxisToPDF;
window.loadSimplifiedAlerts = loadSimplifiedAlerts;
window.loadAlerts = loadAlerts;
window.viewAlertDetails = viewAlertDetails;
window.acknowledgeAlert = acknowledgeAlert;
window.getVibrationFilters = getVibrationFilters;
window.getSeverityText = getSeverityText;
window.updateDashboardAlertCounts = updateDashboardAlertCounts; 