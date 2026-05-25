pub const COLS: usize = 80;
pub const ROWS: usize = 40;
pub const SCREEN_CELLS: usize = COLS * ROWS;
pub const ASCII_SCREEN_BUFFER_BYTES: usize = SCREEN_CELLS + 3;

#[repr(u8)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TerminalMode {
    NominalWorkspace = 0,
    RecoveryConsole = 1,
}

#[repr(C, packed)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AsciiScreenBuffer {
    pub cells: [[u8; COLS]; ROWS],
    pub cursor_x: u8,
    pub cursor_y: u8,
    pub active_mode: u8,
}

impl AsciiScreenBuffer {
    pub const fn new() -> Self {
        Self {
            cells: [[b' '; COLS]; ROWS],
            cursor_x: 0,
            cursor_y: 0,
            active_mode: TerminalMode::NominalWorkspace as u8,
        }
    }

    pub fn clear(&mut self) {
        self.cells = [[b' '; COLS]; ROWS];
        self.cursor_x = 0;
        self.cursor_y = 0;
    }

    pub fn set_mode(&mut self, mode: TerminalMode) {
        self.active_mode = mode as u8;
    }

    pub fn write_str(&mut self, text: &str) {
        for byte in text.bytes() {
            self.write_byte(byte);
        }
    }

    pub fn write_byte(&mut self, byte: u8) {
        match byte {
            b'\n' => self.newline(),
            0x20..=0x7e => {
                if self.cursor_x as usize >= COLS {
                    self.newline();
                }

                self.cells[self.cursor_y as usize][self.cursor_x as usize] = byte;
                self.cursor_x = self.cursor_x.saturating_add(1);
            }
            _ => self.write_byte(b'?'),
        }
    }

    pub fn parse_shell_input(&mut self, input: &[u8]) {
        for byte in input.iter().copied() {
            match byte {
                0x08 | 0x7f => self.backspace(),
                b'\r' => self.newline(),
                _ => self.write_byte(byte),
            }
        }
    }

    pub fn serialize_into(&self, out: &mut [u8]) -> Result<(), TerminalError> {
        if out.len() < ASCII_SCREEN_BUFFER_BYTES {
            clear(out);
            return Err(TerminalError::BufferTooSmall);
        }

        let mut offset = 0;
        for row in 0..ROWS {
            out[offset..offset + COLS].copy_from_slice(&self.cells[row]);
            offset += COLS;
        }
        out[offset] = self.cursor_x;
        out[offset + 1] = self.cursor_y;
        out[offset + 2] = self.active_mode;
        Ok(())
    }

    fn newline(&mut self) {
        self.cursor_x = 0;
        self.cursor_y = ((self.cursor_y as usize + 1) % ROWS) as u8;
        self.cells[self.cursor_y as usize] = [b' '; COLS];
    }

    fn backspace(&mut self) {
        if self.cursor_x == 0 {
            return;
        }

        self.cursor_x -= 1;
        self.cells[self.cursor_y as usize][self.cursor_x as usize] = b' ';
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TerminalError {
    BufferTooSmall,
}

impl Default for AsciiScreenBuffer {
    fn default() -> Self {
        Self::new()
    }
}

fn clear(out: &mut [u8]) {
    for byte in out.iter_mut() {
        *byte = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_and_serializes_fixed_grid() {
        let mut screen = AsciiScreenBuffer::new();
        screen.write_str("MSAR\nready");

        assert_eq!(screen.cells[0][0..4], *b"MSAR");
        assert_eq!(screen.cells[1][0..5], *b"ready");

        let mut out = [0u8; ASCII_SCREEN_BUFFER_BYTES];
        assert_eq!(screen.serialize_into(&mut out), Ok(()));
        assert_eq!(&out[0..4], b"MSAR");
        assert_eq!(out[SCREEN_CELLS], 5);
        assert_eq!(out[SCREEN_CELLS + 1], 1);
    }

    #[test]
    fn clears_small_output_on_error() {
        let screen = AsciiScreenBuffer::new();
        let mut out = [0xff; 16];

        assert_eq!(screen.serialize_into(&mut out), Err(TerminalError::BufferTooSmall));
        assert_eq!(out, [0; 16]);
    }
}
