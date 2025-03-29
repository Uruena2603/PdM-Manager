/**
 * PdM-Manager - JavaScript Configuración v1.0.0
 * Funciones para la gestión de configuración y ajustes del sistema
 * 
 * Última actualización: 2023-09-15
 */

// ==========================================================================
// INICIALIZACIÓN DE CONFIGURACIÓN
// ==========================================================================

// Inicializar sección de configuración
function initConfig() {
    console.log('Inicializando configuración...');
    
    // Inicializar pestañas de configuración
    initConfigTabs();
    
    // Inicializar gestión de modelos (primero, porque es requisito para sensores)
    initModelManagement();
    
    // Inicializar gestión de sensores (segundo, porque es requisito para máquinas)
    initSensorManagement();
    
    // Inicializar gestión de máquinas
    initMachineManagement();
    
    // Inicializar límites de aceleración
    initLimitsManagement();
    
    // Configurar dependencias entre entidades (modelo->sensor->máquina)
    setupEntityDependencies();
    
    // Actualizar listados y datos
    refreshConfigData();
}

// Inicializar pestañas de configuración
function initConfigTabs() {
    console.log('Inicializando pestañas de configuración...');
    const tabItems = document.querySelectorAll('.config-tabs .tab-item');
    const tabContents = document.querySelectorAll('.config-content .tab-content');
    
    if (!tabItems.length || !tabContents.length) {
        console.error('Error: No se encontraron los elementos de las pestañas');
        return;
    }
    
    // Manejar eventos de clic en las pestañas
    tabItems.forEach(tab => {
        // Evitar duplicar event listeners
        tab.removeEventListener('click', handleTabClick);
        tab.addEventListener('click', handleTabClick);
    });
    
    // Función para manejar el clic en las pestañas
    function handleTabClick() {
        const targetTab = this.getAttribute('data-tab');
        if (!targetTab) return;
        
        // Actualizar UI
        activateTab(targetTab);
        
        // Actualizar URL sin recargar la página
        updateTabUrl(targetTab);
        
        return false;
    }
    
    // Activar una pestaña específica
    function activateTab(tabName) {
        // Actualizar elemento activo
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        const activeTab = document.querySelector(`.tab-item[data-tab="${tabName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
        
        // Mostrar el contenido correspondiente
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        const contentElement = document.getElementById(`${tabName}Content`);
        if (contentElement) {
            contentElement.classList.add('active');
        }
        
        // Cambiar título de la página (pestaña del navegador)
        const tabTitle = getTabName(tabName);
        document.title = `PdM Manager - ${tabTitle}`;
    }
    
    // Actualizar URL para la pestaña
    function updateTabUrl(tabName) {
        const configPage = 'configuracion';
        const pageUrl = tabName ? `${configPage}:${tabName}` : configPage;
        
        // Usar history API para evitar recargas
        try {
            window.history.pushState({}, '', `#${pageUrl}`);
        } catch (e) {
            // Fallback si falla la API de history
            window.location.hash = pageUrl;
        }
    }
    
    // Verificar si hay un fragmento de URL específico para seleccionar pestaña
    function checkUrlAndActivateTab() {
        const hash = window.location.hash;
        if (hash.startsWith('#configuracion:')) {
            const tabName = hash.split(':')[1];
            const tabExists = !!document.querySelector(`.tab-item[data-tab="${tabName}"]`);
            
            if (tabExists) {
                // Usar setTimeout para garantizar que el DOM está listo
                setTimeout(() => {
                    activateTab(tabName);
                }, 50);
                return true;
            }
        }
        return false;
    }
    
    // Activar pestaña según URL o usar la primera pestaña por defecto
    if (!checkUrlAndActivateTab() && tabItems.length > 0) {
        // Si no hay hash específico o el hash no corresponde a una pestaña válida, seleccionar la primera
        const firstTabName = tabItems[0].getAttribute('data-tab');
        if (firstTabName) {
            activateTab(firstTabName);
        }
    }
    
    // Manejar cambios en el hash de la URL
    window.removeEventListener('hashchange', handleHashChange);
    window.addEventListener('hashchange', handleHashChange);
    
    function handleHashChange() {
        // Solo procesar el cambio si estamos en la sección de configuración
        const currentPage = getCurrentPage().split(':')[0];
        if (currentPage === 'configuracion') {
            checkUrlAndActivateTab();
        }
    }
    
    console.log('Pestañas de configuración inicializadas');
}

// Obtener nombre formateado de la pestaña
function getTabName(tabId) {
    switch(tabId) {
        case 'modelos': return 'Modelos';
        case 'sensores': return 'Sensores';
        case 'maquinas': return 'Máquinas';
        case 'limites': return 'Límites de Aceleración';
        default: return 'Configuración';
    }
}

// Configurar dependencias entre entidades
function setupEntityDependencies() {
    // Verificar si hay sensores para la máquina - ahora auto-verificamos con el formulario
    const machineForm = document.getElementById('machineForm');
    if (machineForm) {
        machineForm.addEventListener('submit', function(e) {
            // Verificar sensores antes de permitir guardar la máquina
            checkSensorsExist()
                .then(sensorsExist => {
                    if (!sensorsExist) {
                        e.preventDefault();
                        showToast('Debe crear al menos un sensor antes de crear máquinas', 'warning');
                        
                        // Cambiar a la pestaña de sensores
                        const sensorTab = document.querySelector('.tab-item[data-tab="sensores"]');
                        if (sensorTab) sensorTab.click();
                    } else {
                        saveMachine();
                    }
                });
        });
    }

    // El formulario de sensor verificará si existen modelos antes de guardar
    const sensorForm = document.getElementById('sensorForm');
    if (sensorForm) {
        sensorForm.addEventListener('submit', function(e) {
            // Verificar modelos antes de permitir guardar el sensor
            checkModelsExist()
                .then(modelsExist => {
                    if (!modelsExist) {
                        e.preventDefault();
                        showToast('Debe crear al menos un modelo antes de crear sensores', 'warning');
                        
                        // Cambiar a la pestaña de modelos
                        const modelTab = document.querySelector('.tab-item[data-tab="modelos"]');
                        if (modelTab) modelTab.click();
                    } else {
                        saveSensor();
                    }
                });
        });
    }
}

