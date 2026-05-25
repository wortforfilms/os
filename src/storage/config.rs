use defmt::info;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, defmt::Format)]
pub struct SystemConfig {
    pub device_name: String,
    pub max_capsules: usize,
    pub capsule_memory_mb: usize,
    pub log_level: LogLevel,
    pub enable_networking: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, defmt::Format)]
pub enum LogLevel {
    Error,
    Warn,
    Info,
    Debug,
    Trace,
}

impl Default for SystemConfig {
    fn default() -> Self {
        Self {
            device_name: "maataa-device".to_string(),
            max_capsules: 10,
            capsule_memory_mb: 1,
            log_level: LogLevel::Info,
            enable_networking: false,
        }
    }
}

pub struct ConfigManager {
    config: SystemConfig,
    dirty: bool,
}

impl ConfigManager {
    pub fn new() -> Self {
        Self {
            config: SystemConfig::default(),
            dirty: false,
        }
    }
    
    pub fn load(&mut self) -> Result<(), &'static str> {
        info!("⚙️ Loading configuration...");
        // Placeholder: load from storage
        info!("✅ Configuration loaded");
        Ok(())
    }
    
    pub fn save(&mut self) -> Result<(), &'static str> {
        if !self.dirty {
            return Ok(());
        }
        
        info!("💾 Saving configuration...");
        // Placeholder: save to storage
        self.dirty = false;
        info!("✅ Configuration saved");
        Ok(())
    }
    
    pub fn get(&self) -> &SystemConfig {
        &self.config
    }
    
    pub fn update<F>(&mut self, updater: F) -> Result<(), &'static str> 
    where
        F: FnOnce(&mut SystemConfig),
    {
        updater(&mut self.config);
        self.dirty = true;
        Ok(())
    }
    
    pub fn set_device_name(&mut self, name: &str) -> Result<(), &'static str> {
        self.config.device_name = name.to_string();
        self.dirty = true;
        info!("🏷️ Device name set to: {}", name);
        Ok(())
    }
}