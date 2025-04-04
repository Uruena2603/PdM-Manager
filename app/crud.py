# app/crud.py

from sqlalchemy.orm import Session
from datetime import datetime
from app.models import Sensor, VibrationData, Machine, Model, Alert, LimitConfig
from typing import List, Dict, Any, Optional
from app.logger import log_warning
from app.serializers import remove_sa_instance as serializer_remove_sa_instance

def remove_sa_instance(obj_dict):
    """
    Elimina el atributo _sa_instance_state de un diccionario
    
    DEPRECATED: Usar app.serializers.remove_sa_instance en su lugar
    """
    log_warning("Función remove_sa_instance en crud.py está obsoleta. Usar app.serializers.remove_sa_instance")
    return serializer_remove_sa_instance(obj_dict)

# --- Funciones CRUD para Sensores ---

def get_sensors(db: Session, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Obtiene la lista de todos los sensores"""
    sensors = db.query(Sensor).offset(skip).limit(limit).all()
    return [serializer_remove_sa_instance(sensor.__dict__) for sensor in sensors]

def get_sensor_by_id(db: Session, sensor_id: int) -> Optional[Sensor]:
    """Obtiene un sensor por su ID"""
    return db.query(Sensor).filter(Sensor.sensor_id == sensor_id).first()

def get_sensor(db: Session, sensor_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene un sensor por su ID (como diccionario)"""
    sensor = get_sensor_by_id(db, sensor_id)
    if sensor:
        return serializer_remove_sa_instance(sensor.__dict__)
    return None

def create_sensor(db: Session, sensor: Sensor) -> Dict[str, Any]:
    """Crea un nuevo sensor"""
    # model_id debe estar presente pero no lanzamos error si es None
    # ya que el nuevo esquema lo permite como nullable
    
    db.add(sensor)
    db.commit()
    db.refresh(sensor)
    return serializer_remove_sa_instance(sensor.__dict__)

def update_sensor(db: Session, sensor: Sensor) -> Dict[str, Any]:
    """Actualiza un sensor existente"""
    db.commit()
    db.refresh(sensor)
    return serializer_remove_sa_instance(sensor.__dict__)

def delete_sensor(db: Session, sensor_id: int) -> bool:
    """Elimina un sensor"""
    sensor = get_sensor_by_id(db, sensor_id)
    if sensor:
        db.delete(sensor)
        db.commit()
        return True
    return False

def get_machines_by_sensor(db: Session, sensor_id: int) -> List[Dict[str, Any]]:
    """Obtiene todas las máquinas asociadas a un sensor"""
    machines = db.query(Machine).filter(Machine.sensor_id == sensor_id).all()
    return [serializer_remove_sa_instance(machine.__dict__) for machine in machines]

# --- Funciones CRUD para Datos de Vibración ---

def create_vibration_data(
    db: Session,
    sensor_id: int,
    acceleration_x: float,
    acceleration_y: float,
    acceleration_z: float,
    severity: int = 0,
    custom_date: datetime = None
) -> VibrationData:
    """Crea un nuevo registro de datos de vibración"""
    
    db_data = VibrationData(
        sensor_id=sensor_id,
        acceleration_x=acceleration_x,
        acceleration_y=acceleration_y,
        acceleration_z=acceleration_z,
        severity=severity
    )
    
    if custom_date:
        db_data.date = custom_date
    
    db.add(db_data)
    db.commit()
    db.refresh(db_data)
    return db_data

def get_vibration_data(db: Session, limit: int = 100) -> List[Dict[str, Any]]:
    """Obtiene los últimos registros de datos de vibración"""
    data = db.query(VibrationData).order_by(VibrationData.date.desc()).limit(limit).all()
    return [serializer_remove_sa_instance(item.__dict__) for item in data]

def get_vibration_data_by_sensor(db: Session, sensor_id: int, limit: int = 100) -> List[Dict[str, Any]]:
    """Obtiene los últimos registros de datos de vibración para un sensor específico"""
    data = db.query(VibrationData).filter(VibrationData.sensor_id == sensor_id).order_by(VibrationData.date.desc()).limit(limit).all()
    return [serializer_remove_sa_instance(item.__dict__) for item in data]

def get_vibration_data_by_id(db: Session, data_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene un registro de datos de vibración por su ID"""
    data = db.query(VibrationData).filter(VibrationData.data_id == data_id).first()
    if data:
        return serializer_remove_sa_instance(data.__dict__)
    return None

def get_vibration_data_by_sensor_and_dates(
    db: Session,
    sensor_id: int,
    start_date: datetime,
    end_date: datetime
) -> List[VibrationData]:
    """Obtiene datos de vibración para un sensor y rango de fechas"""
    return db.query(VibrationData).filter(
        VibrationData.sensor_id == sensor_id,
        VibrationData.date >= start_date,
        VibrationData.date <= end_date
    ).order_by(VibrationData.date).all()

# --- Funciones CRUD para Alertas ---

def create_alert(db: Session, alert: Alert) -> Alert:
    """Crea una nueva alerta"""
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert

def get_alerts(
    db: Session,
    sensor_id: Optional[int] = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Obtiene alertas, opcionalmente filtradas por sensor_id"""
    query = db.query(Alert)
    
    if sensor_id is not None:
        query = query.filter(Alert.sensor_id == sensor_id)
    
    alerts = query.order_by(Alert.timestamp.desc()).limit(limit).all()
    return [serializer_remove_sa_instance(alert.__dict__) for alert in alerts]

def get_alert_by_id(db: Session, alert_id: int) -> Optional[Alert]:
    """Obtiene una alerta por su ID"""
    return db.query(Alert).filter(Alert.log_id == alert_id).first()

def get_alerts_by_sensor_and_dates(
    db: Session,
    sensor_id: int,
    start_date: datetime,
    end_date: datetime
) -> List[Alert]:
    """Obtiene alertas para un sensor y rango de fechas"""
    return db.query(Alert).filter(
        Alert.sensor_id == sensor_id,
        Alert.timestamp >= start_date,
        Alert.timestamp <= end_date
    ).order_by(Alert.timestamp).all()

# --- Funciones CRUD para Máquinas ---

def get_machines(db: Session, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Obtiene la lista de todas las máquinas"""
    machines = db.query(Machine).offset(skip).limit(limit).all()
    return [serializer_remove_sa_instance(machine.__dict__) for machine in machines]

def get_machine_by_id(db: Session, machine_id: int) -> Optional[Machine]:
    """Obtiene una máquina por su ID"""
    return db.query(Machine).filter(Machine.machine_id == machine_id).first()

def get_machines_with_status(db: Session, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Obtiene las máquinas con información de estado"""
    machines = get_machines(db, skip, limit)
    result = []
    
    for machine in machines:
        # Obtener el sensor asociado a esta máquina
        sensor = db.query(Sensor).filter(Sensor.sensor_id == machine["sensor_id"]).first()
        
        # Inicializar contadores de alerta
        level1_count = 0
        level2_count = 0
        level3_count = 0
        
        if sensor:
            # Contar alertas por tipo de error
            level1_count = db.query(Alert).filter(
                Alert.sensor_id == sensor.sensor_id,
                Alert.error_type == 1
            ).count()
            
            level2_count = db.query(Alert).filter(
                Alert.sensor_id == sensor.sensor_id,
                Alert.error_type == 2
            ).count()
            
            level3_count = db.query(Alert).filter(
                Alert.sensor_id == sensor.sensor_id,
                Alert.error_type == 3
            ).count()
        
        # Crear diccionario con datos de la máquina y alertas
        machine_dict = machine.copy()
        machine_dict["alerts"] = {
            "level1": level1_count,
            "level2": level2_count,
            "level3": level3_count,
            "total": level1_count + level2_count + level3_count
        }
        
        result.append(machine_dict)
    
    return result

def create_machine(db: Session, machine: Machine) -> Dict[str, Any]:
    """Crea una nueva máquina"""
    # El sensor_id ya no es obligatorio para crear una máquina
    
    db.add(machine)
    db.commit()
    db.refresh(machine)
    return serializer_remove_sa_instance(machine.__dict__)

def update_machine(db: Session, machine: Machine) -> Dict[str, Any]:
    """Actualiza una máquina existente"""
    db.commit()
    db.refresh(machine)
    return serializer_remove_sa_instance(machine.__dict__)

def delete_machine(db: Session, machine_id: int) -> bool:
    """Elimina una máquina"""
    machine = get_machine_by_id(db, machine_id)
    if machine:
        db.delete(machine)
        db.commit()
        return True
    return False

# --- Funciones CRUD para Modelos ---

def get_models(db: Session, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Obtiene la lista de todos los modelos"""
    models_list = db.query(Model).offset(skip).limit(limit).all()
    return [serializer_remove_sa_instance(model.__dict__) for model in models_list]

def get_model_by_id(db: Session, model_id: int) -> Optional[Model]:
    """Obtiene un modelo por su ID"""
    return db.query(Model).filter(Model.model_id == model_id).first()

def create_model(db: Session, model: Model) -> Dict[str, Any]:
    """Crea un nuevo modelo"""
    db.add(model)
    db.commit()
    db.refresh(model)
    return serializer_remove_sa_instance(model.__dict__)

def update_model(db: Session, model: Model) -> Dict[str, Any]:
    """Actualiza un modelo existente"""
    db.commit()
    db.refresh(model)
    return serializer_remove_sa_instance(model.__dict__)

def delete_model(db: Session, model_id: int) -> bool:
    """Elimina un modelo"""
    model = get_model_by_id(db, model_id)
    if model:
        db.delete(model)
        db.commit()
        return True
    return False

# --- Funciones adicionales para la vista unificada ---

def get_alert(db: Session, alert_id: int) -> Optional[Alert]:
    """Obtiene una alerta por su ID"""
    return db.query(Alert).filter(Alert.log_id == alert_id).first()

def get_alert_counts(db: Session, sensor_id: Optional[int] = None) -> Dict[str, int]:
    """Obtiene el conteo de alertas por tipo de error"""
    query = db.query(Alert)
    
    if sensor_id is not None:
        query = query.filter(Alert.sensor_id == sensor_id)
    
    level1_count = query.filter(Alert.error_type == 1).count()
    level2_count = query.filter(Alert.error_type == 2).count()
    level3_count = query.filter(Alert.error_type == 3).count()
    
    return {
        "level1": level1_count,
        "level2": level2_count,
        "level3": level3_count,
        "total": level1_count + level2_count + level3_count
    }

# --- Funciones CRUD para Límites de Aceleración ---

def get_limit_config(db: Session) -> Optional[LimitConfig]:
    """Obtiene la configuración de límites o None si no existe"""
    return db.query(LimitConfig).first()

def create_limit_config(db: Session, limit_config: LimitConfig) -> LimitConfig:
    """Crea una nueva configuración de límites"""
    db.add(limit_config)
    db.commit()
    db.refresh(limit_config)
    return limit_config

def update_limit_config(db: Session, limit_config: LimitConfig) -> LimitConfig:
    """Actualiza una configuración de límites existente"""
    db.commit()
    db.refresh(limit_config)
    return limit_config

def get_or_create_limit_config(db: Session) -> LimitConfig:
    """Obtiene la configuración actual de límites o crea una con valores por defecto"""
    config = get_limit_config(db)
    if not config:
        # Crear configuración con valores por defecto
        config = LimitConfig()
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

def delete_limit_config(db: Session) -> bool:
    """Elimina la configuración de límites"""
    config = get_limit_config(db)
    if config:
        db.delete(config)
        db.commit()
        return True
    return False
