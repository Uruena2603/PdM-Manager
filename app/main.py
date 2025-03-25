# app/main.py

import os
from datetime import datetime, timedelta
import numpy as np
import pickle
import joblib

from fastapi import FastAPI, Depends, HTTPException, Body, File, UploadFile, Form, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from fastapi.middleware.cors import CORSMiddleware
import json

# Importar la configuración de la BD y el modelo de datos
from app.database import engine, Base, get_db
from app import crud, models

# Cargar modelo entrenado (Keras/TensorFlow) desde la carpeta "Modelo"
from tensorflow.keras.models import load_model

# Ruta al modelo .h5
model_path = os.path.join("Modelo", "modeloRNN_multiclase_v3_finetuned.h5")
model = load_model(model_path)

# Ruta al escalador (se cargará cuando exista)
scaler_path = os.path.join("Modelo", "scaler_RNN.pkl")
scaler = None
try:
    # Intentar cargar el escalador si existe
    if os.path.exists(scaler_path):
        scaler = joblib.load(scaler_path)
        print("Escalador cargado correctamente")
except Exception as e:
    print(f"Error al cargar el escalador: {str(e)}")

# Diccionario para mapear severidad a texto legible
SEVERITY_MAPPING = {
    0: "Normal",
    1: "Nivel 1",
    2: "Nivel 2",
    3: "Nivel 3 (Crítico)"
}

# Crear la aplicación FastAPI
app = FastAPI(
    title="PdM-Manager API",
    description="API para el sistema de mantenimiento predictivo",
    version="1.0.0"
)

# Crear las tablas en la BD (solo si no existen)
Base.metadata.create_all(bind=engine)

# Montar la carpeta estática (HTML, CSS, JS)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelos Pydantic para validación de datos
class SensorData(BaseModel):
    sensor_id: int
    acceleration_x: float
    acceleration_y: float
    acceleration_z: float

class SensorDataBatch(BaseModel):
    registros: List[SensorData]

@app.get("/")
def root():
    """Devuelve la página principal (index.html)"""
    return FileResponse("static/index.html")

@app.get("/check_db")
def check_db(db: Session = Depends(get_db)):
    """
    Comprueba la conexión a la base de datos.
    """
    try:
        db.execute("SELECT 1")
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.get("/get_vibration_data")
def get_vibration_data(
    sensor_id: int,
    start_date: str,
    end_date: str,
    db: Session = Depends(get_db)
):
    """
    Devuelve datos de vibración para un sensor y rango de fechas.
    """
    # Convertir fechas a datetime
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Formato de fecha inválido. Usa YYYY-MM-DD."
        )

    # Obtener registros de la BD
    data_list = crud.get_vibration_data_by_sensor_and_dates(db, sensor_id, start_dt, end_dt)

    # Extraer datos en listas para JSON
    acceleration_x = []
    acceleration_y = []
    acceleration_z = []
    fechas = []
    severities = []
    severity_texts = []

    for d in data_list:
        acceleration_x.append(float(d.acceleration_x) if d.acceleration_x is not None else None)
        acceleration_y.append(float(d.acceleration_y) if d.acceleration_y is not None else None)
        acceleration_z.append(float(d.acceleration_z) if d.acceleration_z is not None else None)
        fechas.append(d.date.isoformat())
        
        # Añadir severidad y texto correspondiente
        severity = d.severity
        severities.append(severity)
        severity_texts.append(SEVERITY_MAPPING.get(severity, "Desconocido") if severity is not None else None)

    return {
        "sensor_id": sensor_id,
        "fechas": fechas,
        "acceleration_x": acceleration_x,
        "acceleration_y": acceleration_y,
        "acceleration_z": acceleration_z,
        "severities": severities,
        "severity_texts": severity_texts
    }

