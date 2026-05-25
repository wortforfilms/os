use wasmi::{Engine, Store, Module, Instance, Imports, AsContext, AsContextMut};
use defmt::{info, warn, error};

pub struct CapsuleRuntime {
    engine: Engine,
    store: Store<()>,
    instances: Vec<Instance>,
}

impl CapsuleRuntime {
    pub fn new() -> Self {
        let engine = Engine::default();
        let store = Store::new(&engine, ());
        
        Self {
            engine,
            store,
            instances: Vec::new(),
        }
    }
    
    pub fn load(&mut self, wasm_bytes: &[u8]) -> Result<usize, &'static str> {
        info!("📦 Loading WASM capsule ({} bytes)", wasm_bytes.len());
        
        let module = Module::new(&self.engine, wasm_bytes)
            .map_err(|_| "Failed to compile WASM module")?;
            
        let imports = Imports::default();
        let instance = Instance::new(&mut self.store, &module, &imports)
            .map_err(|_| "Failed to instantiate WASM module")?;
            
        let instance_id = self.instances.len();
        self.instances.push(instance);
        
        info!("✅ Capsule loaded with ID: {}", instance_id);
        Ok(instance_id)
    }
    
    pub fn call(&mut self, instance_id: usize, function: &str) -> Result<(), &'static str> {
        let instance = self.instances.get(instance_id)
            .ok_or("Instance not found")?;
            
        let func = instance.get_export(&self.store, function)
            .and_then(|export| export.into_func())
            .ok_or("Function not found")?;
            
        func.call(&mut self.store, &[], &mut [])
            .map_err(|_| "Function execution failed")?;
            
        info!("🎯 Called capsule {} function: {}", instance_id, function);
        Ok(())
    }
    
    pub fn instance_count(&self) -> usize {
        self.instances.len()
    }
}