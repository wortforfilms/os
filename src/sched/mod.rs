//! Fixed-capacity, allocation-free task scheduling.
//!
//! Policies choose a runnable task from an explicit run queue and timestamp.
//! They never read the hardware clock, so policy decisions stay deterministic
//! and can be tested on the host.

pub type TaskId = u8;
pub const MAX_TASKS: usize = 9;
/// Reserved scheduler-owned task ID. Applications cannot claim this slot.
pub const IDLE_TASK_ID: TaskId = u8::MAX;
pub const DEFAULT_DEMO_QUANTUM_MS: u32 = 5;
pub const MAX_MUTEXES: usize = 4;
pub const MAX_SEMAPHORES: usize = 4;

/// A kernel-owned, allocation-free mutex. Waiters are queued FIFO and ownership
/// is handed directly to the next live waiter when the owner unlocks.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct KernelMutex {
    pub locked: bool,
    pub owner: Option<TaskId>,
    wait_queue: [Option<TaskId>; MAX_TASKS],
    wait_len: usize,
}

impl KernelMutex {
    pub const fn new() -> Self {
        Self {
            locked: false,
            owner: None,
            wait_queue: [None; MAX_TASKS],
            wait_len: 0,
        }
    }

    fn enqueue(&mut self, id: TaskId) -> Result<(), MutexError> {
        if self.wait_queue[..self.wait_len].contains(&Some(id)) {
            return Err(MutexError::Deadlock);
        }
        if self.wait_len == MAX_TASKS {
            return Err(MutexError::QueueFull);
        }
        self.wait_queue[self.wait_len] = Some(id);
        self.wait_len += 1;
        Ok(())
    }

    fn dequeue(&mut self) -> Option<TaskId> {
        if self.wait_len == 0 {
            return None;
        }
        let next = self.wait_queue[0].take();
        for index in 1..self.wait_len {
            self.wait_queue[index - 1] = self.wait_queue[index].take();
        }
        self.wait_len -= 1;
        next
    }

