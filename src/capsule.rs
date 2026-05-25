use wasmi::{Engine, Store, Module, Instance, Imports, Func, TypedFunc};
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
    
    pub fn load_capsule(&mut self, wasm_binary: &[u8]) -> Result<(), &'static str> {
        info!("📦 Loading WASM capsule...");
        
        let module = Module::new(&self.engine, wasm_binary)
            .map_err(|_| "Failed to compile WASM module")?;
            
        let imports = Imports::default();
        let instance = Instance::new(&mut self.store, &module, &imports)
            .map_err(|_| "Failed to instantiate WASM module")?;
            
        self.instances.push(instance);
        info!("✅ Capsule loaded successfully");
        Ok(())
    }
    
    pub fn execute_export(&mut self, instance_index: usize, func_name: &str) -> Result<(), &'static str> {
        if let Some(instance) = self.instances.get(instance_index) {
            let func = instance.get_typed_func::<(), ()>(&self.store, func_name)
                .map_err(|_| "Function not found")?;
                
            func.call(&mut self.store, ())
                .map_err(|_| "Function execution failed")?;
                
            info!("🎯 Executed capsule function: {}", func_name);
            Ok(())
        } else {
            Err("Instance not found")
        }
    }
}

pub struct CapsuleManager {
    runtime: CapsuleRuntime,
    loaded_capsules: Vec<String>,
}

impl CapsuleManager {
    pub fn new() -> Self {
        Self {
            runtime: CapsuleRuntime::new(),
            loaded_capsules: Vec::new(),
        }
    }
    
    pub fn load_from_storage(&mut self, name: &str) -> Result<(), &'static str> {
        // In a real implementation, load from filesystem
        info!("📥 Loading capsule from storage: {}", name);
        
        // For now, just track the name
        self.loaded_capsules.push(name.to_string());
        Ok(())
    }
    
    pub fn list_capsules(&self) -> &[String] {
        &self.loaded_capsules
    }
}