@app.get("/predict_condition")
def predict_condition(
    sensor_id: int,
    start_date: str,
    end_date: str,
    db: Session = Depends(get_db)
):
    """
    1) Consulta datos de vibración en la BD (sensor + rango de fechas).
    2) Ajusta la forma del array según requiera tu RNN.
    3) Devuelve la predicción (0, 1, 2).
    """
    # Convertir fechas
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Formato de fecha inválido. Usa YYYY-MM-DD."
        )

    # Obtener datos
    data_list = crud.get_vibration_data_by_sensor_and_dates(db, sensor_id, start_dt, end_dt)
    if not data_list:
        raise HTTPException(
            status_code=404,
            detail="No hay datos para ese sensor y rango de fechas."
        )

    # Construir array numpy con los datos de aceleración
    arr = []
    for d in data_list:
        arr.append([
            float(d.acceleration_x or 0),
            float(d.acceleration_y or 0),
            float(d.acceleration_z or 0)
        ])

    arr = np.array(arr, dtype=np.float32)
    
    # Aplicar escalado si el escalador está disponible
    if scaler:
        # Ajustamos el formato para el escalador (2D: [n_samples, n_features])
        arr_2d = arr.reshape(-1, 3)
        arr_scaled = scaler.transform(arr_2d)
        # Volver a la forma 3D para la RNN
        arr = arr_scaled.reshape((1, len(data_list), 3))
    else:
        # Si no hay escalador, solo ajustamos la forma
        arr = arr.reshape((1, arr.shape[0], 3))

    # Hacer la predicción
    pred = model.predict(arr)
    predicted_class = int(np.argmax(pred, axis=1)[0])
    severity_text = SEVERITY_MAPPING.get(predicted_class, "Desconocido")
    confidence = float(np.max(pred)) * 100  # Confianza en porcentaje

    return {
        "sensor_id": sensor_id,
        "prediction": {
            "class": predicted_class,
            "severity": severity_text,
            "confidence": confidence
        }
    }

def check_level3_condition(db, sensor_id: int, time_window_minutes: int = 15, threshold: int = 3) -> bool:
    """
    Determina si un sensor ha entrado en condición de Nivel 3.
    Se considera Nivel 3 cuando hay un número de alertas de Nivel 2 mayor al umbral
    en una ventana de tiempo determinada.
    
    Args:
        db: Sesión de base de datos
        sensor_id: ID del sensor a verificar
        time_window_minutes: Ventana de tiempo en minutos para considerar alertas recientes
        threshold: Umbral de alertas de Nivel 2 para considerar como Nivel 3
        
    Returns:
        bool: True si se cumple la condición de Nivel 3, False en caso contrario
    """
    try:
        # Calcular el límite de tiempo para la ventana
        time_limit = datetime.now() - timedelta(minutes=time_window_minutes)
        
        # Consultar alertas recientes de Nivel 2 para este sensor
        query = db.query(models.Alert).filter(
            models.Alert.sensor_id == sensor_id,
            models.Alert.severity == 2,  # Nivel 2
            models.Alert.timestamp >= time_limit
        ).count()
        
        # Determinar si supera el umbral
        return query >= threshold
    
    except Exception as e:
        print(f"Error al verificar condición de Nivel 3: {e}")
        return False

@app.post("/api/sensor_data")
def receive_sensor_data(sensor_data: SensorData, db: Session = Depends(get_db)):
    """
    Recibe datos del sensor triaxial, clasifica y guarda en la base de datos
    """
    # Verificar que el sensor existe
    sensor = crud.get_sensor_by_id(db, sensor_data.sensor_id)
    if not sensor:
        raise HTTPException(
            status_code=404,
            detail=f"Sensor con ID {sensor_data.sensor_id} no encontrado"
        )
    
    # Preparar los datos para el modelo (triaxial)
    data_array = np.array([[
        sensor_data.acceleration_x,
        sensor_data.acceleration_y,
        sensor_data.acceleration_z
    ]], dtype=np.float32)
    
    # Escalar datos si el escalador está disponible
    if scaler:
        data_array = scaler.transform(data_array)
    
    # Ajustar forma para el modelo RNN (1, timesteps, features)
    rnn_input = data_array.reshape(1, 1, 3)
    
    # Hacer predicción con el modelo
    prediction = model.predict(rnn_input, verbose=0)
    severity = int(np.argmax(prediction[0]))
    confidence = float(np.max(prediction)) * 100
    
    # Calcular magnitud
    magnitude = np.sqrt(
        sensor_data.acceleration_x**2 + 
        sensor_data.acceleration_y**2 + 
        sensor_data.acceleration_z**2
    )
    
    # Verificar si aplica condición de Nivel 3
    elevated_to_level3 = False
    if severity == 2:  # Si ya es nivel 2, verificar si pasa a nivel 3
        elevated_to_level3 = check_level3_condition(db, sensor_data.sensor_id)
        if elevated_to_level3:
            severity = 3  # Elevar a Nivel 3
    
    # Guardar registro en la base de datos
    vibration_data = crud.create_vibration_data(
        db=db,
        sensor_id=sensor_data.sensor_id,
        acceleration_x=sensor_data.acceleration_x,
        acceleration_y=sensor_data.acceleration_y,
        acceleration_z=sensor_data.acceleration_z,
        severity=severity,
        magnitude=magnitude
    )
    
    # Si la severidad es mayor a 0, crear alerta
    if severity > 0:
        alert = models.Alert(
            sensor_id=sensor_data.sensor_id,
            error_type=f"Severidad {severity}",
            vibration_data_id=vibration_data.data_id,
            severity=severity,
            message=f"Alerta de vibración {SEVERITY_MAPPING[severity]}"
        )
        db.add(alert)
        db.commit()
    
    return {
        "status": "ok",
        "vibration_data_id": vibration_data.data_id,
        "severity": severity,
        "severity_text": SEVERITY_MAPPING[severity],
        "confidence": confidence,
        "magnitude": magnitude,
        "elevated_to_level3": elevated_to_level3
    }

