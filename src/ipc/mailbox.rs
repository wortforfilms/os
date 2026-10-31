//! Kernel message queue for task-to-task messages (svc #5 send, svc #6 recv).
//!
//! Messages are **copied**: on send the kernel copies the bytes out of the
//! sender's memory into this queue, and on receive it copies them into the
//! receiver's buffer. No task ever gets a pointer into another task's memory.
//! The queue lives in kernel RAM, which tasks cannot read (MPU).
//!
//! 16 slots of up to 64 bytes. Each message carries its sender and its
//! destination; a receiver takes the oldest message addressed to it.

pub const SLOTS: usize = 16;
pub const MAX_MESSAGE: usize = 64;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MailboxError {
    /// Every slot is taken.
    Full,
    /// The message is longer than `MAX_MESSAGE`.
    TooLong,
    /// No message for this receiver.
    Empty,
}

#[derive(Clone, Copy)]
struct Message {
    seq: u32,
    from: u8,
    to: u8,
    len: u8,
    data: [u8; MAX_MESSAGE],
}

pub struct Mailbox {
    slots: [Option<Message>; SLOTS],
    next_seq: u32,
}

impl Mailbox {
    pub const fn new() -> Self {
        Self {
            slots: [None; SLOTS],
            next_seq: 0,
        }
    }

    /// Copies `data` into a free slot, addressed from `from` to `to`.
    pub fn send(&mut self, from: u8, to: u8, data: &[u8]) -> Result<(), MailboxError> {
        if data.len() > MAX_MESSAGE {
            return Err(MailboxError::TooLong);
        }
        let slot = self
            .slots
            .iter_mut()
            .find(|s| s.is_none())
            .ok_or(MailboxError::Full)?;
        let mut buf = [0u8; MAX_MESSAGE];
        buf[..data.len()].copy_from_slice(data);
        *slot = Some(Message {
            seq: self.next_seq,
            from,
            to,
            len: data.len() as u8,
            data: buf,
        });
        self.next_seq = self.next_seq.wrapping_add(1);
        Ok(())
    }

    /// Takes the oldest message for `to`, copies up to `out.len()` bytes into
    /// `out` (a longer message is cut), and returns (sender, bytes copied).
    pub fn recv(&mut self, to: u8, out: &mut [u8]) -> Result<(u8, usize), MailboxError> {
        let base = self.next_seq;
        let index = self
            .slots
            .iter()
            .enumerate()
            .filter_map(|(i, s)| {
                s.as_ref()
                    .filter(|m| m.to == to)
                    .map(|m| (i, base.wrapping_sub(m.seq)))
            })
            .max_by_key(|&(_, age)| age)
            .map(|(i, _)| i)
            .ok_or(MailboxError::Empty)?;
        let message = self.slots[index].take().ok_or(MailboxError::Empty)?;
        let n = (message.len as usize).min(out.len());
        out[..n].copy_from_slice(&message.data[..n]);
        Ok((message.from, n))
    }

    /// Drops every message to or from a dead task.
    pub fn forget(&mut self, task: u8) {
        for slot in self.slots.iter_mut() {
            if matches!(slot, Some(m) if m.to == task || m.from == task) {
                *slot = None;
            }
        }
    }

    pub fn len(&self) -> usize {
        self.slots.iter().filter(|s| s.is_some()).count()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

impl Default for Mailbox {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_message_is_copied_and_delivered_once() {
        let mut mb = Mailbox::new();
        let mut text = *b"Hello from Task 1";
        mb.send(1, 2, &text).unwrap();
        text[0] = b'X'; // the sender changing its buffer afterwards changes nothing
        let mut out = [0u8; 64];
        assert_eq!(mb.recv(2, &mut out), Ok((1, 17)));
        assert_eq!(&out[..17], b"Hello from Task 1");
        assert_eq!(text[0], b'X');
        assert_eq!(mb.recv(2, &mut out), Err(MailboxError::Empty));
    }

    #[test]
    fn a_receiver_gets_only_its_own_messages_oldest_first() {
        let mut mb = Mailbox::new();
        mb.send(1, 3, b"for three").unwrap();
        mb.send(1, 2, b"first").unwrap();
        mb.send(4, 2, b"second").unwrap();
        let mut out = [0u8; 64];
        assert_eq!(mb.recv(2, &mut out), Ok((1, 5)));
        assert_eq!(mb.recv(2, &mut out), Ok((4, 6)));
        assert_eq!(&out[..6], b"second");
        assert_eq!(mb.recv(2, &mut out), Err(MailboxError::Empty));
        assert_eq!(mb.recv(3, &mut out), Ok((1, 9)));
    }

    #[test]
    fn limits_full_too_long_and_short_buffers() {
        let mut mb = Mailbox::new();
        assert_eq!(
            mb.send(1, 2, &[0u8; MAX_MESSAGE + 1]),
            Err(MailboxError::TooLong)
        );
        for _ in 0..SLOTS {
            mb.send(1, 2, b"x").unwrap();
        }
        assert_eq!(mb.send(1, 2, b"x"), Err(MailboxError::Full));
        let mut mb = Mailbox::new();
        mb.send(1, 2, b"abcdef").unwrap();
        let mut small = [0u8; 4];
        assert_eq!(mb.recv(2, &mut small), Ok((1, 4)));
        assert_eq!(&small, b"abcd");
    }

    #[test]
    fn messages_of_a_dead_task_are_dropped() {
        let mut mb = Mailbox::new();
        mb.send(1, 5, b"to five").unwrap();
        mb.send(5, 2, b"from five").unwrap();
        mb.send(1, 2, b"keep").unwrap();
        mb.forget(5);
        assert_eq!(mb.len(), 1);
    }
}