// Verificar si existen modelos
function checkModelsExist() {
    return fetch('/api/models')
        .then(response => response.json())
        .then(models => {
            return models && models.length > 0;
        })
        .catch(error => {
            console.error('Error al verificar modelos:', error);
            return false;
        });
}

// Verificar si existen sensores
function checkSensorsExist() {
    return fetch('/api/sensors')
        .then(response => response.json())
        .then(sensors => {
            return sensors && sensors.length > 0;
        })
        .catch(error => {
            console.error('Error al verificar sensores:', error);
            return false;
        });
}

// Actualizar datos de configuración
function refreshConfigData() {
    // Cargar datos de máquinas
    loadMachinesTable();
    
    // Cargar datos de sensores
    loadSensorsTable();
    
    // Cargar datos de modelos
    loadModelsTable();
    
    // Actualizar límites
    loadCurrentLimits();
    
    // Mostrar notificación
    showToast('Datos de configuración actualizados', 'info');
}

// Inicializar gestión de máquinas
function initMachineManagement() {
    // Inicializar formulario de máquina
    const machineForm = document.getElementById('machineForm');
    if (machineForm) {
        machineForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveMachine();
        });
    }
    
    // Inicializar botón de cancelar
    const cancelMachineBtn = document.getElementById('cancelMachineBtn');
    if (cancelMachineBtn) {
        cancelMachineBtn.addEventListener('click', () => {
            machineForm.reset();
        });
    }
}

// Cargar tabla de máquinas
function loadMachinesTable() {
    const machinesTableBody = document.querySelector('#machinesTable tbody');
    if (!machinesTableBody) return;
    
    // Mostrar indicador de carga
    machinesTableBody.innerHTML = '<tr><td colspan="4" class="text-center">Cargando datos...</td></tr>';
    
    // Obtener datos de la API
    fetch('/api/machines')
        .then(response => response.json())
        .then(machines => {
            // Vaciar tabla
            machinesTableBody.innerHTML = '';
            
            if (machines.length === 0) {
                machinesTableBody.innerHTML = '<tr><td colspan="4" class="text-center">No hay máquinas configuradas</td></tr>';
                return;
            }
            
            // Cargar sensores para mostrar información relacionada
            fetch('/api/sensors')
                .then(response => response.json())
                .then(sensors => {
                    const sensorMap = {};
                    sensors.forEach(sensor => {
                        sensorMap[sensor.sensor_id] = sensor.name;
                    });
                    
                    // Poblar tabla con datos
                    machines.forEach(machine => {
                        const row = document.createElement('tr');
                        const sensorName = machine.sensor_id && sensorMap[machine.sensor_id] 
                            ? sensorMap[machine.sensor_id] 
                            : 'No asignado';
                            
                        row.innerHTML = `
                            <td>${machine.machine_id}</td>
                            <td>${machine.name}</td>
                            <td>${machine.description || '-'}</td>
                            <td>${sensorName}</td>
                        `;
                        
                        // Añadir atributos de datos para interactividad
                        row.setAttribute('data-id', machine.machine_id);
                        row.classList.add('table-row-interactive');
                        
                        // Manejar evento de clic en la fila
                        row.addEventListener('click', () => {
                            editMachine(machine.machine_id);
                        });
                        
                        machinesTableBody.appendChild(row);
                    });
                    
                    // Disparar evento personalizado para indicar que la tabla se ha actualizado
                    document.dispatchEvent(new CustomEvent('machinesTableUpdated'));
                })
                .catch(error => {
                    console.error('Error al cargar sensores:', error);
                    showToast('Error al cargar datos de sensores', 'error');
                });
        })
        .catch(error => {
            console.error('Error al cargar máquinas:', error);
            machinesTableBody.innerHTML = '<tr><td colspan="4" class="text-center">Error al cargar datos</td></tr>';
            showToast('Error al cargar máquinas', 'error');
        });
}

// Editar máquina
function editMachine(machineId) {
    fetch(`/api/machines/${machineId}`)
        .then(response => response.json())
        .then(machine => {
            // Cargar datos en el formulario
            document.getElementById('machineId').value = machine.machine_id;
            document.getElementById('machineName').value = machine.name;
            document.getElementById('machineDescription').value = machine.description || '';
            
            // Seleccionar sensor si está asignado
            const sensorSelect = document.getElementById('machineSensor');
            if (sensorSelect && machine.sensor_id) {
                sensorSelect.value = machine.sensor_id;
            } else if (sensorSelect) {
                sensorSelect.value = '';
            }
            
            // Actualizar título del modal
            document.getElementById('machineModalTitle').textContent = 'Editar Máquina';
            
            // Mostrar el modal
            const modal = document.getElementById('machineModal');
            modal.classList.add('show');
        })
        .catch(error => {
            console.error('Error al cargar datos de la máquina:', error);
            showToast('Error al cargar datos de la máquina', 'error');
        });
}