@app.post("/api/sensor_data_batch")
def receive_sensor_data_batch(batch_data: SensorDataBatch, db: Session = Depends(get_db)):
    """
    Recibe un lote de datos del sensor, clasifica y guarda en la base de datos
    """
    results = []
    
    for record in batch_data.registros:
        # Verificar que el sensor existe
        sensor = crud.get_sensor_by_id(db, record.sensor_id)
        if not sensor:
            results.append({
                "sensor_id": record.sensor_id,
                "status": "error",
                "error": f"Sensor con ID {record.sensor_id} no encontrado"
            })
            continue
        
        # Preparar los datos para el modelo (triaxial)
        data_array = np.array([[
            record.acceleration_x,
            record.acceleration_y,
            record.acceleration_z
        ]], dtype=np.float32)
        
        # Escalar datos si el escalador está disponible
        if scaler:
            data_array = scaler.transform(data_array)
        
        # Ajustar forma para el modelo RNN
        rnn_input = data_array.reshape(1, 1, 3)
        
        # Hacer predicción con el modelo
        prediction = model.predict(rnn_input, verbose=0)
        severity = int(np.argmax(prediction[0]))
        confidence = float(np.max(prediction)) * 100
        
        # Calcular magnitud
        magnitude = np.sqrt(
            record.acceleration_x**2 + 
            record.acceleration_y**2 + 
            record.acceleration_z**2
        )
        
        # Verificar si aplica condición de Nivel 3
        elevated_to_level3 = False
        if severity == 2:  # Si ya es nivel 2, verificar si pasa a nivel 3
            elevated_to_level3 = check_level3_condition(db, record.sensor_id)
            if elevated_to_level3:
                severity = 3  # Elevar a Nivel 3
        
        # Guardar registro en la base de datos
        vibration_data = crud.create_vibration_data(
            db=db,
            sensor_id=record.sensor_id,
            acceleration_x=record.acceleration_x,
            acceleration_y=record.acceleration_y,
            acceleration_z=record.acceleration_z,
            severity=severity,
            magnitude=magnitude
        )
        
        # Si la severidad es mayor a 0, crear alerta
        if severity > 0:
            alert = models.Alert(
                sensor_id=record.sensor_id,
                error_type=f"Severidad {severity}",
                vibration_data_id=vibration_data.data_id,
                severity=severity,
                message=f"Alerta de vibración {SEVERITY_MAPPING[severity]}"
            )
            db.add(alert)
            db.commit()
        
        results.append({
            "sensor_id": record.sensor_id,
            "status": "ok",
            "vibration_data_id": vibration_data.data_id,
            "severity": severity,
            "severity_text": SEVERITY_MAPPING[severity],
            "confidence": confidence,
            "magnitude": magnitude,
            "elevated_to_level3": elevated_to_level3
        })
    
    return {"results": results}

@app.get("/reload_model")
def reload_model():
    """
    Recarga el modelo y el escalador desde la carpeta Modelo
    """
    global model, scaler
    
    try:
        # Recargar modelo
        model = load_model(model_path)
        
        # Recargar escalador si existe
        if os.path.exists(scaler_path):
            scaler = joblib.load(scaler_path)
            return {"status": "ok", "message": "Modelo y escalador recargados correctamente"}
        else:
            return {
                "status": "warning",
                "message": "Modelo recargado correctamente, pero no se encontró el escalador"
            }
    except Exception as e:
        return {"status": "error", "message": f"Error recargando el modelo: {str(e)}"}

