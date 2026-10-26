//! Fixed-capacity, allocation-free task scheduling.
//!
//! Policies choose a runnable task from an explicit run queue and timestamp.
//! They never read the hardware clock, so policy decisions stay deterministic
//! and can be tested on the host.

pub type TaskId = u8;
pub const MAX_TASKS: usize = 8;
pub const DEFAULT_DEMO_QUANTUM_MS: u32 = 5;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TaskState {
    Ready,
    Running,
    Blocked,
    Dead,
}

pub struct Task {
    pub id: TaskId,
    pub stack: &'static mut [u8],
    pub entry: fn() -> !,
    pub state: TaskState,
    pub priority: u8,
    #[allow(dead_code)]
    saved_sp: usize,
}

impl Task {
    pub const fn new(id: TaskId, stack: &'static mut [u8], entry: fn() -> !, priority: u8) -> Self {
        Self {
            id,
            stack,
            entry,
            state: TaskState::Ready,
            priority,
            saved_sp: 0,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum QueueError {
    Full,
    DuplicateId,
}

pub struct RunQueue<const N: usize> {
    slots: [Option<Task>; N],
    len: usize,
}

impl<const N: usize> RunQueue<N> {
    pub const fn new() -> Self {
        Self {
            slots: [const { None }; N],
            len: 0,
        }
    }

    pub fn add(&mut self, task: Task) -> Result<(), QueueError> {
        if self.get(task.id).is_some() {
            return Err(QueueError::DuplicateId);
        }
        if self.len == N {
            return Err(QueueError::Full);
        }
        if let Some(slot) = self.slots.iter_mut().find(|slot| slot.is_none()) {
            *slot = Some(task);
            self.len += 1;
            Ok(())
        } else {
            Err(QueueError::Full)
        }
    }

    pub const fn len(&self) -> usize {
        self.len
    }

    pub const fn is_empty(&self) -> bool {
        self.len == 0
    }

    pub fn get(&self, id: TaskId) -> Option<&Task> {
        self.slots
            .iter()
            .filter_map(Option::as_ref)
            .find(|task| task.id == id)
    }

    pub fn get_mut(&mut self, id: TaskId) -> Option<&mut Task> {
        self.slots
            .iter_mut()
            .filter_map(Option::as_mut)
            .find(|task| task.id == id)
    }

    pub fn iter(&self) -> impl Iterator<Item = &Task> {
        self.slots.iter().filter_map(Option::as_ref)
    }
}

impl<const N: usize> Default for RunQueue<N> {
    fn default() -> Self {
        Self::new()
    }
}

/// Chooses a runnable task using only the supplied queue and time value.
pub trait Scheduler<const N: usize> {
    fn pick(&self, rq: &RunQueue<N>, now: u64) -> Option<TaskId>;
}

/// Round-robin policy. The currently running task is part of the run queue,
/// so selection has no hidden cursor state.
#[derive(Clone, Copy, Debug, Default)]
pub struct RoundRobin;

impl RoundRobin {
    pub const fn new() -> Self {
        Self
    }
}

impl<const N: usize> Scheduler<N> for RoundRobin {
    fn pick(&self, rq: &RunQueue<N>, _now: u64) -> Option<TaskId> {
        if N == 0 {
            return None;
        }
        let running_slot = rq.slots.iter().position(|slot| match slot.as_ref() {
            Some(task) => task.state == TaskState::Running,
            None => false,
        });
        let start = match running_slot {
            Some(slot) => (slot + 1) % N,
            None => 0,
        };
        for offset in 0..N {
            let index = (start + offset) % N;
            if let Some(task) = rq.slots[index].as_ref() {
                if matches!(task.state, TaskState::Ready | TaskState::Running) {
                    return Some(task.id);
                }
            }
        }
        None
    }
}

/// Strict-priority policy. Higher numeric priorities win; ties retain queue order.
#[derive(Clone, Copy, Debug, Default)]
pub struct FixedPriority;

impl FixedPriority {
    pub const fn new() -> Self {
        Self
    }
}

impl<const N: usize> Scheduler<N> for FixedPriority {
    fn pick(&self, rq: &RunQueue<N>, _now: u64) -> Option<TaskId> {
        let mut selected: Option<&Task> = None;
        for task in rq
            .iter()
            .filter(|task| matches!(task.state, TaskState::Ready | TaskState::Running))
        {
            let should_replace = match selected {
                None => true,
                Some(current) => task.priority > current.priority,
            };
            if should_replace {
                selected = Some(task);
            }
        }
        selected.map(|task| task.id)
    }
}

#[cfg(target_arch = "arm")]
mod cortex_m_runtime {
    use super::*;
    use core::cell::RefCell;
    use core::sync::atomic::{AtomicBool, Ordering};
    use cortex_m::interrupt::{self, Mutex};
    use cortex_m::peripheral::{scb::SystemHandler, SCB};

    static STARTED: AtomicBool = AtomicBool::new(false);
    static RUNTIME: Mutex<RefCell<Option<Runtime>>> = Mutex::new(RefCell::new(None));

    struct Runtime {
        queue: RunQueue<MAX_TASKS>,
        policy: RoundRobin,
        current: Option<TaskId>,
        quantum_ticks: u32,
        last_dispatch_tick: u64,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    pub enum StartError {
        EmptyQueue,
        NoRunnableTasks,
        ZeroQuantum,
        StackTooSmall,
        /// A task stack is not a power of two of at least 32 bytes aligned to
        /// its size, so the MPU cannot give it its own region.
        StackNotProtectable,
        AlreadyStarted,
    }

    /// Installs a round-robin queue and requests its first PendSV switch.
    /// `quantum_ticks` is in 1 kHz clock ticks (so 5 means 5 ms).
    pub fn start_round_robin(
        mut queue: RunQueue<MAX_TASKS>,
        quantum_ticks: u32,
        scb: &mut SCB,
    ) -> Result<(), StartError> {
        if quantum_ticks == 0 {
            return Err(StartError::ZeroQuantum);
        }
        if queue.is_empty() {
            return Err(StartError::EmptyQueue);
        }
        if !queue
            .iter()
            .any(|task| matches!(task.state, TaskState::Ready | TaskState::Running))
        {
            return Err(StartError::NoRunnableTasks);
        }
        if queue
            .iter()
            .any(|task| !crate::mpu::region_ok(task.stack.as_ptr() as usize, task.stack.len()))
        {
            return Err(StartError::StackNotProtectable);
        }
        if STARTED.swap(true, Ordering::AcqRel) {
            return Err(StartError::AlreadyStarted);
        }
        for task in queue.slots.iter_mut().filter_map(Option::as_mut) {
            task.saved_sp = initialize_stack(task).ok_or_else(|| {
                STARTED.store(false, Ordering::Release);
                StartError::StackTooSmall
            })?;
        }
        let now = crate::clock::get_ticks();
        interrupt::free(|cs| {
            *RUNTIME.borrow(cs).borrow_mut() = Some(Runtime {
                queue,
                policy: RoundRobin::new(),
                current: None,
                quantum_ticks,
                last_dispatch_tick: now,
            });
        });
        // PendSV must be the lowest-priority exception. SysTick only measures
        // time and requests this deferred context switch.
        unsafe { scb.set_priority(SystemHandler::PendSV, u8::MAX) };
        // From the first switch on, tasks run unprivileged inside their MPU
        // regions (PendSV sets CONTROL.nPRIV).
        crate::mpu::enable();
        SCB::set_pendsv();
        Ok(())
    }

    /// The running task's id.
    pub fn current_task() -> Option<TaskId> {
        interrupt::free(|cs| RUNTIME.borrow(cs).borrow().as_ref().and_then(|rt| rt.current))
    }

    /// The running task's stack as (base, size), for checking syscall buffers.
    pub fn current_stack() -> Option<(usize, usize)> {
        interrupt::free(|cs| {
            let shared = RUNTIME.borrow(cs).borrow();
            let rt = shared.as_ref()?;
            let task = rt.queue.get(rt.current?)?;
            Some((task.stack.as_ptr() as usize, task.stack.len()))
        })
    }

    /// Marks the running task dead; the scheduler never picks it again.
    pub fn kill_current() -> Option<TaskId> {
        interrupt::free(|cs| {
            let mut shared = RUNTIME.borrow(cs).borrow_mut();
            let rt = shared.as_mut()?;
            let id = rt.current?;
            rt.queue.get_mut(id)?.state = TaskState::Dead;
            Some(id)
        })
    }

    /// Where a killed task is sent until the next switch: an idle loop.
    pub fn task_exit_address() -> u32 {
        task_exit as usize as u32
    }

    /// Called after `clock::on_systick()`. It only requests PendSV; no task
    /// state or register context is changed in the measurement handler.
    pub fn on_systick() {
        let now = crate::clock::get_ticks();
        let expired = interrupt::free(|cs| {
            RUNTIME.borrow(cs).borrow().as_ref().map(|runtime| {
                runtime.current.is_some()
                    && now.wrapping_sub(runtime.last_dispatch_tick) >= runtime.quantum_ticks as u64
            })
        });
        if expired == Some(true) {
            SCB::set_pendsv();
        }
    }

    fn next_stack(old_sp: *mut u32) -> *mut u32 {
        interrupt::free(|cs| {
            let mut shared = RUNTIME.borrow(cs).borrow_mut();
            let Some(runtime) = shared.as_mut() else {
                return old_sp;
            };
            if let Some(current) = runtime.current {
                if !old_sp.is_null() {
                    if let Some(task) = runtime.queue.get_mut(current) {
                        task.saved_sp = old_sp as usize;
                    }
                }
            }
            let now = crate::clock::get_ticks();
            let Some(next) = runtime.policy.pick(&runtime.queue, now) else {
                return old_sp;
            };
            if runtime.queue.get(next).is_none() {
                return old_sp;
            }
            if let Some(current) = runtime.current {
                if current != next {
                    if let Some(previous) = runtime.queue.get_mut(current) {
                        if previous.state == TaskState::Running {
                            previous.state = TaskState::Ready;
                        }
                    }
                }
            }
            let Some(task) = runtime.queue.get_mut(next) else {
                return old_sp;
            };
            task.state = TaskState::Running;
            runtime.current = Some(next);
            runtime.last_dispatch_tick = now;
            crate::mpu::set_task_stack(task.stack.as_ptr() as usize, task.stack.len());
            task.saved_sp as *mut u32
        })
    }

    #[no_mangle]
    extern "C" fn __maataa_pendsv_next(old_sp: *mut u32) -> *mut u32 {
        next_stack(old_sp)
    }

    fn initialize_stack(task: &mut Task) -> Option<usize> {
        const SOFTWARE_WORDS: usize = 9; // r4-r11 and EXC_RETURN
        const HARDWARE_WORDS: usize = 8; // basic Cortex-M exception frame
        let base = task.stack.as_mut_ptr() as usize;
        let end = base.checked_add(task.stack.len())? & !7usize;
        let bytes = (SOFTWARE_WORDS + HARDWARE_WORDS) * core::mem::size_of::<u32>();
        let start = end.checked_sub(bytes)?;
        if start < base || task.stack.len() < bytes + 8 {
            return None;
        }
        let frame = start as *mut u32;
        unsafe {
            for index in 0..8 {
                frame.add(index).write(0);
            }
            frame.add(8).write(0xFFFF_FFFD); // return to Thread mode using PSP
            frame.add(9).write(0); // r0
            frame.add(10).write(0); // r1
            frame.add(11).write(0); // r2
            frame.add(12).write(0); // r3
            frame.add(13).write(0); // r12
            frame.add(14).write(task_exit as usize as u32);
            frame.add(15).write((task.entry as usize & !1) as u32);
            frame.add(16).write(1 << 24); // xPSR T bit
        }
        Some(start)
    }

    extern "C" fn task_exit() -> ! {
        loop {
            crate::clock::idle();
        }
    }

    core::arch::global_asm!(
        ".syntax unified",
        ".fpu fpv4-sp-d16",
        ".thumb",
        ".section .text.PendSV, \"ax\"",
        ".global PendSV",
        ".type PendSV,%function",
        ".thumb_func",
        "PendSV:",
        // The first switch originates in the boot thread (MSP); there is no
        // task context to store until a thread is running on PSP.
        "tst lr, #4",
        "beq 1f",
        "mrs r0, psp",
        // Save the callee-saved FP bank only when hardware stacked FP state.
        "tst lr, #0x10",
        "bne 3f",
        "vstmdb r0!, {{s16-s31}}",
        "3:",
        "stmdb r0!, {{r4-r11, lr}}",
        "b 2f",
        "1:",
        "movs r0, #0",
        "2:",
        "bl __maataa_pendsv_next",
        "ldmia r0!, {{r4-r11, lr}}",
        "tst lr, #0x10",
        "bne 4f",
        "vldmia r0!, {{s16-s31}}",
        "4:",
        "msr psp, r0",
        // Thread mode is unprivileged from now on (tasks only; the boot
        // thread never resumes). The barriers also make the new MPU stack
        // region take effect before the task runs.
        "mrs r1, control",
        "orr r1, r1, #1",
        "msr control, r1",
        "dsb",
        "isb",
        "bx lr",
        ".size PendSV, .-PendSV",
    );
}

/// MemManage: a task touched memory outside its regions. The task is killed
/// and the others keep running; a fault in the kernel itself stops the system.
#[cfg(target_arch = "arm")]
mod memfault {
    use cortex_m::peripheral::SCB;

    // MMFSR bits.
    const IACCVIOL: u8 = 1 << 0;
    const DACCVIOL: u8 = 1 << 1;
    const MUNSTKERR: u8 = 1 << 3;
    const MSTKERR: u8 = 1 << 4;
    const MLSPERR: u8 = 1 << 5;
    const MMARVALID: u8 = 1 << 7;

    fn kind(status: u8) -> &'static str {
        if status & MSTKERR != 0 {
            "stacking"
        } else if status & DACCVIOL != 0 {
            "data access"
        } else if status & IACCVIOL != 0 {
            "instruction fetch"
        } else if status & MUNSTKERR != 0 {
            "unstacking"
        } else if status & MLSPERR != 0 {
            "FPU lazy stacking"
        } else {
            "unknown"
        }
    }

    const STACKING: u8 = MSTKERR | MUNSTKERR | MLSPERR;
    /// EXC_RETURN: back to thread mode on PSP with a basic (non-FPU) frame.
    const RETURN_THREAD_PSP_BASIC: u32 = 0xFFFF_FFFD;

    /// `frame` is the stacked exception frame; `exc_return` tells whether the
    /// fault came from a task (thread mode on PSP) or from the kernel.
    /// Returns the EXC_RETURN value the handler leaves with.
    #[no_mangle]
    extern "C" fn __maataa_memfault(frame: *mut u32, exc_return: u32) -> u32 {
        let (status, address) = crate::mpu::fault_status();
        let at = if status & MMARVALID != 0 { address } else { 0 };
        let from_task = exc_return & 0b0100 != 0;
        // SAFETY: a plain read of a kernel word, for the report only.
        let target = unsafe { core::ptr::addr_of!(crate::mpu::FAULT_TEST_TARGET).read_volatile() };
        if !from_task {
            crate::logging::kprintln!(
                "KERNEL MEMORY FAULT ({}) at {:#010x}, mmfsr={:#04x}; system stopped",
                kind(status),
                at,
                status
            );
            loop {
                cortex_m::asm::nop();
            }
        }
        let stack = super::current_stack();
        let id = super::kill_current().unwrap_or(0);
        crate::mpu::clear_fault_status();
        SCB::set_pendsv();

        if status & STACKING != 0 {
            // The hardware could not stack (or unstack) the task's frame: its
            // stack pointer has run past its region, usually a stack overflow.
            // There is no frame to return through, so build one at the top of
            // the dead task's own stack, aimed at the idle loop, and point PSP
            // at it. The return then lands in the loop and PendSV switches on.
            crate::logging::kprintln!(
                "task {} overflowed its stack ({}, mmfsr={:#04x}); task killed",
                id,
                kind(status),
                status
            );
            let Some((base, len)) = stack else {
                crate::logging::kprintln!("no stack recorded for the task; system stopped");
                loop {
                    cortex_m::asm::nop();
                }
            };
            let top = (base + len) & !7;
            let fresh = (top - 8 * 4) as *mut u32;
            // SAFETY: the dead task's own stack, inside its MPU region; no one
            // else uses it. Registers r0-r3, r12, lr, pc, xPSR (Thumb bit).
            unsafe {
                for i in 0..6 {
                    fresh.add(i).write(0);
                }
                fresh.add(6).write(super::task_exit_address() & !1);
                fresh.add(7).write(1 << 24);
                core::arch::asm!("msr psp, {0}", in(reg) fresh as u32);
            }
            return RETURN_THREAD_PSP_BASIC;
        }

        // SAFETY: a stacked pc read for the report.
        let pc = unsafe { frame.add(6).read() };
        crate::logging::kprintln!(
            "task {} violated memory: {} at {:#010x} (pc {:#010x}); task killed, kernel word still {:#010x}",
            id,
            kind(status),
            at,
            pc,
            target
        );
        // Resume the dead task in an idle loop until the switch that follows.
        // SAFETY: the frame is the task's own, stacked by hardware, valid here.
        unsafe {
            frame.add(6).write(super::task_exit_address() & !1);
            frame.add(7).write(1 << 24);
        }
        exc_return
    }

    core::arch::global_asm!(
        ".syntax unified",
        ".thumb",
        ".section .text.MemoryManagement, \"ax\"",
        ".global MemoryManagement",
        ".type MemoryManagement,%function",
        ".thumb_func",
        "MemoryManagement:",
        "tst lr, #4",
        "ite eq",
        "mrseq r0, msp",
        "mrsne r0, psp",
        "mov r1, lr",
        // The handler returns the EXC_RETURN to leave with: normally the one
        // it was entered with, or a basic-frame return after a stack overflow.
        "bl __maataa_memfault",
        "bx r0",
        ".size MemoryManagement, .-MemoryManagement",
    );
}

#[cfg(target_arch = "arm")]
#[allow(unused_imports)]
pub use cortex_m_runtime::{
    current_stack, current_task, kill_current, on_systick, start_round_robin, task_exit_address, StartError,
};

#[cfg(test)]
mod tests {
    use super::*;

    fn parked() -> ! {
        loop {
            core::hint::spin_loop();
        }
    }

    fn task(id: TaskId, priority: u8) -> Task {
        let stack = std::boxed::Box::leak(std::vec![0; 128].into_boxed_slice());
        Task::new(id, stack, parked, priority)
    }

    fn queue<const N: usize>(items: &[(TaskId, u8)]) -> RunQueue<N> {
        let mut rq = RunQueue::new();
        for (id, priority) in items {
            assert!(rq.add(task(*id, *priority)).is_ok());
        }
        rq
    }

    #[test]
    fn round_robin_cycles_through_three_runnable_tasks() {
        let mut rq = queue::<3>(&[(1, 1), (2, 1), (3, 1)]);
        let policy = RoundRobin::new();
        let mut picked = [None; 6];
        for (index, selected) in picked.iter_mut().enumerate() {
            let current = rq
                .iter()
                .find(|task| task.state == TaskState::Running)
                .map(|task| task.id);
            *selected = policy.pick(&rq, index as u64);
            if let Some(current) = current {
                rq.get_mut(current).unwrap().state = TaskState::Ready;
            }
            if let Some(next) = *selected {
                rq.get_mut(next).unwrap().state = TaskState::Running;
            }
        }
        assert_eq!(
            picked,
            [Some(1), Some(2), Some(3), Some(1), Some(2), Some(3)]
        );
    }

    #[test]
    fn fixed_priority_always_selects_the_highest_priority() {
        let rq = queue::<3>(&[(1, 1), (2, 9), (3, 4)]);
        let policy = FixedPriority::new();
        for now in 0..100 {
            assert_eq!(policy.pick(&rq, now), Some(2));
        }
    }

    #[test]
    fn strict_priority_starves_three_low_tasks_for_one_thousand_picks() {
        let rq = queue::<4>(&[(1, 1), (2, 2), (3, 3), (9, 255)]);
        let policy = FixedPriority::new();
        let mut high_picks = 0;
        for now in 0..1_000 {
            if policy.pick(&rq, now) == Some(9) {
                high_picks += 1;
            }
        }
        assert_eq!(high_picks, 1_000);
    }

    #[test]
    fn empty_queue_returns_none_for_each_policy() {
        let rq = RunQueue::<4>::new();
        assert_eq!(RoundRobin::new().pick(&rq, 10), None);
        assert_eq!(FixedPriority::new().pick(&rq, 10), None);
    }

    #[test]
    fn round_robin_skips_blocked_and_dead_tasks() {
        let mut rq = queue::<3>(&[(1, 1), (2, 1), (3, 1)]);
        rq.get_mut(2).unwrap().state = TaskState::Blocked;
        rq.get_mut(3).unwrap().state = TaskState::Dead;
        let policy = RoundRobin::new();
        assert_eq!(policy.pick(&rq, 0), Some(1));
        rq.get_mut(1).unwrap().state = TaskState::Running;
        assert_eq!(policy.pick(&rq, 1), Some(1));
    }
}