// Guardar máquina (crear nueva o actualizar existente)
function saveMachine() {
    // Obtener valores del formulario
    const machineId = document.getElementById('machineId').value;
    const machineName = document.getElementById('machineName').value;
    const machineDescription = document.getElementById('machineDescription').value;
    const sensorId = document.getElementById('machineSensor').value;
    
    // Verificar campos obligatorios
    if (!machineName) {
        showToast('El nombre de la máquina es obligatorio', 'warning');
        return;
    }
    
    // Preparar datos para envío
    const machineData = {
        name: machineName,
        description: machineDescription || ''
    };
    
    // Agregar sensor_id solo si está seleccionado (es opcional)
    if (sensorId && sensorId !== '') {
        machineData.sensor_id = parseInt(sensorId);
    }
    
    // Determinar si es creación o actualización
    const isUpdate = machineId && machineId !== '';
    const url = isUpdate ? `/api/machines/${machineId}` : '/api/machines';
    const method = isUpdate ? 'PUT' : 'POST';
    
    // Mostrar indicador de carga
    showLoadingIndicator(isUpdate ? 'Actualizando máquina...' : 'Creando máquina...');
    
    // Enviar solicitud al servidor
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(machineData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al guardar máquina');
        }
        return response.json();
    })
    .then(data => {
        // Ocultar indicador de carga
        hideLoadingIndicator();
        
        // Mostrar mensaje de éxito
        showToast(isUpdate ? 'Máquina actualizada con éxito' : 'Máquina creada con éxito', 'success');
        
        // Limpiar formulario
        document.getElementById('machineForm').reset();
        document.getElementById('machineId').value = '';
        
        // Cerrar modal si existe
        const modal = document.getElementById('machineModal');
        if (modal) modal.classList.remove('show');
        
        // Recargar tabla de máquinas
        loadMachinesTable();
    })
    .catch(error => {
        // Ocultar indicador de carga
        hideLoadingIndicator();
        
        console.error('Error al guardar máquina:', error);
        showToast('Error al guardar máquina', 'error');
    });
}

// Actualizar la asociación entre sensor y máquina
function updateSensorMachineAssociation(sensorId, machineId) {
    // Obtener datos actuales del sensor
    fetch(`/api/sensors/${sensorId}`)
        .then(response => response.json())
        .then(sensor => {
            // Si el sensor ya está asignado a otra máquina, no hacer nada
            if (sensor.machine_id && sensor.machine_id === machineId) {
                return; // Ya está correctamente asociado
            }
            
            // Actualizar el sensor con la nueva asignación de máquina
            const formData = new FormData();
            formData.append('name', sensor.name);
            formData.append('description', sensor.description || '');
            formData.append('location', sensor.location || '');
            formData.append('type', sensor.type || '');
            formData.append('machine_id', machineId);
            
            // Actualizar el sensor
            fetch(`/api/sensors/${sensorId}`, {
                method: 'PUT',
                body: formData
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Error al actualizar asociación del sensor');
                    }
                    
                    // Actualizar la tabla de sensores
                    loadSensorsTable();
                })
                .catch(error => {
                    console.error('Error al actualizar asociación de sensor:', error);
                    showToast('Error al actualizar asociación de sensor', 'error');
                });
        })
        .catch(error => {
            console.error('Error al obtener datos del sensor:', error);
            showToast('Error al obtener datos del sensor', 'error');
        });
}

// Eliminar máquina
function deleteMachine(machineId) {
    // Confirmar eliminación
    if (!confirm('¿Está seguro de que desea eliminar esta máquina? Esta acción no se puede deshacer.')) {
        return;
    }
    
    // Enviar solicitud de eliminación
    fetch(`/api/machines/${machineId}`, {
        method: 'DELETE'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al eliminar máquina');
            }
            return response.json();
        })
        .then(result => {
            // Actualizar UI
            loadMachinesTable();
            
            // Mostrar mensaje
            showToast('Máquina eliminada correctamente', 'success');
        })
        .catch(error => {
            console.error('Error al eliminar máquina:', error);
            showToast('Error al eliminar máquina', 'error');
        });
}

// ==========================================================================
// GESTIÓN DE SENSORES
// ==========================================================================

// Inicializar gestión de sensores
function initSensorManagement() {
    // Cargar sensores existentes
    loadSensors();
    
    // Cargar modelos para el selector al inicio
    loadModelsForSelect();
    
    // Configurar formulario de sensor
    const sensorForm = document.getElementById('sensorForm');
    if (sensorForm) {
        sensorForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // La verificación de modelos la maneja setupEntityDependencies
        });
    }
    
    // Configurar botón para cancelar sensor
    const cancelSensorBtn = document.getElementById('cancelSensorBtn');
    if (cancelSensorBtn) {
        cancelSensorBtn.addEventListener('click', () => {
            const sensorForm = document.getElementById('sensorForm');
            if (sensorForm) {
                sensorForm.reset();
            }
        });
    }
}

// Cargar máquinas para el selector en el formulario de sensores
function loadMachinesForSelect(selectedMachine = null) {
    fetch('/api/machines')
        .then(response => response.json())
        .then(machines => {
            const machineSelect = document.getElementById('sensorMachine');
            if (!machineSelect) return;
            
            // Mantener la opción "Ninguna"
            machineSelect.innerHTML = '<option value="">Ninguna</option>';
            
            machines.forEach(machine => {
                const option = document.createElement('option');
                option.value = machine.machine_id;
                option.textContent = machine.name;
                machineSelect.appendChild(option);
            });
            
            if (selectedMachine) {
                machineSelect.value = selectedMachine;
            }
        })
        .catch(error => {
            console.error('Error al cargar máquinas:', error);
        });
}

