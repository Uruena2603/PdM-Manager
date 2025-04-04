# app/models.py
from sqlalchemy import Column, Integer, Float, TIMESTAMP, String, Text, ForeignKey, Boolean, Index
from sqlalchemy.sql import func
from app.database import Base

class Sensor(Base):
    __tablename__ = 'sensor'
    __table_args__ = {'schema': 'public'}
    sensor_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    model_id = Column(Integer, ForeignKey("public.model.model_id"), nullable=True)

class Model(Base):
    __tablename__ = 'model'
    __table_args__ = {'schema': 'public'}
    model_id = Column(Integer, primary_key=True, index=True)
    route_h5 = Column(String, nullable=True)
    route_pkl = Column(String, nullable=True)
    name = Column(String, nullable=True)
    description = Column(Text, nullable=True)

class Machine(Base):
    __tablename__ = 'machine'
    __table_args__ = {'schema': 'public'}
    machine_id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey("public.sensor.sensor_id"), nullable=True)
    name = Column(String, nullable=True)
    description = Column(Text, nullable=True)

class VibrationData(Base):
    __tablename__ = 'vibration_data'
    __table_args__ = (
        Index('idx_vibration_sensor_id', 'sensor_id'),
        Index('idx_vibration_date', 'date'),
        Index('idx_vibration_severity', 'severity'),
        Index('idx_vibration_sensor_date', 'sensor_id', 'date'),
        Index('idx_vibration_sensor_severity', 'sensor_id', 'severity'),
        Index('idx_vibration_severity_pattern', 'sensor_id', 'severity', 'date', postgresql_ops={'date': 'DESC'}),
        {'schema': 'public'}
    )
    
    data_id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey("public.sensor.sensor_id"), nullable=False)
    date = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    acceleration_x = Column(Float, nullable=True)
    acceleration_y = Column(Float, nullable=True)
    acceleration_z = Column(Float, nullable=True)
    severity = Column(Integer, default=0, nullable=True)

class Alert(Base):
    __tablename__ = 'alert'
    __table_args__ = (
        Index('idx_alert_sensor_id', 'sensor_id'),
        Index('idx_alert_timestamp', 'timestamp'),
        Index('idx_alert_error_type', 'error_type'),
        Index('idx_alert_data_id', 'data_id'),
        Index('idx_alert_sensor_timestamp', 'sensor_id', 'timestamp'),
        Index('idx_alert_error_timestamp', 'error_type', 'timestamp'),
        {'schema': 'public'}
    )
    
    log_id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey("public.sensor.sensor_id"), nullable=False)
    timestamp = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    error_type = Column(Integer, nullable=True)  # 1, 2, o 3
    data_id = Column(Integer, ForeignKey("public.vibration_data.data_id"), nullable=True)

class LimitConfig(Base):
    __tablename__ = 'limit_config'
    __table_args__ = {'schema': 'public'}
    limit_config_id = Column(Integer, primary_key=True, index=True)
    
    # Límites para eje X
    x_2inf = Column(Float, nullable=False, default=-2.36)
    x_2sup = Column(Float, nullable=False, default=2.18)
    x_3inf = Column(Float, nullable=False, default=-3.50)
    x_3sup = Column(Float, nullable=False, default=3.32)
    
    # Límites para eje Y
    y_2inf = Column(Float, nullable=False, default=7.18)
    y_2sup = Column(Float, nullable=False, default=12.09)
    y_3inf = Column(Float, nullable=False, default=5.95)
    y_3sup = Column(Float, nullable=False, default=13.32)
    
    # Límites para eje Z
    z_2inf = Column(Float, nullable=False, default=-2.39)
    z_2sup = Column(Float, nullable=False, default=1.11)
    z_3inf = Column(Float, nullable=False, default=-3.26)
    z_3sup = Column(Float, nullable=False, default=1.98)
    
    # Fecha de actualización
    update_limits = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())
