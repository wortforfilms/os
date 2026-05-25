use super::{runtime::CapsuleRuntime, memory::CapsuleMemory, api::CapsuleApi};
use defmt::{info, warn, error};

pub struct CapsuleManager {
    runtime: CapsuleRuntime,
    memory: CapsuleMemory,
    api: CapsuleApi,
    loaded_capsules: Vec<CapsuleInfo>,
}

#[derive(Debug, defmt::Format)]
struct CapsuleInfo {
    name: String,
    instance_id: usize,
    memory_usage: usize,
}

impl CapsuleManager {
    pub fn new() -> Self {
        Self {
            runtime: CapsuleRuntime::new(),
            memory: CapsuleMemory::new(1024 * 1024), // 1MB for capsules
            api: CapsuleApi::new(),
            loaded_capsules: Vec::new(),
        }
    }
    
    pub fn load_capsule(&mut self, name: &str, wasm_bytes: &[u8]) -> Result<(), &'static str> {
        info!("📥 Loading capsule: {}", name);
        
        let instance_id = self.runtime.load(wasm_bytes)?;
        
        let memory_used = wasm_bytes.len();
        let info = CapsuleInfo {
            name: name.to_string(),
            instance_id,
            memory_usage: memory_used,
        };
        
        self.loaded_capsules.push(info);
        info!("✅ Capsule '{}' loaded successfully", name);
        Ok(())
    }
    
    pub fn execute_capsule(&mut self, name: &str, function: &str) -> Result<(), &'static str> {
        let capsule_info = self.loaded_capsules
            .iter()
            .find(|c| c.name == name)
            .ok_or("Capsule not found")?;
            
        self.runtime.call(capsule_info.instance_id, function)
    }
    
    pub fn list_capsules(&self) -> &[CapsuleInfo] {
        &self.loaded_capsules
    }
    
    pub fn memory_usage(&self) -> f32 {
        self.memory.usage()
    }
    
    pub fn capsule_count(&self) -> usize {
        self.loaded_capsules.len()
    }
}