// Cargar modelos para el selector
function loadModelsForSelect() {
    fetch('/api/models')
        .then(response => response.json())
        .then(models => {
            const modelSelect = document.getElementById('sensorModel');
            if (!modelSelect) return;
            
            // Mantener la opción "Ninguno"
            modelSelect.innerHTML = '<option value="">Ninguno</option>';
            
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.model_id;
                option.textContent = model.name;
                modelSelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Error al cargar modelos:', error);
        });
}

// Cargar tabla de sensores
function loadSensorsTable() {
    const tableBody = document.querySelector('#sensorsTable tbody');
    if (!tableBody) return;
    
    // Mostrar indicador de carga
    tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Cargando datos...</td></tr>';
    
    fetch('/api/sensors')
        .then(response => response.json())
        .then(sensors => {
            tableBody.innerHTML = '';
            
            if (sensors.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center">No hay sensores registrados</td>
                    </tr>
                `;
                return;
            }
            
            // Cargar nombres de modelos para referencia
            fetch('/api/models')
                .then(response => response.json())
                .then(models => {
                    const modelMap = {};
                    models.forEach(model => {
                        modelMap[model.model_id] = model.name;
                    });
                    
                    // Renderizar tabla de sensores con información relacionada
                    sensors.forEach(sensor => {
                        const row = document.createElement('tr');
                        
                        // Obtener nombre de modelo si existe
                        const modelName = sensor.model_id && modelMap[sensor.model_id] ? modelMap[sensor.model_id] : 'No asignado';
                        
                        // Determinar clase para campos obligatorios
                        const modelClass = sensor.model_id ? '' : 'text-danger';
                        
                        row.innerHTML = `
                            <td class="column-id">${sensor.sensor_id}</td>
                            <td><strong>${sensor.name}</strong></td>
                            <td>${sensor.description || '-'}</td>
                            <td class="${modelClass}">${modelName}</td>
                        `;
                        
                        // Añadir atributos de datos para interactividad
                        row.setAttribute('data-id', sensor.sensor_id);
                        row.classList.add('table-row-interactive');
                        
                        // Manejar evento de clic en la fila
                        row.addEventListener('click', () => {
                            editSensor(sensor.sensor_id);
                        });
                        
                        tableBody.appendChild(row);
                    });
                    
                    // Disparar evento personalizado para indicar que la tabla se ha actualizado
                    document.dispatchEvent(new CustomEvent('sensorsTableUpdated'));
                })
                .catch(error => {
                    console.error('Error al cargar modelos:', error);
                    tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Error al cargar datos de modelos</td></tr>';
                });
        })
        .catch(error => {
            console.error('Error al cargar sensores:', error);
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Error al cargar datos</td></tr>';
            showToast('Error al cargar la lista de sensores', 'error');
        });
}

// Editar sensor existente
function editSensor(sensorId) {
    // Cargar datos del sensor para edición
    fetch(`/api/sensors/${sensorId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar datos del sensor');
            }
            return response.json();
        })
        .then(sensor => {
            // Actualizar UI y formulario
            document.getElementById('sensorModalTitle').textContent = 'Editar Sensor';
            
            // Cargar valores en el formulario
            document.getElementById('sensorId').value = sensor.sensor_id;
            document.getElementById('sensorName').value = sensor.name || '';
            document.getElementById('sensorDescription').value = sensor.description || '';
            
            // Seleccionar modelo si está asignado
            if (document.getElementById('sensorModel')) {
                document.getElementById('sensorModel').value = sensor.model_id || '';
            }
            
            // Mostrar modal
            const modal = document.getElementById('sensorModal');
            if (modal) modal.classList.add('show');
        })
        .catch(error => {
            console.error('Error al cargar sensor:', error);
            showToast('Error al cargar datos del sensor', 'error');
        });
}

// Guardar sensor (crear nuevo o actualizar existente)
function saveSensor() {
    // Obtener valores del formulario
    const sensorId = document.getElementById('sensorId').value;
    const sensorName = document.getElementById('sensorName').value;
    const sensorDescription = document.getElementById('sensorDescription').value;
    const modelId = document.getElementById('sensorModel').value;
    
    // Verificar campos obligatorios
    if (!sensorName) {
        showToast('El nombre del sensor es obligatorio', 'warning');
        return;
    }
    
    if (!modelId) {
        showToast('Debe seleccionar un modelo para el sensor', 'warning');
        return;
    }
    
    // Preparar datos para envío
    const sensorData = {
        name: sensorName,
        description: sensorDescription || '',
        model_id: parseInt(modelId)
    };
    
    // Determinar si es creación o actualización
    const isUpdate = sensorId && sensorId !== '';
    const url = isUpdate ? `/api/sensors/${sensorId}` : '/api/sensors';
    const method = isUpdate ? 'PUT' : 'POST';
    
    // Mostrar indicador de carga
    showLoadingIndicator(isUpdate ? 'Actualizando sensor...' : 'Creando sensor...');
    
    // Enviar solicitud al servidor
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(sensorData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error al guardar sensor');
        }
        return response.json();
    })
    .then(data => {
        // Ocultar indicador de carga
        hideLoadingIndicator();
        
        // Mostrar mensaje de éxito
        showToast(isUpdate ? 'Sensor actualizado con éxito' : 'Sensor creado con éxito', 'success');
        
        // Limpiar formulario
        document.getElementById('sensorForm').reset();
        document.getElementById('sensorId').value = '';
        
        // Cerrar modal si existe
        const modal = document.getElementById('sensorModal');
        if (modal) modal.classList.remove('show');
        
        // Recargar tabla de sensores
        loadSensorsTable();
    })
    .catch(error => {
        // Ocultar indicador de carga
        hideLoadingIndicator();
        
        console.error('Error al guardar sensor:', error);
        showToast('Error al guardar sensor', 'error');
    });
}