    fn remove_waiter(&mut self, id: TaskId) {
        let mut write = 0;
        for read in 0..self.wait_len {
            if self.wait_queue[read] != Some(id) {
                self.wait_queue[write] = self.wait_queue[read];
                write += 1;
            }
        }
        for slot in &mut self.wait_queue[write..self.wait_len] {
            *slot = None;
        }
        self.wait_len = write;
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MutexError {
    InvalidId,
    NotOwner,
    Deadlock,
    QueueFull,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LockResult {
    Acquired,
    Blocked,
}

/// Fixed-capacity mutex registry; IDs are stable indexes into this table.
pub struct MutexSet {
    locks: [KernelMutex; MAX_MUTEXES],
}

/// A counting semaphore with FIFO waiters. Initial permit counts are supplied
/// by the kernel at boot; the application cannot mutate the registry shape.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Semaphore {
    pub count: u16,
    wait_queue: [Option<TaskId>; MAX_TASKS],
    wait_len: usize,
}

impl Semaphore {
    pub const fn new(initial_count: u16) -> Self {
        Self {
            count: initial_count,
            wait_queue: [None; MAX_TASKS],
            wait_len: 0,
        }
    }

    fn enqueue(&mut self, task: TaskId) -> Result<(), SemaphoreError> {
        if self.wait_queue[..self.wait_len].contains(&Some(task)) {
            return Err(SemaphoreError::AlreadyWaiting);
        }
        if self.wait_len == MAX_TASKS {
            return Err(SemaphoreError::QueueFull);
        }
        self.wait_queue[self.wait_len] = Some(task);
        self.wait_len += 1;
        Ok(())
    }

    fn dequeue(&mut self) -> Option<TaskId> {
        if self.wait_len == 0 {
            return None;
        }
        let next = self.wait_queue[0].take();
        for index in 1..self.wait_len {
            self.wait_queue[index - 1] = self.wait_queue[index].take();
        }
        self.wait_len -= 1;
        next
    }

    fn remove_waiter(&mut self, task: TaskId) {
        let mut write = 0;
        for read in 0..self.wait_len {
            if self.wait_queue[read] != Some(task) {
                self.wait_queue[write] = self.wait_queue[read];
                write += 1;
            }
        }
        for slot in &mut self.wait_queue[write..self.wait_len] {
            *slot = None;
        }
        self.wait_len = write;
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SemaphoreError {
    InvalidId,
    AlreadyWaiting,
    QueueFull,
    Overflow,
}

/// Fixed-capacity counting semaphore registry. Every semaphore starts at zero.
pub struct SemaphoreSet {
    semaphores: [Semaphore; MAX_SEMAPHORES],
}

impl SemaphoreSet {
    pub const fn new() -> Self {
        Self {
            semaphores: [Semaphore::new(0); MAX_SEMAPHORES],
        }
    }

    pub const fn with_initial_counts(counts: [u16; MAX_SEMAPHORES]) -> Self {
        Self {
            semaphores: [
                Semaphore::new(counts[0]),
                Semaphore::new(counts[1]),
                Semaphore::new(counts[2]),
                Semaphore::new(counts[3]),
            ],
        }
    }

    /// Consumes one permit immediately or adds the task to the FIFO wait queue.
    pub fn wait(&mut self, id: u8, task: TaskId) -> Result<LockResult, SemaphoreError> {
        let semaphore = self
            .semaphores
            .get_mut(id as usize)
            .ok_or(SemaphoreError::InvalidId)?;
        if semaphore.count > 0 {
            semaphore.count -= 1;
            return Ok(LockResult::Acquired);
        }
        semaphore.enqueue(task)?;
        Ok(LockResult::Blocked)
    }

    /// Transfers a permit to the oldest waiter, or increments the available count.
    pub fn post(&mut self, id: u8) -> Result<Option<TaskId>, SemaphoreError> {
        let semaphore = self
            .semaphores
            .get_mut(id as usize)
            .ok_or(SemaphoreError::InvalidId)?;
        if let Some(task) = semaphore.dequeue() {
            return Ok(Some(task));
        }
        semaphore.count = semaphore
            .count
            .checked_add(1)
            .ok_or(SemaphoreError::Overflow)?;
        Ok(None)
    }

    /// Removes a dead task from every wait queue.
    pub fn forget_task(&mut self, task: TaskId) {
        for semaphore in &mut self.semaphores {
            semaphore.remove_waiter(task);
        }
    }
}

impl MutexSet {
    pub const fn new() -> Self {
        Self {
            locks: [KernelMutex::new(); MAX_MUTEXES],
        }
    }

    pub fn lock(&mut self, id: u8, task: TaskId) -> Result<LockResult, MutexError> {
        let lock = self
            .locks
            .get_mut(id as usize)
            .ok_or(MutexError::InvalidId)?;
        if !lock.locked {
            lock.locked = true;
            lock.owner = Some(task);
            return Ok(LockResult::Acquired);
        }
        if lock.owner == Some(task) {
            return Err(MutexError::Deadlock);
        }
        lock.enqueue(task)?;
        Ok(LockResult::Blocked)
    }

    /// Releases an owned lock and transfers ownership to its FIFO waiter.
    pub fn unlock(&mut self, id: u8, task: TaskId) -> Result<Option<TaskId>, MutexError> {
        let lock = self
            .locks
            .get_mut(id as usize)
            .ok_or(MutexError::InvalidId)?;
        if lock.owner != Some(task) {
            return Err(MutexError::NotOwner);
        }
        let next = lock.dequeue();
        lock.owner = next;
        lock.locked = next.is_some();
        Ok(next)
    }

    /// Removes dead tasks from queues and releases any lock they owned.
    pub fn forget_task(&mut self, task: TaskId) -> [Option<TaskId>; MAX_MUTEXES] {
        let mut woke = [None; MAX_MUTEXES];
        for (index, lock) in self.locks.iter_mut().enumerate() {
            lock.remove_waiter(task);
            if lock.owner == Some(task) {
                let next = lock.dequeue();
                lock.owner = next;
                lock.locked = next.is_some();
                woke[index] = next;
            }
        }
        woke
    }
}

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
    /// Deadline in the kernel's 1 kHz monotonic tick domain.
    pub wait_until: Option<u64>,
    wait_for_message: bool,
    waiting_for_uart: bool,
    recv_timed_out: bool,
    waiting_mutex: Option<u8>,
    mutex_acquired: Option<u8>,
    waiting_semaphore: Option<u8>,
    semaphore_acquired: Option<u8>,
    /// Supervisor calls this task may make: bit n allows call n
    /// (`maataa_capsule::cap`). Zero, the default, allows none.
    pub capabilities: u32,
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
            wait_until: None,
            wait_for_message: false,
            waiting_for_uart: false,
            recv_timed_out: false,
            waiting_mutex: None,
            mutex_acquired: None,
            waiting_semaphore: None,
            semaphore_acquired: None,
            capabilities: 0,
            saved_sp: 0,
        }
    }

    /// Grants the supervisor calls in `capabilities` (bit n allows call n).
    pub const fn with_capabilities(mut self, capabilities: u32) -> Self {
        self.capabilities = capabilities;
        self
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

    /// (tasks not dead, tasks added). Used by the host channel's STATUS reply.
    pub fn counts(&self) -> (usize, usize) {
        let alive = self
            .slots
            .iter()
            .filter_map(Option::as_ref)
            .filter(|task| task.state != TaskState::Dead)
            .count();
        (alive, self.len)
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

    /// Makes deadline-expired tasks runnable. Returns whether anything woke.
    pub fn wake_expired(&mut self, now: u64) -> bool {
        let mut woke = false;
        for task in self.slots.iter_mut().filter_map(Option::as_mut) {
            if task.state == TaskState::Blocked
                && task.wait_until.is_some_and(|deadline| now >= deadline)
            {
                task.state = TaskState::Ready;
                task.wait_until = None;
                if task.wait_for_message {
                    task.recv_timed_out = true;
                }
                task.wait_for_message = false;
                woke = true;
            }
        }
        woke
    }

    /// Wakes a task blocked in receive after a message has been enqueued.
    pub fn wake_waiting_receiver(&mut self, id: TaskId) -> bool {
        let Some(task) = self.get_mut(id) else {
            return false;
        };
        if task.state != TaskState::Blocked || !task.wait_for_message {
            return false;
        }
        task.state = TaskState::Ready;
        task.wait_until = None;
        task.wait_for_message = false;
        true
    }

    /// Blocks the running task until a UART byte arrives.
    pub fn block_waiting_uart(&mut self, id: TaskId) -> bool {
        let Some(task) = self.get_mut(id) else {
            return false;
        };
        if task.state != TaskState::Running {
            return false;
        }
        task.state = TaskState::Blocked;
        task.wait_until = None;
        task.wait_for_message = false;
        task.waiting_for_uart = true;
        true
    }

    /// Wakes one task waiting for UART input; subsequent readers re-check the
    /// FIFO and block again if another task consumed the available byte.
    pub fn wake_waiting_uart(&mut self) -> bool {
        let Some(task) = self
            .slots
            .iter_mut()
            .filter_map(Option::as_mut)
            .find(|task| task.state == TaskState::Blocked && task.waiting_for_uart)
        else {
            return false;
        };
        task.state = TaskState::Ready;
        task.wait_until = None;
        task.waiting_for_uart = false;
        true
    }

    /// Consumes the timeout completion after a blocked receive resumes.
    pub fn take_recv_timeout(&mut self, id: TaskId) -> bool {
        let Some(task) = self.get_mut(id) else {
            return false;
        };
        core::mem::replace(&mut task.recv_timed_out, false)
    }

    pub fn wake_mutex_waiter(&mut self, id: TaskId, mutex_id: u8) -> bool {
        let Some(task) = self.get_mut(id) else {
            return false;
        };
        if task.state != TaskState::Blocked || task.waiting_mutex != Some(mutex_id) {
            return false;
        }
        task.state = TaskState::Ready;
        task.wait_until = None;
        task.waiting_mutex = None;
        task.mutex_acquired = Some(mutex_id);
        true
    }

    pub fn take_mutex_acquired(&mut self, id: TaskId, mutex_id: u8) -> bool {
        let Some(task) = self.get_mut(id) else {
            return false;
        };
        if task.mutex_acquired != Some(mutex_id) {
            return false;
        }
        task.mutex_acquired = None;
        true
    }

    pub fn wake_semaphore_waiter(&mut self, id: TaskId, semaphore_id: u8) -> bool {
        let Some(task) = self.get_mut(id) else {
            return false;
        };
        if task.state != TaskState::Blocked || task.waiting_semaphore != Some(semaphore_id) {
            return false;
        }
        task.state = TaskState::Ready;
        task.wait_until = None;
        task.waiting_semaphore = None;
        task.semaphore_acquired = Some(semaphore_id);
        true
    }

    pub fn take_semaphore_acquired(&mut self, id: TaskId, semaphore_id: u8) -> bool {
        let Some(task) = self.get_mut(id) else {
            return false;
        };
        if task.semaphore_acquired != Some(semaphore_id) {
            return false;
        }
        task.semaphore_acquired = None;
        true
    }
}

impl<const N: usize> Default for RunQueue<N> {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod mutex_tests {
    use super::*;

    #[test]
    fn mutex_hands_ownership_to_waiters_in_fifo_order() {
        let mut locks = MutexSet::new();
        assert_eq!(locks.lock(0, 1), Ok(LockResult::Acquired));
        assert_eq!(locks.lock(0, 2), Ok(LockResult::Blocked));
        assert_eq!(locks.lock(0, 3), Ok(LockResult::Blocked));
        assert_eq!(locks.unlock(0, 1), Ok(Some(2)));
        assert_eq!(locks.lock(0, 2), Err(MutexError::Deadlock));
        assert_eq!(locks.unlock(0, 2), Ok(Some(3)));
        assert_eq!(locks.unlock(0, 3), Ok(None));
    }

    #[test]
    fn mutex_rejects_wrong_owner_and_invalid_ids() {
        let mut locks = MutexSet::new();
        assert_eq!(locks.lock(7, 1), Err(MutexError::InvalidId));
        assert_eq!(locks.lock(0, 1), Ok(LockResult::Acquired));
        assert_eq!(locks.unlock(0, 2), Err(MutexError::NotOwner));
    }

    #[test]
    fn removing_a_task_preserves_other_waiters_and_hands_off_owner_lock() {
        let mut locks = MutexSet::new();
        assert_eq!(locks.lock(0, 1), Ok(LockResult::Acquired));
        assert_eq!(locks.lock(0, 2), Ok(LockResult::Blocked));
        assert_eq!(locks.lock(0, 3), Ok(LockResult::Blocked));
        let woke = locks.forget_task(2);
        assert_eq!(woke, [None; MAX_MUTEXES]);
        let woke = locks.forget_task(1);
        assert_eq!(woke[0], Some(3));
        assert_eq!(locks.unlock(0, 3), Ok(None));
    }
}

#[cfg(test)]
mod semaphore_tests {
    use super::*;

    #[test]
    fn semaphore_consumes_permits_and_hands_posts_to_fifo_waiters() {
        let mut semaphores = SemaphoreSet::with_initial_counts([2, 0, 0, 0]);
        assert_eq!(semaphores.wait(0, 1), Ok(LockResult::Acquired));
        assert_eq!(semaphores.wait(0, 2), Ok(LockResult::Acquired));
        assert_eq!(semaphores.wait(0, 3), Ok(LockResult::Blocked));
        assert_eq!(semaphores.wait(0, 4), Ok(LockResult::Blocked));
        assert_eq!(semaphores.post(0), Ok(Some(3)));
        assert_eq!(semaphores.post(0), Ok(Some(4)));
        assert_eq!(semaphores.post(0), Ok(None));
        assert_eq!(semaphores.wait(0, 5), Ok(LockResult::Acquired));
    }

    #[test]
    fn semaphore_rejects_invalid_duplicate_full_and_overflow_cases() {
        let mut semaphores = SemaphoreSet::with_initial_counts([u16::MAX, 0, 0, 0]);
        assert_eq!(semaphores.wait(4, 1), Err(SemaphoreError::InvalidId));
        assert_eq!(semaphores.post(4), Err(SemaphoreError::InvalidId));
        assert_eq!(semaphores.post(0), Err(SemaphoreError::Overflow));
        assert_eq!(semaphores.wait(1, 1), Ok(LockResult::Blocked));
        assert_eq!(semaphores.wait(1, 1), Err(SemaphoreError::AlreadyWaiting));
    }

    #[test]
    fn removing_a_task_keeps_other_semaphore_waiters_in_order() {
        let mut semaphores = SemaphoreSet::new();
        assert_eq!(semaphores.wait(0, 1), Ok(LockResult::Blocked));
        assert_eq!(semaphores.wait(0, 2), Ok(LockResult::Blocked));
        semaphores.forget_task(1);
        assert_eq!(semaphores.post(0), Ok(Some(2)));
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
        let mut idle = None;
        for offset in 0..N {
            let index = (start + offset) % N;
            if let Some(task) = rq.slots[index].as_ref() {
                if !matches!(task.state, TaskState::Ready | TaskState::Running) {
                    continue;
                }
                if task.id == IDLE_TASK_ID {
                    idle = Some(task.id);
                } else {
                    return Some(task.id);
                }
            }
        }
        idle
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

    const IDLE_STACK_BYTES: usize = 256;
    #[repr(C, align(256))]
    struct IdleStack([u8; IDLE_STACK_BYTES]);
    static mut IDLE_STACK: IdleStack = IdleStack([0; IDLE_STACK_BYTES]);

    struct Runtime {
        queue: RunQueue<{ MAX_TASKS + 1 }>,
        policy: RoundRobin,
        current: Option<TaskId>,
        quantum_ticks: u32,
        last_dispatch_tick: u64,
        mutexes: MutexSet,
        semaphores: SemaphoreSet,
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
        ReservedTaskId,
        AlreadyStarted,
    }

    impl StartError {
        /// For the log; plain text, so the kernel needs no `Debug` formatting.
        pub const fn as_str(self) -> &'static str {
            match self {
                Self::EmptyQueue => "empty queue",
                Self::NoRunnableTasks => "no runnable tasks",
                Self::ZeroQuantum => "zero quantum",
                Self::StackTooSmall => "a task stack is too small",
                Self::StackNotProtectable => "a task stack cannot be one MPU region",
                Self::ReservedTaskId => "a reserved task id",
                Self::AlreadyStarted => "already started",
            }
        }
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
        if queue.iter().any(|task| task.id == IDLE_TASK_ID) {
            return Err(StartError::ReservedTaskId);
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
        // A private, lowest-priority task gives the scheduler somewhere safe
        // to run while every application task is blocked or dead.
        let idle_stack = unsafe {
            core::slice::from_raw_parts_mut(
                core::ptr::addr_of_mut!(IDLE_STACK).cast::<u8>(),
                IDLE_STACK_BYTES,
            )
        };
        let mut idle_task = Task::new(IDLE_TASK_ID, idle_stack, idle_entry, 0);
        if !crate::mpu::region_ok(idle_task.stack.as_ptr() as usize, idle_task.stack.len()) {
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
        idle_task.saved_sp = initialize_stack(&mut idle_task).ok_or_else(|| {
            STARTED.store(false, Ordering::Release);
            StartError::StackTooSmall
        })?;
        let mut runtime_queue = RunQueue::<{ MAX_TASKS + 1 }>::new();
        for task in queue.slots.into_iter().flatten() {
            runtime_queue
                .add(task)
                .map_err(|_| StartError::EmptyQueue)?;
        }
        runtime_queue
            .add(idle_task)
            .map_err(|_| StartError::EmptyQueue)?;
        let now = crate::clock::get_ticks();
        interrupt::free(|cs| {
            *RUNTIME.borrow(cs).borrow_mut() = Some(Runtime {
                queue: runtime_queue,
                policy: RoundRobin::new(),
                current: None,
                quantum_ticks,
                last_dispatch_tick: now,
                mutexes: MutexSet::new(),
                semaphores: SemaphoreSet::new(),
            });
        });
        // PendSV must be the lowest-priority exception. SysTick only measures
        // time and requests this deferred context switch.
        unsafe { scb.set_priority(SystemHandler::PendSV, u8::MAX) };
        // MemManage must be able to preempt the kernel's own handlers: a
        // fault inside a supervisor call or the tick would otherwise escalate
        // to HardFault (equal priority cannot preempt). Kernel handlers get
        // 0x40; MemManage keeps 0, the highest configurable priority.
        unsafe {
            scb.set_priority(SystemHandler::MemoryManagement, 0);
            scb.set_priority(SystemHandler::SVCall, 0x40);
            scb.set_priority(SystemHandler::SysTick, 0x40);
        }
        // From the first switch on, tasks run unprivileged inside their MPU
        // regions (PendSV sets CONTROL.nPRIV).
        crate::mpu::enable();
        SCB::set_pendsv();
        Ok(())
    }

    /// The running task's id.
    pub fn current_task() -> Option<TaskId> {
        interrupt::free(|cs| {
            RUNTIME
                .borrow(cs)
                .borrow()
                .as_ref()
                .and_then(|rt| rt.current)
        })
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

    /// Blocks the running task until `deadline` (1 kHz monotonic ticks).
    /// PendSV performs the switch after the current supervisor call returns.
    pub fn block_current_until(deadline: u64, waiting_for_message: bool) -> bool {
        let blocked = interrupt::free(|cs| {
            let mut shared = RUNTIME.borrow(cs).borrow_mut();
            let rt = shared.as_mut()?;
            let id = rt.current?;
            let task = rt.queue.get_mut(id)?;
            task.state = TaskState::Blocked;
            task.wait_until = Some(deadline);
            task.wait_for_message = waiting_for_message;
            task.recv_timed_out = false;
            Some(())
        })
        .is_some();
        if blocked {
            SCB::set_pendsv();
        }
        blocked
    }

    /// Parks the running task until USART2's receive interrupt supplies data.
    /// Callers must hold an interrupt critical section across their FIFO-empty
    /// check and this state transition to prevent a lost wake-up.
    pub fn block_current_for_uart(cs: &cortex_m::interrupt::CriticalSection) -> bool {
        let mut shared = RUNTIME.borrow(cs).borrow_mut();
        let Some(rt) = shared.as_mut() else {
            return false;
        };
        let Some(id) = rt.current else {
            return false;
        };
        rt.queue.block_waiting_uart(id)
    }

    /// Requests the deferred context switch after an atomic block transition.
    pub fn pend_scheduler_switch() {
        SCB::set_pendsv();
    }

    /// Attempts to lock a kernel mutex and parks the task atomically on contention.
    pub fn mutex_lock_current(id: u8) -> Result<LockResult, MutexError> {
        let (result, blocked) = interrupt::free(|cs| {
            let mut shared = RUNTIME.borrow(cs).borrow_mut();
            let rt = shared.as_mut().ok_or(MutexError::InvalidId)?;
            let task_id = rt.current.ok_or(MutexError::InvalidId)?;
            if rt.queue.take_mutex_acquired(task_id, id) {
                return Ok((LockResult::Acquired, false));
            }
            match rt.mutexes.lock(id, task_id)? {
                LockResult::Acquired => Ok((LockResult::Acquired, false)),
                LockResult::Blocked => {
                    let task = rt.queue.get_mut(task_id).ok_or(MutexError::InvalidId)?;
                    task.state = TaskState::Blocked;
                    task.wait_until = None;
                    task.waiting_mutex = Some(id);
                    task.wait_for_message = false;
                    Ok((LockResult::Blocked, true))
                }
            }
        })?;
        if blocked {
            SCB::set_pendsv();
        }
        Ok(result)
    }

    /// Unlocks the current task's mutex and wakes the FIFO successor, if any.
    pub fn mutex_unlock_current(id: u8) -> Result<(), MutexError> {
        let woke = interrupt::free(|cs| {
            let mut shared = RUNTIME.borrow(cs).borrow_mut();
            let rt = shared.as_mut().ok_or(MutexError::InvalidId)?;
            let task_id = rt.current.ok_or(MutexError::InvalidId)?;
            let next = rt.mutexes.unlock(id, task_id)?;
            if let Some(next) = next {
                rt.queue.wake_mutex_waiter(next, id);
            }
            Ok::<_, MutexError>(next.is_some())
        })?;
        if woke {
            SCB::set_pendsv();
        }
        Ok(())
    }

    /// Consumes a semaphore permit, or parks the caller until one is posted.
    pub fn semaphore_wait_current(id: u8) -> Result<LockResult, SemaphoreError> {
        let (result, blocked) = interrupt::free(|cs| {
            let mut shared = RUNTIME.borrow(cs).borrow_mut();
            let rt = shared.as_mut().ok_or(SemaphoreError::InvalidId)?;
            let task_id = rt.current.ok_or(SemaphoreError::InvalidId)?;
            if rt.queue.take_semaphore_acquired(task_id, id) {
                return Ok((LockResult::Acquired, false));
            }
            match rt.semaphores.wait(id, task_id)? {
                LockResult::Acquired => Ok((LockResult::Acquired, false)),
                LockResult::Blocked => {
                    let task = rt.queue.get_mut(task_id).ok_or(SemaphoreError::InvalidId)?;
                    task.state = TaskState::Blocked;
                    task.wait_until = None;
                    task.waiting_semaphore = Some(id);
                    task.wait_for_message = false;
                    Ok((LockResult::Blocked, true))
                }
            }
        })?;
        if blocked {
            SCB::set_pendsv();
        }
        Ok(result)
    }

    /// Adds a permit or wakes the oldest waiter without exposing a race window.
    pub fn semaphore_post_current(id: u8) -> Result<(), SemaphoreError> {
        let woke = interrupt::free(|cs| {
            let mut shared = RUNTIME.borrow(cs).borrow_mut();
            let rt = shared.as_mut().ok_or(SemaphoreError::InvalidId)?;
            let next = rt.semaphores.post(id)?;
            if let Some(next) = next {
                rt.queue.wake_semaphore_waiter(next, id);
            }
            Ok::<_, SemaphoreError>(next.is_some())
        })?;
        if woke {
            SCB::set_pendsv();
        }
        Ok(())
    }

    /// Wakes a receiver when a message is queued for it.
    pub fn wake_waiting_receiver(id: TaskId) -> bool {
        let woke = interrupt::free(|cs| {
            RUNTIME
                .borrow(cs)
                .borrow_mut()
                .as_mut()
                .is_some_and(|rt| rt.queue.wake_waiting_receiver(id))
        });
        if woke {
            SCB::set_pendsv();
        }
        woke
    }

    /// Called after a byte enters the UART FIFO; wakes one blocked reader.
    pub fn wake_waiting_uart_reader() -> bool {
        let woke = interrupt::free(|cs| {
            RUNTIME
                .borrow(cs)
                .borrow_mut()
                .as_mut()
                .is_some_and(|rt| rt.queue.wake_waiting_uart())
        });
        if woke {
            SCB::set_pendsv();
        }
        woke
    }

    /// Returns and clears a timed-out receive completion for the running task.
    pub fn take_recv_timeout() -> bool {
        interrupt::free(|cs| {
            let mut shared = RUNTIME.borrow(cs).borrow_mut();
            let Some(rt) = shared.as_mut() else {
                return false;
            };
            let Some(id) = rt.current else { return false };
            rt.queue.take_recv_timeout(id)
        })
    }

    /// Whether task `id` exists and is not dead.
    pub fn task_alive(id: TaskId) -> bool {
        interrupt::free(|cs| {
            RUNTIME
                .borrow(cs)
                .borrow()
                .as_ref()
                .and_then(|rt| rt.queue.get(id).map(|t| t.state != TaskState::Dead))
                .unwrap_or(false)
        })
    }

    /// Capabilities of the running task, or `None` when no task is running
    /// (kernel code before the scheduler starts).
    pub fn current_capabilities() -> Option<u32> {
        interrupt::free(|cs| {
            let shared = RUNTIME.borrow(cs).borrow();
            let rt = shared.as_ref()?;
            let id = rt.current?;
            rt.queue.get(id).map(|t| t.capabilities)
        })
    }

    /// (alive, total) task counts; (0, 0) before the scheduler starts.
    pub fn task_counts() -> (usize, usize) {
        interrupt::free(|cs| {
            RUNTIME
                .borrow(cs)
                .borrow()
                .as_ref()
                .map_or((0, 0), |rt| rt.queue.counts())
        })
    }

    /// Marks the running task dead; the scheduler never picks it again.
    pub fn kill_current() -> Option<TaskId> {
        let (dead, woke) = interrupt::free(|cs| {
            let mut shared = RUNTIME.borrow(cs).borrow_mut();
            let rt = shared.as_mut()?;
            let id = rt.current?;
            rt.queue.get_mut(id)?.state = TaskState::Dead;
            let woke = rt.mutexes.forget_task(id);
            for (mutex_id, waiter) in woke.iter().enumerate() {
                if let Some(waiter) = waiter {
                    rt.queue.wake_mutex_waiter(*waiter, mutex_id as u8);
                }
            }
            rt.semaphores.forget_task(id);
            Some((id, woke.iter().any(Option::is_some)))
        })?;
        crate::syscall::forget_task(dead);
        if woke {
            SCB::set_pendsv();
        }
        Some(dead)
    }

    /// Where a killed task is sent until the next switch: an idle loop.
    pub fn task_exit_address() -> u32 {
        task_exit as *const () as usize as u32
    }

    /// Called after `clock::on_systick()`. It only requests PendSV; no task
    /// state or register context is changed in the measurement handler.
    pub fn on_systick() {
        // The tick runs, so interrupts are on and no fault handler is stuck:
        // feed the watchdog (src/watchdog.rs).
        crate::watchdog::feed();
        let now = crate::clock::get_ticks();
        let (woke, quantum_expired) = interrupt::free(|cs| {
            let mut shared = RUNTIME.borrow(cs).borrow_mut();
            let Some(runtime) = shared.as_mut() else {
                return (false, false);
            };
            let woke = runtime.queue.wake_expired(now);
            let quantum_expired = runtime.current.is_some()
                && now.wrapping_sub(runtime.last_dispatch_tick) >= runtime.quantum_ticks as u64;
            (woke, quantum_expired)
        });
        if woke || quantum_expired {
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
            frame.add(14).write(task_exit as *const () as usize as u32);
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

    fn idle_entry() -> ! {
        task_exit()
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
        let _ = exc_return; // a task fault: thread mode on PSP (the stub checked)
                            // SAFETY: a plain read of a kernel word, for the report only.
        let target = unsafe { core::ptr::addr_of!(crate::mpu::FAULT_TEST_TARGET).read_volatile() };
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

    /// A memory fault in the kernel itself (handler mode, or the boot thread,
    /// on the main stack). The stub has already moved MSP back to the top of
    /// the main stack, so this report runs even when the old stack pointer sat
    /// in the guard. The kernel cannot recover from its own bug: report, stop.
    #[no_mangle]
    extern "C" fn __maataa_kernel_fault(old_msp: u32, exc_return: u32) -> ! {
        let (status, address) = crate::mpu::fault_status();
        let at = if status & MMARVALID != 0 { address } else { 0 };
        let (guard, size) = crate::mpu::kernel_guard();
        let guard_end = (guard + size) as u32;
        let hit_guard =
            (at != 0 && at >= guard as u32 && at < guard_end) || old_msp < guard_end + 32;
        crate::crash::record(
            if hit_guard {
                crate::crash::CrashKind::KernelStackOverflow
            } else {
                crate::crash::CrashKind::KernelMemoryFault
            },
            at,
            status as u32,
        );
        if hit_guard {
            crate::logging::kprintln!(
                "KERNEL STACK OVERFLOW: the main stack reached its guard {:#010x}..{:#010x} (sp {:#010x}, {} at {:#010x}, mmfsr={:#04x}); system stopped",
                guard,
                guard_end,
                old_msp,
                kind(status),
                at,
                status
            );
        } else {
            crate::logging::kprintln!(
                "KERNEL MEMORY FAULT: {} at {:#010x} (sp {:#010x}, exc_return {:#010x}, mmfsr={:#04x}); system stopped",
                kind(status),
                at,
                old_msp,
                exc_return,
                status
            );
        }
        loop {
            cortex_m::asm::nop();
        }
    }

    /// HardFault. MSP is reset first by the stub; the stacked frame is read
    /// only if it lies in memory that is safe to read.
    #[no_mangle]
    extern "C" fn __maataa_hardfault(frame: u32, exc_return: u32) -> ! {
        // SAFETY: plain reads of the fault status registers.
        let (cfsr, hfsr, mmfar, bfar) = unsafe {
            let scb = &*SCB::PTR;
            (
                scb.cfsr.read(),
                scb.hfsr.read(),
                scb.mmfar.read(),
                scb.bfar.read(),
            )
        };
        let (guard, size) = crate::mpu::kernel_guard();
        let from_task = exc_return & 0b0100 != 0;
        let readable = if from_task {
            match super::current_stack() {
                Some((base, len)) => crate::mpu::contains(base, len, frame as usize, 32),
                None => false,
            }
        } else {
            frame as usize >= guard + size && (frame as usize) + 32 <= crate::mpu::main_stack_top()
        };
        // SAFETY: only when the frame lies in a task stack or above the guard.
        let (pc, lr) = if readable {
            unsafe {
                (
                    (frame as *const u32).add(6).read(),
                    (frame as *const u32).add(5).read(),
                )
            }
        } else {
            (0, 0)
        };
        crate::crash::record(crate::crash::CrashKind::HardFault, pc, cfsr);
        crate::logging::kprintln!(
            "HARD FAULT pc={:#010x} lr={:#010x} cfsr={:#010x} hfsr={:#010x} bfar={:#010x} mmfar={:#010x} ({}); system stopped",
            pc,
            lr,
            cfsr,
            hfsr,
            bfar,
            mmfar,
            if from_task { "in a task" } else { "in the kernel" }
        );
        loop {
            cortex_m::asm::nop();
        }
    }

    core::arch::global_asm!(
        ".syntax unified",
        ".thumb",
        ".section .text.HardFault, \"ax\"",
        ".global HardFault",
        ".type HardFault,%function",
        ".thumb_func",
        "HardFault:",
        "tst lr, #4",
        "ite eq",
        "mrseq r0, msp",
        "mrsne r0, psp",
        "mov r1, lr",
        // Move MSP back to the top before anything is pushed: the old main
        // stack may be in or next to the guard.
        "ldr r2, =_stack_start",
        "msr msp, r2",
        "bl __maataa_hardfault",
        ".ltorg",
        ".size HardFault, .-HardFault",
    );

    core::arch::global_asm!(
        ".syntax unified",
        ".thumb",
        ".section .text.MemoryManagement, \"ax\"",
        ".global MemoryManagement",
        ".type MemoryManagement,%function",
        ".thumb_func",
        "MemoryManagement:",
        "tst lr, #4",
        "bne 1f",
        // Kernel fault (main stack): move MSP back to the top before any push,
        // because the old stack pointer may sit in the guard; then report.
        "mrs r0, msp",
        "mov r1, lr",
        "ldr r2, =_stack_start",
        "msr msp, r2",
        "bl __maataa_kernel_fault",
        "1:",
        // Task fault. The handler returns the EXC_RETURN to leave with:
        // normally the one it was entered with, or a basic-frame return after
        // a task stack overflow.
        "mrs r0, psp",
        "mov r1, lr",
        "bl __maataa_memfault",
        "bx r0",
        ".ltorg",
        ".size MemoryManagement, .-MemoryManagement",
    );
}

#[cfg(target_arch = "arm")]
#[allow(unused_imports)]
pub use cortex_m_runtime::{
    block_current_for_uart, block_current_until, current_capabilities, current_stack, current_task,
    kill_current, mutex_lock_current, mutex_unlock_current, on_systick, pend_scheduler_switch,
    semaphore_post_current, semaphore_wait_current, start_round_robin, take_recv_timeout,
    task_alive, task_counts, task_exit_address, wake_waiting_receiver, wake_waiting_uart_reader,
    StartError,
};

impl Default for KernelMutex {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for SemaphoreSet {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for MutexSet {
    fn default() -> Self {
        Self::new()
    }
}

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
    fn reserved_idle_task_runs_only_when_application_tasks_are_not_runnable() {
        let mut rq = queue::<3>(&[(1, 1), (2, 1), (IDLE_TASK_ID, 0)]);
        rq.get_mut(1).unwrap().state = TaskState::Blocked;
        rq.get_mut(2).unwrap().state = TaskState::Ready;
        assert_eq!(RoundRobin::new().pick(&rq, 0), Some(2));
        rq.get_mut(2).unwrap().state = TaskState::Blocked;
        assert_eq!(RoundRobin::new().pick(&rq, 0), Some(IDLE_TASK_ID));
    }

    #[test]
    fn blocked_receiver_wakes_on_message_and_timeout_is_recorded() {
        let mut rq = queue::<1>(&[(2, 1)]);
        let task = rq.get_mut(2).unwrap();
        task.state = TaskState::Blocked;
        task.wait_until = Some(1_000);
        task.wait_for_message = true;
        assert!(rq.wake_waiting_receiver(2));
        assert_eq!(rq.get(2).unwrap().state, TaskState::Ready);
        assert_eq!(rq.get(2).unwrap().wait_until, None);
        assert!(!rq.take_recv_timeout(2));

        let task = rq.get_mut(2).unwrap();
        task.state = TaskState::Blocked;
        task.wait_until = Some(2_000);
        task.wait_for_message = true;
        assert!(!rq.wake_expired(1_999));
        assert!(rq.wake_expired(2_000));
        assert_eq!(rq.get(2).unwrap().state, TaskState::Ready);
        assert!(rq.take_recv_timeout(2));
        assert!(!rq.take_recv_timeout(2));
    }

    #[test]
    fn tasks_start_with_no_capabilities_until_granted() {
        assert_eq!(task(1, 1).capabilities, 0);
        assert_eq!(task(1, 1).with_capabilities(0b110).capabilities, 0b110);
    }

    #[test]
    fn counts_report_alive_and_total_tasks() {
        let mut rq = queue::<4>(&[(1, 1), (2, 1), (3, 1)]);
        assert_eq!(rq.counts(), (3, 3));
        rq.get_mut(2).unwrap().state = TaskState::Dead;
        assert_eq!(rq.counts(), (2, 3));
    }

    #[test]
    fn uart_irq_wakes_one_waiter_and_leaves_other_tasks_blocked() {
        let mut rq = queue::<3>(&[(1, 1), (2, 1), (3, 1)]);
        rq.get_mut(1).unwrap().state = TaskState::Running;
        rq.get_mut(2).unwrap().state = TaskState::Running;
        assert!(rq.block_waiting_uart(1));
        assert!(rq.block_waiting_uart(2));

        assert!(rq.wake_waiting_uart());
        assert_eq!(rq.get(1).unwrap().state, TaskState::Ready);
        assert_eq!(rq.get(2).unwrap().state, TaskState::Blocked);
        assert!(!rq.get(1).unwrap().waiting_for_uart);
        assert!(rq.get(2).unwrap().waiting_for_uart);
        assert!(rq.wake_waiting_uart());
        assert_eq!(rq.get(2).unwrap().state, TaskState::Ready);
        assert!(!rq.wake_waiting_uart());
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