@app.get("/api/sensors", response_model=List[Dict[str, Any]])
def get_all_sensors(db: Session = Depends(get_db)):
    """
    Obtiene la lista de todos los sensores
    """
    return crud.get_sensors(db)

@app.get("/api/sensors/{sensor_id}", response_model=Dict[str, Any])
def get_sensor_info(sensor_id: int, db: Session = Depends(get_db)):
    """
    Obtiene información detallada de un sensor por su ID
    """
    sensor = crud.get_sensor(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail=f"Sensor con ID {sensor_id} no encontrado")
    return sensor

@app.post("/api/sensors", response_model=Dict[str, Any])
def create_new_sensor(
    name: str = Form(...),
    description: str = Form(None),
    location: str = Form(None),
    type: str = Form(None),
    machine_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Crea un nuevo sensor
    """
    sensor = models.Sensor(
        name=name,
        description=description,
        location=location,
        type=type,
        machine_id=machine_id
    )
    return crud.create_sensor(db, sensor)

@app.put("/api/sensors/{sensor_id}", response_model=Dict[str, Any])
def update_sensor_info(
    sensor_id: int,
    name: str = Form(...),
    description: str = Form(None),
    location: str = Form(None),
    type: str = Form(None),
    machine_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Actualiza información de un sensor existente
    """
    sensor = crud.get_sensor_by_id(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail=f"Sensor con ID {sensor_id} no encontrado")
    
    sensor.name = name
    sensor.description = description
    sensor.location = location
    sensor.type = type
    sensor.machine_id = machine_id
    
    return crud.update_sensor(db, sensor)

@app.delete("/api/sensors/{sensor_id}")
def delete_sensor_info(sensor_id: int, db: Session = Depends(get_db)):
    """
    Elimina un sensor
    """
    success = crud.delete_sensor(db, sensor_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Sensor con ID {sensor_id} no encontrado")
    
    return {"status": "ok", "message": f"Sensor {sensor_id} eliminado correctamente"}

@app.get("/api/vibration-data", response_model=List[Dict[str, Any]])
def get_all_vibration_data(
    sensor_id: Optional[int] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Obtiene datos de vibración, opcionalmente filtrados por sensor
    """
    if sensor_id:
        return crud.get_vibration_data_by_sensor(db, sensor_id, limit)
    else:
        return crud.get_vibration_data(db, limit)

@app.get("/api/vibration-data/{data_id}", response_model=Dict[str, Any])
def get_vibration_data_by_id(data_id: int, db: Session = Depends(get_db)):
    """
    Obtiene un registro específico de datos de vibración por su ID
    """
    data = crud.get_vibration_data_by_id(db, data_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Datos de vibración con ID {data_id} no encontrados")
    return data

@app.get("/api/alerts", response_model=List[Dict[str, Any]])
def get_all_alerts(
    sensor_id: Optional[int] = None,
    acknowledged: Optional[bool] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Obtiene alertas, opcionalmente filtradas por sensor_id y/o estado
    """
    return crud.get_alerts(db, sensor_id, acknowledged, limit)

@app.put("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)):
    """
    Marca una alerta como reconocida
    """
    success = crud.acknowledge_alert(db, alert_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Alerta con ID {alert_id} no encontrada")
    
    return {"status": "ok", "message": f"Alerta {alert_id} reconocida correctamente"}

@app.get("/api/dashboard")
def get_dashboard_data(sensor_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Obtiene datos para el dashboard
    """
    result = {
        "alert_counts": {
            "level1": 0,
            "level2": 0,
            "level3": 0,
            "total": 0
        },
        "recent_alerts": [],
        "recent_data": []
    }
    
    # Contar alertas no reconocidas
    query = db.query(models.Alert).filter(models.Alert.acknowledged == False)
    if sensor_id:
        query = query.filter(models.Alert.sensor_id == sensor_id)
    
    alerts = query.order_by(models.Alert.timestamp.desc()).all()
    
    # Contar por nivel
    for alert in alerts:
        if alert.severity == 1:
            result["alert_counts"]["level1"] += 1
        elif alert.severity == 2:
            result["alert_counts"]["level2"] += 1
        elif alert.severity == 3:
            result["alert_counts"]["level3"] += 1
    
    result["alert_counts"]["total"] = (
        result["alert_counts"]["level1"] +
        result["alert_counts"]["level2"] +
        result["alert_counts"]["level3"]
    )
    
    # Obtener alertas recientes (máximo 10)
    recent_alerts = alerts[:10]
    for alert in recent_alerts:
        sensor = crud.get_sensor_by_id(db, alert.sensor_id)
        sensor_name = sensor.name if sensor else f"Sensor {alert.sensor_id}"
        
        result["recent_alerts"].append({
            "id": alert.log_id,
            "timestamp": alert.timestamp.isoformat(),
            "sensor_id": alert.sensor_id,
            "sensor_name": sensor_name,
            "severity": alert.severity,
            "severity_text": SEVERITY_MAPPING.get(alert.severity, "Desconocido"),
            "message": alert.message
        })
    
    # Obtener datos recientes de vibración (máximo 50)
    query = db.query(models.VibrationData)
    if sensor_id:
        query = query.filter(models.VibrationData.sensor_id == sensor_id)
    
    recent_data = query.order_by(models.VibrationData.date.desc()).limit(50).all()
    
    timestamps = []
    values_x = []
    values_y = []
    values_z = []
    severities = []
    
    for data in recent_data:
        timestamps.append(data.date.isoformat())
        values_x.append(float(data.acceleration_x) if data.acceleration_x is not None else None)
        values_y.append(float(data.acceleration_y) if data.acceleration_y is not None else None)
        values_z.append(float(data.acceleration_z) if data.acceleration_z is not None else None)
        severities.append(data.severity)
    
    result["recent_data"] = {
        "timestamps": timestamps,
        "values_x": values_x,
        "values_y": values_y,
        "values_z": values_z,
        "severities": severities
    }
    
    return result

@app.get("/api/machines")
def get_all_machines(db: Session = Depends(get_db)):
    """
    Obtiene la lista de todas las máquinas
    """
    machines = crud.get_machines(db)
    return [machine.__dict__ for machine in machines]

@app.get("/api/machines/{machine_id}")
def get_machine_info(machine_id: int, db: Session = Depends(get_db)):
    """
    Obtiene información detallada de una máquina por su ID
    """
    machine = crud.get_machine_by_id(db, machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail=f"Máquina con ID {machine_id} no encontrada")
    return machine.__dict__

@app.post("/api/machines")
def create_new_machine(
    name: str = Form(...),
    description: str = Form(None),
    location: str = Form(None),
    status: str = Form(None),
    model_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Crea una nueva máquina
    """
    machine = models.Machine(
        name=name,
        description=description,
        location=location,
        status=status,
        model_id=model_id
    )
    return crud.create_machine(db, machine).__dict__

@app.put("/api/machines/{machine_id}")
def update_machine_info(
    machine_id: int,
    name: str = Form(...),
    description: str = Form(None),
    location: str = Form(None),
    status: str = Form(None),
    model_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Actualiza información de una máquina existente
    """
    machine = crud.get_machine_by_id(db, machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail=f"Máquina con ID {machine_id} no encontrada")
    
    machine.name = name
    machine.description = description
    machine.location = location
    machine.status = status
    machine.model_id = model_id
    
    return crud.update_machine(db, machine).__dict__

@app.delete("/api/machines/{machine_id}")
def delete_machine_info(machine_id: int, db: Session = Depends(get_db)):
    """
    Elimina una máquina
    """
    success = crud.delete_machine(db, machine_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Máquina con ID {machine_id} no encontrada")
    
    return {"status": "ok", "message": f"Máquina {machine_id} eliminada correctamente"}

@app.get("/api/models")
def get_all_models(db: Session = Depends(get_db)):
    """
    Obtiene la lista de todos los modelos
    """
    models_list = crud.get_models(db)
    return [model.__dict__ for model in models_list]

@app.get("/api/models/{model_id}")
def get_model_info(model_id: int, db: Session = Depends(get_db)):
    """
    Obtiene información detallada de un modelo por su ID
    """
    model_info = crud.get_model_by_id(db, model_id)
    if not model_info:
        raise HTTPException(status_code=404, detail=f"Modelo con ID {model_id} no encontrado")
    return model_info.__dict__