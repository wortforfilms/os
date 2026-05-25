use defmt::info;

pub struct CapsuleMemory {
    memory: Vec<u8>,
    allocated: usize,
}

impl CapsuleMemory {
    pub fn new(size: usize) -> Self {
        Self {
            memory: vec![0u8; size],
            allocated: 0,
        }
    }
    
    pub fn allocate(&mut self, size: usize) -> Option<usize> {
        if self.allocated + size <= self.memory.len() {
            let ptr = self.allocated;
            self.allocated += size;
            info!("🧠 Allocated {} bytes at offset {}", size, ptr);
            Some(ptr)
        } else {
            None
        }
    }
    
    pub fn write(&mut self, offset: usize, data: &[u8]) -> bool {
        if offset + data.len() <= self.memory.len() {
            self.memory[offset..offset + data.len()].copy_from_slice(data);
            true
        } else {
            false
        }
    }
    
    pub fn read(&self, offset: usize, len: usize) -> Option<&[u8]> {
        if offset + len <= self.memory.len() {
            Some(&self.memory[offset..offset + len])
        } else {
            None
        }
    }
    
    pub fn usage(&self) -> f32 {
        (self.allocated as f32 / self.memory.len() as f32) * 100.0
    }
}