// Asegurar que la máquina tenga correcta referencia al sensor
function ensureMachineSensorReference(sensorId, machineId) {
    if (!sensorId || !machineId) return;
    
    // Obtener datos actuales de la máquina
    fetch(`/api/machines/${machineId}`)
        .then(response => response.json())
        .then(machine => {
            // Si la máquina ya tiene este sensor asignado, no hacer nada
            if (machine.sensor_id && machine.sensor_id === parseInt(sensorId)) {
                return; // Ya está correctamente asociado
            }
            
            // Actualizar la máquina para que se referencie a este sensor
            const machineData = {
                name: machine.name,
                description: machine.description || '',
                location: machine.location || '',
                status: machine.status || 'operativo',
                route: machine.route || '',
                sensor_id: parseInt(sensorId)
            };
            
            // Actualizar la máquina
            fetch(`/api/machines/${machineId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(machineData)
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Error al actualizar asociación de la máquina');
                    }
                    
                    // Actualizar la tabla de máquinas si es necesario
                    loadMachinesTable();
                })
                .catch(error => {
                    console.error('Error al actualizar asociación de máquina:', error);
                });
        })
        .catch(error => {
            console.error('Error al obtener datos de la máquina:', error);
        });
}

// Eliminar sensor
function deleteSensor(sensorId) {
    // Confirmar eliminación
    if (!confirm('¿Está seguro de que desea eliminar este sensor? Esta acción no se puede deshacer.')) {
        return;
    }
    
    // Enviar solicitud de eliminación
    fetch(`/api/sensors/${sensorId}`, {
        method: 'DELETE'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al eliminar sensor');
            }
            return response.json();
        })
        .then(result => {
            // Actualizar UI
            loadSensorsTable();
            
            // Mostrar mensaje
            showToast('Sensor eliminado correctamente', 'success');
        })
        .catch(error => {
            console.error('Error al eliminar sensor:', error);
            showToast('Error al eliminar sensor', 'error');
        });
}

// ==========================================================================
// GESTIÓN DE MODELOS
// ==========================================================================

// Inicializar gestión de modelos
function initModelManagement() {
    // Cargar modelos existentes
    loadModels();
    
    // Configurar formulario de modelo
    const modelForm = document.getElementById('modelForm');
    if (modelForm) {
        modelForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveModel();
        });
    }
    
    // Configurar botón para cancelar modelo
    const cancelModelBtn = document.getElementById('cancelModelBtn');
    if (cancelModelBtn) {
        cancelModelBtn.addEventListener('click', () => {
            const modelForm = document.getElementById('modelForm');
            if (modelForm) {
                modelForm.reset();
                document.getElementById('modelFileName').textContent = 'Ningún archivo seleccionado';
                document.getElementById('scalerFileName').textContent = 'Ningún archivo seleccionado';
            }
        });
    }
    
    // Configurar botones para cerrar modales
    const closeButtons = document.querySelectorAll('.modal-close, .btn[data-dismiss="modal"]');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                modal.classList.remove('show');
            }
        });
    });
    
    // Configurar botón para confirmar eliminación
    const confirmDeleteBtn = document.getElementById('confirmDeleteModelBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', deleteModel);
    }
    
    // Inicializar campos de archivo
    initFileInputs();
}

// Configurar inputs de archivo personalizados
function setupFileInputs() {
    // Configurar input de archivo del modelo
    const modelFileInput = document.getElementById('modelFile');
    const modelFileButton = modelFileInput.nextElementSibling;
    const modelFileName = document.getElementById('modelFileName');
    
    modelFileButton.addEventListener('click', () => {
        modelFileInput.click();
    });
    
    modelFileInput.addEventListener('change', (event) => {
        if (event.target.files.length > 0) {
            modelFileName.textContent = event.target.files[0].name;
            modelFileName.parentElement.classList.add('file-selected');
        } else {
            modelFileName.textContent = 'Ningún archivo seleccionado';
            modelFileName.parentElement.classList.remove('file-selected');
        }
    });
    
    // Configurar input de archivo del escalador
    const scalerFileInput = document.getElementById('scalerFile');
    const scalerFileButton = scalerFileInput.nextElementSibling;
    const scalerFileName = document.getElementById('scalerFileName');
    
    scalerFileButton.addEventListener('click', () => {
        scalerFileInput.click();
    });
    
    scalerFileInput.addEventListener('change', (event) => {
        if (event.target.files.length > 0) {
            scalerFileName.textContent = event.target.files[0].name;
            scalerFileName.parentElement.classList.add('file-selected');
        } else {
            scalerFileName.textContent = 'Ningún archivo seleccionado';
            scalerFileName.parentElement.classList.remove('file-selected');
        }
    });
}

// Cargar tabla de modelos
function loadModelsTable() {
    const tableBody = document.querySelector('#modelsTable tbody');
    if (!tableBody) return;
    
    // Mostrar indicador de carga
    tableBody.innerHTML = '<tr><td colspan="3" class="text-center">Cargando datos...</td></tr>';
    
    fetch('/api/models')
        .then(response => response.json())
        .then(models => {
            tableBody.innerHTML = '';
            
            if (models.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="3" class="text-center">No hay modelos registrados</td>
                    </tr>
                `;
                return;
            }
            
            models.forEach(model => {
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td class="column-id">${model.model_id}</td>
                    <td><strong>${model.name}</strong></td>
                    <td>${model.description || '-'}</td>
                `;
                
                // Añadir atributos de datos para interactividad
                row.setAttribute('data-id', model.model_id);
                row.classList.add('table-row-interactive');
                
                // Manejar evento de clic en la fila
                row.addEventListener('click', () => {
                    editModel(model.model_id);
                });
                
                tableBody.appendChild(row);
            });
            
            // Disparar evento personalizado para indicar que la tabla se ha actualizado
            document.dispatchEvent(new CustomEvent('modelsTableUpdated'));
        })
        .catch(error => {
            console.error('Error al cargar modelos:', error);
            tableBody.innerHTML = '<tr><td colspan="3" class="text-center">Error al cargar datos</td></tr>';
            showToast('Error al cargar la lista de modelos', 'error');
        });
}

// Formatear rutas de archivo para mayor legibilidad
function formatFilePath(path) {
    if (!path) return '-';
    
    // Extraer el nombre del archivo de la ruta
    const parts = path.split(/[\/\\]/);
    const fileName = parts[parts.length - 1];
    
    return `<span title="${path}">${fileName}</span>`;
}

// Editar modelo
function editModel(modelId) {
    fetch(`/api/models/${modelId}`)
        .then(response => response.json())
        .then(model => {
            // Cargar datos en el formulario
            document.getElementById('modelId').value = model.model_id;
            document.getElementById('modelName').value = model.name;
            document.getElementById('modelDescription').value = model.description || '';
            
            // Actualizar UI para edición
            document.getElementById('modelFileRequired').style.display = 'none';
            document.getElementById('modelFileOptional').style.display = 'block';
            
            // Mostrar nombres de archivo actuales
            const h5FileName = model.route_h5 ? model.route_h5.split('/').pop() : 'No seleccionado';
            const pklFileName = model.route_pkl ? model.route_pkl.split('/').pop() : 'No seleccionado';
            
            document.getElementById('modelFileName').textContent = h5FileName;
            if (h5FileName && h5FileName !== 'Ningún archivo seleccionado') {
                document.getElementById('modelFileName').parentElement.classList.add('file-selected');
            } else {
                document.getElementById('modelFileName').parentElement.classList.remove('file-selected');
            }

            document.getElementById('scalerFileName').textContent = pklFileName;
            if (pklFileName && pklFileName !== 'Ningún archivo seleccionado') {
                document.getElementById('scalerFileName').parentElement.classList.add('file-selected');
            } else {
                document.getElementById('scalerFileName').parentElement.classList.remove('file-selected');
            }
            
            // Actualizar título del modal
            document.getElementById('modelModalTitle').textContent = 'Editar Modelo';
            
            // Mostrar el modal
            const modal = document.getElementById('modelModal');
            modal.classList.add('show');
        })
        .catch(error => {
            console.error('Error al cargar datos del modelo:', error);
            showToast('Error al cargar datos del modelo', 'error');
        });
}

// Guardar modelo (crear o actualizar)
function saveModel() {
    // Obtener datos del formulario
    const modelId = document.getElementById('modelId').value;
    const name = document.getElementById('modelName').value;
    const description = document.getElementById('modelDescription').value;
    const modelFile = document.getElementById('modelFile').files[0];
    const scalerFile = document.getElementById('scalerFile').files[0];
    
    // Validar nombre
    if (!name) {
        showToast('El nombre del modelo es obligatorio', 'warning');
        return;
    }
    
    // Validar archivo del modelo para nuevos modelos
    if (!modelId && !modelFile) {
        showToast('El archivo del modelo es obligatorio para nuevos modelos', 'warning');
        return;
    }
    
    // Preparar datos del formulario
    const formData = new FormData();
    formData.append('name', name);
    
    if (description) {
        formData.append('description', description);
    }
    
    if (modelFile) {
        formData.append('model_h5_file', modelFile);
    }
    
    if (scalerFile) {
        formData.append('scaler_file', scalerFile);
    }
    
    // Determinar si es creación o actualización
    const isUpdate = !!modelId;
    const method = isUpdate ? 'PUT' : 'POST';
    const url = isUpdate ? `/api/models/${modelId}` : '/api/models';
    
    // Mostrar indicador de carga
    showLoadingIndicator(isUpdate ? 'Actualizando modelo...' : 'Creando modelo...');
    
    // Enviar solicitud
    fetch(url, {
        method: method,
        body: formData
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(result => {
            // Cerrar modal
            const modal = document.getElementById('modelModal');
            modal.classList.remove('show');
            
            // Actualizar UI
            loadModelsTable();
            
            // Recargar selectores
            if (typeof loadModelsForSelect === 'function') {
                loadModelsForSelect();
            }
            
            // Mostrar mensaje
            const action = isUpdate ? 'actualizado' : 'creado';
            showToast(`Modelo ${action} correctamente`, 'success');
        })
        .catch(error => {
            console.error('Error al guardar modelo:', error);
            showToast(`Error al guardar modelo: ${error.message}`, 'error');
        })
        .finally(() => {
            hideLoadingIndicator();
        });
}

// Eliminar modelo
function deleteModel(modelId) {
    // Mostrar indicador de carga
    showLoadingIndicator('Eliminando modelo...');
    
    // Enviar solicitud de eliminación
    fetch(`/api/models/${modelId}`, {
        method: 'DELETE'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al eliminar modelo');
            }
            return response.json();
        })
        .then(result => {
            // Cerrar modal de confirmación
            const modal = document.getElementById('deleteModelModal');
            modal.classList.remove('show');
            
            // Actualizar UI
            loadModelsTable();
            
            // Recargar selectores
            if (typeof loadModelsForSelect === 'function') {
                loadModelsForSelect();
            }
            
            // Mostrar mensaje
            showToast('Modelo eliminado correctamente', 'success');
        })
        .catch(error => {
            console.error('Error al eliminar modelo:', error);
            showToast(`Error al eliminar modelo: ${error.message}`, 'error');
        })
        .finally(() => {
            hideLoadingIndicator();
        });
}

// ==========================================================================
// GESTIÓN DE LÍMITES DE ACELERACIÓN
// ==========================================================================

// Inicializar gestión de límites
function initLimitsManagement() {
    console.log('Inicializando gestión de límites...');
    
    // Cargar límites actuales
    loadCurrentLimits();
    
    // Configurar el formulario de límites
    const limitsForm = document.getElementById('limitsForm');
    if (limitsForm) {
        limitsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveLimits();
        });
    }
    
    // Configurar botón para guardar límites
    const saveLimitsBtn = document.getElementById('saveLimitsBtn');
    if (saveLimitsBtn) {
        saveLimitsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            saveLimits();
        });
    }
    
    // Configurar botón para restablecer límites
    const resetLimitsBtn = document.getElementById('resetLimitsBtn');
    if (resetLimitsBtn) {
        resetLimitsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            resetLimits();
        });
    }
    
    // Configurar el botón para restaurar valores por defecto
    const resetDefaultLimitsBtn = document.getElementById('resetDefaultLimitsBtn');
    if (resetDefaultLimitsBtn) {
        resetDefaultLimitsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            resetLimits();
        });
    }
    
    // Configurar botón para cancelar (limpiar formulario)
    const cancelLimitsBtn = document.getElementById('cancelLimitsBtn');
    if (cancelLimitsBtn) {
        cancelLimitsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loadCurrentLimits(); // Recargar valores actuales
        });
    }
}

// Cargar límites actuales
function loadCurrentLimits() {
    fetch('/api/limits')
        .then(response => response.json())
        .then(limits => {
            // Actualizar campos del formulario con los límites actuales
            // Utilizando los nuevos nombres de campos
            document.getElementById('x_2inf').value = limits.x_2inf || '-2.36';
            document.getElementById('x_2sup').value = limits.x_2sup || '2.18';
            document.getElementById('x_3inf').value = limits.x_3inf || '-3.50';
            document.getElementById('x_3sup').value = limits.x_3sup || '3.32';
            
            document.getElementById('y_2inf').value = limits.y_2inf || '7.18';
            document.getElementById('y_2sup').value = limits.y_2sup || '12.09';
            document.getElementById('y_3inf').value = limits.y_3inf || '5.95';
            document.getElementById('y_3sup').value = limits.y_3sup || '13.32';
            
            document.getElementById('z_2inf').value = limits.z_2inf || '-2.39';
            document.getElementById('z_2sup').value = limits.z_2sup || '1.11';
            document.getElementById('z_3inf').value = limits.z_3inf || '-3.26';
            document.getElementById('z_3sup').value = limits.z_3sup || '1.98';
        })
        .catch(error => {
            console.error('Error al cargar límites:', error);
            showToast('Error al cargar límites de aceleración', 'error');
        });
}

// Guardar nuevos límites
function saveLimits() {
    try {
        // Recopilar valores del formulario
        const limitsData = {
            x_2inf: parseFloat(document.getElementById('x_2inf').value),
            x_2sup: parseFloat(document.getElementById('x_2sup').value),
            x_3inf: parseFloat(document.getElementById('x_3inf').value),
            x_3sup: parseFloat(document.getElementById('x_3sup').value),
            
            y_2inf: parseFloat(document.getElementById('y_2inf').value),
            y_2sup: parseFloat(document.getElementById('y_2sup').value),
            y_3inf: parseFloat(document.getElementById('y_3inf').value),
            y_3sup: parseFloat(document.getElementById('y_3sup').value),
            
            z_2inf: parseFloat(document.getElementById('z_2inf').value),
            z_2sup: parseFloat(document.getElementById('z_2sup').value),
            z_3inf: parseFloat(document.getElementById('z_3inf').value),
            z_3sup: parseFloat(document.getElementById('z_3sup').value),
            
            update_limits: new Date().toISOString()
        };
        
        // Validar todos los campos
        const invalidFields = [];
        for (const key in limitsData) {
            if (key !== 'update_limits' && isNaN(limitsData[key])) {
                invalidFields.push(key);
            }
        }
        
        if (invalidFields.length > 0) {
            showToast(`Valores inválidos en: ${invalidFields.join(', ')}`, 'warning');
            return;
        }
        
        // Validar que los límites superiores sean mayores que los inferiores
        const axisLabels = {
            x: 'X',
            y: 'Y',
            z: 'Z'
        };
        
        // Comprobar validez lógica de los límites
        for (const axis of ['x', 'y', 'z']) {
            // 2-sigma inferior < 2-sigma superior
            if (limitsData[`${axis}_2inf`] >= limitsData[`${axis}_2sup`]) {
                showToast(`Error: El límite 2σ inferior debe ser menor que el superior para el eje ${axisLabels[axis]}`, 'warning');
                return;
            }
            
            // 3-sigma inferior < 3-sigma superior
            if (limitsData[`${axis}_3inf`] >= limitsData[`${axis}_3sup`]) {
                showToast(`Error: El límite 3σ inferior debe ser menor que el superior para el eje ${axisLabels[axis]}`, 'warning');
                return;
            }
            
            // 3-sigma debe contener a 2-sigma
            if (limitsData[`${axis}_3inf`] > limitsData[`${axis}_2inf`] || 
                limitsData[`${axis}_3sup`] < limitsData[`${axis}_2sup`]) {
                showToast(`Error: Los límites 3σ deben contener a los límites 2σ para el eje ${axisLabels[axis]}`, 'warning');
                return;
            }
        }
        
        // Mostrar indicador de carga
        showLoadingIndicator('Guardando límites...');
        
        // Enviar solicitud para guardar límites
        fetch('/api/limits', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(limitsData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(result => {
            // Actualizar UI global
            if (typeof updateChartsWithNewLimits === 'function') {
                updateChartsWithNewLimits(result);
            }
            
            // Actualizar valores estadísticos visuales
            if (typeof updateStatisticalDisplayValues === 'function') {
                updateStatisticalDisplayValues();
            }
            
            // Actualizar estado global
            if (typeof updateGlobalStats === 'function') {
                updateGlobalStats({
                    x: {
                        sigma2: { lower: result.x_2inf, upper: result.x_2sup },
                        sigma3: { lower: result.x_3inf, upper: result.x_3sup }
                    },
                    y: {
                        sigma2: { lower: result.y_2inf, upper: result.y_2sup },
                        sigma3: { lower: result.y_3inf, upper: result.y_3sup }
                    },
                    z: {
                        sigma2: { lower: result.z_2inf, upper: result.z_2sup },
                        sigma3: { lower: result.z_3inf, upper: result.z_3sup }
                    }
                });
            }
            
            // Mostrar mensaje
            showToast('Límites actualizados correctamente', 'success');
        })
        .catch(error => {
            console.error('Error al guardar límites:', error);
            showToast(`Error al guardar límites: ${error.message}`, 'error');
        })
        .finally(() => {
            hideLoadingIndicator();
        });
    } catch (error) {
        console.error('Error inesperado al procesar límites:', error);
        showToast('Error inesperado al procesar el formulario', 'error');
    }
}

// Restablecer límites a valores por defecto
function resetLimits() {
    // Mostrar indicador de carga
    showLoadingIndicator('Restableciendo límites...');
    
    fetch('/api/limits/reset', {
        method: 'POST'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al restablecer límites');
            }
            return response.json();
        })
        .then(result => {
            // Actualizar campos del formulario con los valores por defecto
            document.getElementById('x_2inf').value = '-2.36';
            document.getElementById('x_2sup').value = '2.18';
            document.getElementById('x_3inf').value = '-3.50';
            document.getElementById('x_3sup').value = '3.32';
            
            document.getElementById('y_2inf').value = '7.18';
            document.getElementById('y_2sup').value = '12.09';
            document.getElementById('y_3inf').value = '5.95';
            document.getElementById('y_3sup').value = '13.32';
            
            document.getElementById('z_2inf').value = '-2.39';
            document.getElementById('z_2sup').value = '1.11';
            document.getElementById('z_3inf').value = '-3.26';
            document.getElementById('z_3sup').value = '1.98';
            
            // Actualizar gráficos con límites por defecto
            if (typeof updateChartsWithNewLimits === 'function') {
                updateChartsWithNewLimits(result.limits);
            }
            
            // Actualizar valores estadísticos visuales
            if (typeof updateStatisticalDisplayValues === 'function') {
                updateStatisticalDisplayValues();
            }
            
            // Mostrar mensaje
            showToast('Límites restablecidos correctamente', 'success');
        })
        .catch(error => {
            console.error('Error al restablecer límites:', error);
            showToast('Error al restablecer límites', 'error');
        })
        .finally(() => {
            hideLoadingIndicator();
        });
}

// Función para cargar máquinas
function loadMachines() {
    showLoadingIndicator('Cargando máquinas...');
    
    fetch('/api/machines')
        .then(response => response.json())
        .then(data => {
            updateMachinesTable(data);
            loadMachinesForSelect();
        })
        .catch(error => {
            console.error('Error al cargar máquinas:', error);
            showToast('Error al cargar máquinas', 'error');
        })
        .finally(() => {
            hideLoadingIndicator();
        });
}

// Función para cargar sensores
function loadSensors() {
    showLoadingIndicator('Cargando sensores...');
    
    fetch('/api/sensors')
        .then(response => response.json())
        .then(data => {
            updateSensorsTable(data);
            loadSensorsForSelect();
        })
        .catch(error => {
            console.error('Error al cargar sensores:', error);
            showToast('Error al cargar sensores', 'error');
        })
        .finally(() => {
            hideLoadingIndicator();
        });
}

// Función para cargar modelos
function loadModels() {
    showLoadingIndicator('Cargando modelos...');
    
    fetch('/api/models')
        .then(response => response.json())
        .then(data => {
            updateModelsTable(data);
            loadModelsForSelect();
        })
        .catch(error => {
            console.error('Error al cargar modelos:', error);
            showToast('Error al cargar modelos', 'error');
        })
        .finally(() => {
            hideLoadingIndicator();
        });
}

// Exportar funciones para uso global
window.initConfig = initConfig;
window.refreshConfigData = refreshConfigData;