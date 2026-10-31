//! A small WebAssembly interpreter for Maataa OS capsules.
//!
//! It is `no_std`, allocation-free, and keeps every stack in fixed arrays,
//! so one instance fits in a task stack. It runs a deliberately small subset
//! of WebAssembly 1.0 and rejects anything outside it at load time:
//!
//! - values: `i32` only (parameters, results, locals, globals);
//! - control: `block`, `loop`, `if`/`else`, `br`, `br_if`, `br_table`,
//!   `return`, `call`, `unreachable`, `nop`;
//! - `drop`, `select`, locals, globals (`i32.const` initialisers), and every
//!   `i32` comparison and arithmetic instruction;
//! - imported functions only (no imported globals, memories or tables);
//! - one linear memory with active data segments, `i32` loads and stores
//!   (`load`, `load8/16_s/u`, `store`, `store8/16`), `memory.size` and
//!   `memory.grow`.
//!
//! **Memory is bounded by the host.** The host passes a byte buffer (a few
//! KiB in the kernel) and the module sees at most that much of its declared
//! memory: any access beyond the buffer traps, `memory.size` reports the
//! declared minimum, and `memory.grow` always fails (returns -1). A module
//! whose data segments do not fit the buffer is refused at instantiation.
//!
//! There is no table, `call_indirect`, start function, float or `i64`. Every
//! body is scanned once at load: opcodes, local, global, function, branch
//! and memory use are checked then. At run time each call has a fuel limit
//! (instructions), the operand, label and call stacks are bounded, and every
//! trap the specification defines for this subset is raised.

#![cfg_attr(not(test), no_std)]

pub const MAX_TYPES: usize = 16;
pub const MAX_IMPORTS: usize = 8;
pub const MAX_FUNCS: usize = 32;
pub const MAX_GLOBALS: usize = 8;
pub const MAX_EXPORTS: usize = 24;
pub const MAX_DATA: usize = 8;
/// WebAssembly page size.
pub const PAGE: u32 = 65_536;
pub const MAX_PARAMS: usize = 8;
/// Parameters plus declared locals of one function.
pub const MAX_LOCALS: usize = 32;
pub const VALUE_STACK: usize = 128;
pub const LABEL_STACK: usize = 32;
pub const CALL_DEPTH: usize = 16;
/// Deepest block nesting accepted at load time.
const MAX_NESTING: usize = 32;

const I32: u8 = 0x7F;
const EMPTY_BLOCK: u8 = 0x40;

/// Why a module was not loaded.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Error {
    Truncated,
    BadMagic,
    BadVersion,
    /// A feature outside the supported subset.
    Unsupported(&'static str),
    /// More items than the fixed tables hold.
    TooMany(&'static str),
    BadIndex(&'static str),
    Malformed(&'static str),
}

impl Error {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Truncated => "truncated module",
            Self::BadMagic => "not a wasm module",
            Self::BadVersion => "unsupported wasm version",
            Self::Unsupported(what)
            | Self::TooMany(what)
            | Self::BadIndex(what)
            | Self::Malformed(what) => what,
        }
    }
}

/// Why a call stopped.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Trap {
    Unreachable,
    DivideByZero,
    IntegerOverflow,
    StackOverflow,
    StackUnderflow,
    CallDepth,
    OutOfFuel,
    NoSuchExport,
    BadArguments,
    UnresolvedImport,
    /// The host refused or failed a call; the code is the host's.
    Host(u32),
    /// Code that should have been rejected at load time.
    BadCode,
    /// A load, store or data segment outside the memory buffer.
    OutOfBounds,
}

impl Trap {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Unreachable => "unreachable executed",
            Self::DivideByZero => "integer divide by zero",
            Self::IntegerOverflow => "integer overflow",
            Self::StackOverflow => "operand or label stack overflow",
            Self::StackUnderflow => "operand stack underflow",
            Self::CallDepth => "call depth exceeded",
            Self::OutOfFuel => "out of fuel",
            Self::NoSuchExport => "no such export",
            Self::BadArguments => "wrong argument count",
            Self::UnresolvedImport => "unresolved import",
            Self::Host(_) => "host call failed",
            Self::BadCode => "invalid code",
            Self::OutOfBounds => "memory access out of bounds",
        }
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct FuncType {
    pub params: u8,
    pub results: u8,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct Import<'a> {
    pub module: &'a str,
    pub name: &'a str,
    pub ty: FuncType,
}

#[derive(Clone, Copy, Debug, Default)]
struct Func {
    ty: FuncType,
    /// Declared locals beyond the parameters.
    locals: u8,
    /// First instruction.
    code: u32,
    /// The body's final `end`.
    end: u32,
}

#[derive(Clone, Copy, Debug, Default)]
struct Global {
    mutable: bool,
    init: i32,
}

/// An active data segment: bytes copied to `offset` at instantiation.
#[derive(Clone, Copy, Debug, Default)]
struct Data {
    offset: u32,
    start: u32,
    len: u32,
}

#[derive(Clone, Copy, Debug, Default)]
struct Export<'a> {
    name: &'a str,
    func: u16,
}

/// A parsed and checked module, borrowing its bytes.
pub struct Module<'a> {
    bytes: &'a [u8],
    types: [FuncType; MAX_TYPES],
    n_types: usize,
    imports: [Import<'a>; MAX_IMPORTS],
    n_imports: usize,
    funcs: [Func; MAX_FUNCS],
    n_funcs: usize,
    globals: [Global; MAX_GLOBALS],
    n_globals: usize,
    exports: [Export<'a>; MAX_EXPORTS],
    n_exports: usize,
    /// Declared minimum pages, if the module has a memory.
    memory_pages: Option<u32>,
    data: [Data; MAX_DATA],
    n_data: usize,
}

struct Reader<'a> {
    bytes: &'a [u8],
    pos: usize,
    end: usize,
}

impl<'a> Reader<'a> {
    fn byte(&mut self) -> Result<u8, Error> {
        if self.pos >= self.end {
            return Err(Error::Truncated);
        }
        let b = self.bytes[self.pos];
        self.pos += 1;
        Ok(b)
    }

    fn u32(&mut self) -> Result<u32, Error> {
        let mut result: u32 = 0;
        for shift in (0..35).step_by(7) {
            let b = self.byte()?;
            if shift == 28 && b & 0x70 != 0 {
                return Err(Error::Malformed("LEB128 u32 too long"));
            }
            result |= ((b & 0x7F) as u32) << shift;
            if b & 0x80 == 0 {
                return Ok(result);
            }
        }
        Err(Error::Malformed("LEB128 u32 too long"))
    }

    fn i32(&mut self) -> Result<i32, Error> {
        let mut result: i64 = 0;
        let mut shift = 0;
        loop {
            let b = self.byte()?;
            result |= ((b & 0x7F) as i64) << shift;
            shift += 7;
            if b & 0x80 == 0 {
                if shift < 64 && b & 0x40 != 0 {
                    result |= -1i64 << shift;
                }
                break;
            }
            if shift >= 35 {
                return Err(Error::Malformed("LEB128 i32 too long"));
            }
        }
        i32::try_from(result).map_err(|_| Error::Malformed("i32 constant out of range"))
    }

    fn take(&mut self, n: usize) -> Result<&'a [u8], Error> {
        if self.end - self.pos < n {
            return Err(Error::Truncated);
        }
        let s = &self.bytes[self.pos..self.pos + n];
        self.pos += n;
        Ok(s)
    }

    fn name(&mut self) -> Result<&'a str, Error> {
        let n = self.u32()? as usize;
        core::str::from_utf8(self.take(n)?).map_err(|_| Error::Malformed("name is not UTF-8"))
    }
}

/// Reads a block type: empty or one `i32` result.
fn block_arity(r: &mut Reader<'_>) -> Result<u8, Error> {
    match r.byte()? {
        EMPTY_BLOCK => Ok(0),
        I32 => Ok(1),
        _ => Err(Error::Unsupported("block type other than [] or [i32]")),
    }
}

/// Skips one instruction's immediates. Returns the opcode's class.
fn skip_immediates(op: u8, r: &mut Reader<'_>) -> Result<(), Error> {
    match op {
        0x0C | 0x0D | 0x10 | 0x20..=0x24 => {
            r.u32()?;
        }
        0x0E => {
            let n = r.u32()?;
            for _ in 0..=n {
                r.u32()?;
            }
        }
        0x41 => {
            r.i32()?;
        }
        0x00 | 0x01 | 0x05 | 0x0B | 0x0F | 0x1A | 0x1B | 0x45..=0x4F | 0x67..=0x78 => {}
        0x02..=0x04 => {
            block_arity(r)?;
        }
        0x11 => return Err(Error::Unsupported("call_indirect")),
        0x28 | 0x2C..=0x2F | 0x36 | 0x3A | 0x3B => {
            memarg(op, r)?;
        }
        0x3F | 0x40 => {
            if r.byte()? != 0 {
                return Err(Error::Malformed("memory index"));
            }
        }
        0x29..=0x35 | 0x37..=0x39 | 0x3C..=0x3E => {
            return Err(Error::Unsupported("i64 or float memory access"))
        }
        0x42 => return Err(Error::Unsupported("i64")),
        0x43 | 0x44 => return Err(Error::Unsupported("floating point")),
        _ => return Err(Error::Unsupported("instruction outside the i32 subset")),
    }
    Ok(())
}

/// Start index of a `width`-byte access at `base + offset`, if it fits.
fn effective(base: u32, offset: u32, width: usize, len: usize) -> Result<usize, Trap> {
    let at = base as u64 + offset as u64;
    if at + width as u64 > len as u64 {
        Err(Trap::OutOfBounds)
    } else {
        Ok(at as usize)
    }
}

/// Natural alignment (log2 bytes) of an i32 memory instruction.
const fn natural_align(op: u8) -> u32 {
    match op {
        0x2C | 0x2D | 0x3A => 0,
        0x2E | 0x2F | 0x3B => 1,
        _ => 2,
    }
}

/// Reads a memory argument; returns the static offset.
fn memarg(op: u8, r: &mut Reader<'_>) -> Result<u32, Error> {
    let align = r.u32()?;
    if align > natural_align(op) {
        return Err(Error::Malformed("alignment larger than natural"));
    }
    r.u32()
}

/// From just after a block type, finds the matching `else` (if any) and `end`.
fn scan_block(bytes: &[u8], start: usize, limit: usize) -> Result<(Option<usize>, usize), Error> {
    let mut r = Reader {
        bytes,
        pos: start,
        end: limit,
    };
    let mut depth = 0usize;
    let mut else_at = None;
    loop {
        let at = r.pos;
        let op = r.byte()?;
        match op {
            0x02..=0x04 => {
                block_arity(&mut r)?;
                depth += 1;
            }
            0x05 if depth == 0 => else_at = Some(at),
            0x0B => {
                if depth == 0 {
                    return Ok((else_at, at));
                }
                depth -= 1;
            }
            _ => skip_immediates(op, &mut r)?,
        }
    }
}

impl<'a> Module<'a> {
    /// Parses and checks a binary module.
    pub fn parse(bytes: &'a [u8]) -> Result<Self, Error> {
        if bytes.len() < 8 {
            return Err(Error::Truncated);
        }
        if bytes[0..4] != *b"\0asm" {
            return Err(Error::BadMagic);
        }
        if bytes[4..8] != [1, 0, 0, 0] {
            return Err(Error::BadVersion);
        }
        let mut m = Module {
            bytes,
            types: [FuncType::default(); MAX_TYPES],
            n_types: 0,
            imports: [Import::default(); MAX_IMPORTS],
            n_imports: 0,
            funcs: [Func::default(); MAX_FUNCS],
            n_funcs: 0,
            globals: [Global::default(); MAX_GLOBALS],
            n_globals: 0,
            exports: [Export::default(); MAX_EXPORTS],
            n_exports: 0,
            memory_pages: None,
            data: [Data::default(); MAX_DATA],
            n_data: 0,
        };
        let mut r = Reader {
            bytes,
            pos: 8,
            end: bytes.len(),
        };
        let mut declared_funcs: Option<usize> = None;
        let mut saw_code = false;
        while r.pos < r.end {
            let id = r.byte()?;
            let size = r.u32()? as usize;
            if r.end - r.pos < size {
                return Err(Error::Truncated);
            }
            let mut s = Reader {
                bytes,
                pos: r.pos,
                end: r.pos + size,
            };
            r.pos += size;
            match id {
                0 => {} // custom section
                1 => m.parse_types(&mut s)?,
                2 => m.parse_imports(&mut s)?,
                3 => declared_funcs = Some(m.parse_functions(&mut s)?),
                4 => return Err(Error::Unsupported("tables")),
                5 => m.parse_memory(&mut s)?,
                6 => m.parse_globals(&mut s)?,
                7 => m.parse_exports(&mut s)?,
                8 => return Err(Error::Unsupported("start function")),
                9 => return Err(Error::Unsupported("element segments")),
                10 => {
                    m.parse_code(&mut s, declared_funcs.unwrap_or(0))?;
                    saw_code = true;
                }
                11 => m.parse_data(&mut s)?,
                12 => {
                    s.u32()?; // data count; checked against the data section
                }
                _ => return Err(Error::Malformed("unknown section")),
            }
            if id != 0 && s.pos != s.end {
                return Err(Error::Malformed("section size mismatch"));
            }
        }
        if declared_funcs.unwrap_or(0) > 0 && !saw_code {
            return Err(Error::Malformed("function section without code"));
        }
        for i in 0..m.n_exports {
            if m.exports[i].func as usize >= m.n_imports + m.n_funcs {
                return Err(Error::BadIndex("export function index"));
            }
        }
        for i in 0..m.n_funcs {
            m.check_body(i)?;
        }
        Ok(m)
    }

    fn parse_types(&mut self, s: &mut Reader<'a>) -> Result<(), Error> {
        let n = s.u32()? as usize;
        if n > MAX_TYPES {
            return Err(Error::TooMany("types"));
        }
        for i in 0..n {
            if s.byte()? != 0x60 {
                return Err(Error::Malformed("type is not a function type"));
            }
            let params = s.u32()? as usize;
            if params > MAX_PARAMS {
                return Err(Error::TooMany("parameters"));
            }
            for _ in 0..params {
                if s.byte()? != I32 {
                    return Err(Error::Unsupported("parameter type other than i32"));
                }
            }
            let results = s.u32()? as usize;
            if results > 1 {
                return Err(Error::Unsupported("multiple results"));
            }
            for _ in 0..results {
                if s.byte()? != I32 {
                    return Err(Error::Unsupported("result type other than i32"));
                }
            }
            self.types[i] = FuncType {
                params: params as u8,
                results: results as u8,
            };
        }
        self.n_types = n;
        Ok(())
    }

    fn type_at(&self, index: u32) -> Result<FuncType, Error> {
        if (index as usize) < self.n_types {
            Ok(self.types[index as usize])
        } else {
            Err(Error::BadIndex("type index"))
        }
    }

    fn parse_imports(&mut self, s: &mut Reader<'a>) -> Result<(), Error> {
        let n = s.u32()? as usize;
        if n > MAX_IMPORTS {
            return Err(Error::TooMany("imports"));
        }
        for i in 0..n {
            let module = s.name()?;
            let name = s.name()?;
            if s.byte()? != 0x00 {
                return Err(Error::Unsupported("import other than a function"));
            }
            let ty = self.type_at(s.u32()?)?;
            self.imports[i] = Import { module, name, ty };
        }
        self.n_imports = n;
        Ok(())
    }

    fn parse_functions(&mut self, s: &mut Reader<'a>) -> Result<usize, Error> {
        let n = s.u32()? as usize;
        if n > MAX_FUNCS {
            return Err(Error::TooMany("functions"));
        }
        for i in 0..n {
            self.funcs[i].ty = self.type_at(s.u32()?)?;
        }
        Ok(n)
    }

    fn parse_globals(&mut self, s: &mut Reader<'a>) -> Result<(), Error> {
        let n = s.u32()? as usize;
        if n > MAX_GLOBALS {
            return Err(Error::TooMany("globals"));
        }
        for i in 0..n {
            if s.byte()? != I32 {
                return Err(Error::Unsupported("global type other than i32"));
            }
            let mutable = match s.byte()? {
                0 => false,
                1 => true,
                _ => return Err(Error::Malformed("global mutability")),
            };
            if s.byte()? != 0x41 {
                return Err(Error::Unsupported(
                    "global initialiser other than i32.const",
                ));
            }
            let init = s.i32()?;
            if s.byte()? != 0x0B {
                return Err(Error::Malformed("global initialiser not ended"));
            }
            self.globals[i] = Global { mutable, init };
        }
        self.n_globals = n;
        Ok(())
    }

    fn parse_memory(&mut self, s: &mut Reader<'a>) -> Result<(), Error> {
        let n = s.u32()?;
        if n > 1 {
            return Err(Error::TooMany("memories"));
        }
        if n == 1 {
            let flags = s.byte()?;
            let min = s.u32()?;
            match flags {
                0 => {}
                1 => {
                    if s.u32()? < min {
                        return Err(Error::Malformed("memory maximum below minimum"));
                    }
                }
                _ => return Err(Error::Unsupported("shared or 64-bit memory")),
            }
            if min > PAGE {
                return Err(Error::Malformed("memory too large"));
            }
            self.memory_pages = Some(min);
        }
        Ok(())
    }

    fn parse_data(&mut self, s: &mut Reader<'a>) -> Result<(), Error> {
        let n = s.u32()? as usize;
        if n > MAX_DATA {
            return Err(Error::TooMany("data segments"));
        }
        if n > 0 && self.memory_pages.is_none() {
            return Err(Error::BadIndex("data segment without a memory"));
        }
        for i in 0..n {
            match s.u32()? {
                0 => {}
                2 => {
                    if s.u32()? != 0 {
                        return Err(Error::BadIndex("memory index"));
                    }
                }
                _ => return Err(Error::Unsupported("passive data segments")),
            }
            if s.byte()? != 0x41 {
                return Err(Error::Unsupported("data offset other than i32.const"));
            }
            let offset = s.i32()? as u32;
            if s.byte()? != 0x0B {
                return Err(Error::Malformed("data offset not ended"));
            }
            let len = s.u32()? as usize;
            let start = s.pos;
            s.take(len)?;
            self.data[i] = Data {
                offset,
                start: start as u32,
                len: len as u32,
            };
        }
        self.n_data = n;
        Ok(())
    }

    /// Declared minimum memory in pages, if the module has a memory.
    pub fn memory_pages(&self) -> Option<u32> {
        self.memory_pages
    }

    fn parse_exports(&mut self, s: &mut Reader<'a>) -> Result<(), Error> {
        let n = s.u32()? as usize;
        for _ in 0..n {
            let name = s.name()?;
            let kind = s.byte()?;
            let index = s.u32()?;
            if kind != 0x00 {
                continue; // exported globals are allowed but not reachable
            }
            if self.n_exports == MAX_EXPORTS {
                return Err(Error::TooMany("exports"));
            }
            if index > u16::MAX as u32 {
                return Err(Error::BadIndex("export function index"));
            }
            self.exports[self.n_exports] = Export {
                name,
                func: index as u16,
            };
            self.n_exports += 1;
        }
        Ok(())
    }

    fn parse_code(&mut self, s: &mut Reader<'a>, declared: usize) -> Result<(), Error> {
        let n = s.u32()? as usize;
        if n != declared {
            return Err(Error::Malformed("code count differs from function count"));
        }
        for i in 0..n {
            let size = s.u32()? as usize;
            if s.end - s.pos < size || size == 0 {
                return Err(Error::Truncated);
            }
            let body_end = s.pos + size;
            let mut b = Reader {
                bytes: self.bytes,
                pos: s.pos,
                end: body_end,
            };
            let groups = b.u32()?;
            let mut locals: usize = 0;
            for _ in 0..groups {
                let count = b.u32()? as usize;
                if b.byte()? != I32 {
                    return Err(Error::Unsupported("local type other than i32"));
                }
                locals = locals.saturating_add(count);
            }
            if self.funcs[i].ty.params as usize + locals > MAX_LOCALS {
                return Err(Error::TooMany("locals"));
            }
            if self.bytes[body_end - 1] != 0x0B {
                return Err(Error::Malformed("function body not ended"));
            }
            self.funcs[i].locals = locals as u8;
            self.funcs[i].code = b.pos as u32;
            self.funcs[i].end = (body_end - 1) as u32;
            s.pos = body_end;
        }
        self.n_funcs = n;
        Ok(())
    }

    /// One pass over a body: every opcode is in the subset and every index is
    /// in range, branch depths included.
    fn check_body(&self, index: usize) -> Result<(), Error> {
        let f = self.funcs[index];
        let n_locals = f.ty.params as u32 + f.locals as u32;
        let n_funcs = (self.n_imports + self.n_funcs) as u32;
        let mut r = Reader {
            bytes: self.bytes,
            pos: f.code as usize,
            end: f.end as usize + 1,
        };
        // Bit k of `ifs` says whether enclosing block k is an `if`.
        let mut ifs: u64 = 0;
        let mut depth: usize = 0;
        loop {
            let op = r.byte()?;
            match op {
                0x02..=0x04 => {
                    block_arity(&mut r)?;
                    if depth == MAX_NESTING {
                        return Err(Error::TooMany("nested blocks"));
                    }
                    depth += 1;
                    if op == 0x04 {
                        ifs |= 1 << depth;
                    } else {
                        ifs &= !(1 << depth);
                    }
                }
                0x05 => {
                    if depth == 0 || ifs & (1 << depth) == 0 {
                        return Err(Error::Malformed("else outside if"));
                    }
                    ifs &= !(1 << depth); // a second else is rejected
                }
                0x0B => {
                    if depth == 0 {
                        return if r.pos == r.end {
                            Ok(())
                        } else {
                            Err(Error::Malformed("code after the final end"))
                        };
                    }
                    depth -= 1;
                }
                0x0C | 0x0D => {
                    if r.u32()? as usize > depth {
                        return Err(Error::BadIndex("branch depth"));
                    }
                }
                0x0E => {
                    let n = r.u32()?;
                    for _ in 0..=n {
                        if r.u32()? as usize > depth {
                            return Err(Error::BadIndex("branch depth"));
                        }
                    }
                }
                0x10 => {
                    if r.u32()? >= n_funcs {
                        return Err(Error::BadIndex("call target"));
                    }
                }
                0x20..=0x22 => {
                    if r.u32()? >= n_locals {
                        return Err(Error::BadIndex("local index"));
                    }
                }
                0x28 | 0x2C..=0x2F | 0x36 | 0x3A | 0x3B | 0x3F | 0x40 => {
                    if self.memory_pages.is_none() {
                        return Err(Error::BadIndex("memory instruction without a memory"));
                    }
                    skip_immediates(op, &mut r)?;
                }
                0x23 | 0x24 => {
                    let g = r.u32()? as usize;
                    if g >= self.n_globals {
                        return Err(Error::BadIndex("global index"));
                    }
                    if op == 0x24 && !self.globals[g].mutable {
                        return Err(Error::Malformed("global.set on an immutable global"));
                    }
                }
                _ => skip_immediates(op, &mut r)?,
            }
            if r.pos >= r.end {
                return Err(Error::Malformed("body ended inside a block"));
            }
        }
    }

    /// The imports, for binding to host functions.
    pub fn imports(&self) -> &[Import<'a>] {
        &self.imports[..self.n_imports]
    }

    /// Exported function names.
    pub fn export_names(&self) -> impl Iterator<Item = &'a str> + '_ {
        self.exports[..self.n_exports].iter().map(|e| e.name)
    }

    fn func_type(&self, index: usize) -> FuncType {
        if index < self.n_imports {
            self.imports[index].ty
        } else {
            self.funcs[index - self.n_imports].ty
        }
    }
}

/// Functions the capsule imports.
pub trait Host {
    /// Calls import `index` (position in [`Module::imports`]) with `args`.
    /// The return value is used only when the import declares a result.
    /// `memory` is the instance's memory buffer (empty without a memory),
    /// so imports can read and write strings and buffers.
    fn call(
        &mut self,
        index: usize,
        import: &Import<'_>,
        args: &[i32],
        memory: &mut [u8],
    ) -> Result<i32, Trap>;
}

#[derive(Clone, Copy, Default)]
struct Label {
    /// Operand stack height when the block was entered.
    height: u16,
    arity: u8,
    kind: u8,
    /// Loop: first instruction. Block/if: its `end`. Function: unused.
    target: u32,
}

const BLOCK: u8 = 0;
const LOOP: u8 = 1;
const FUNC: u8 = 2;

#[derive(Clone, Copy, Default)]
struct Frame {
    func: u16,
    pc: u32,
    locals_base: u16,
    /// Bottom of this frame's operand stack (above its locals).
    operands: u16,
    label_base: u16,
}

/// A module with its globals.
pub struct Instance<'m, 'a> {
    module: &'m Module<'a>,
    globals: [i32; MAX_GLOBALS],
    /// Instructions run by the last `invoke`.
    pub fuel_used: u32,
}

impl<'m, 'a> Instance<'m, 'a> {
    pub fn new(module: &'m Module<'a>) -> Self {
        let mut globals = [0; MAX_GLOBALS];
        for (slot, g) in globals.iter_mut().zip(&module.globals[..module.n_globals]) {
            *slot = g.init;
        }
        Self {
            module,
            globals,
            fuel_used: 0,
        }
    }

    /// Clears `memory` and copies the data segments into it. Call once before
    /// the first `invoke`, with the buffer that every `invoke` will get.
    pub fn init_memory(&self, memory: &mut [u8]) -> Result<(), Trap> {
        memory.fill(0);
        let limit = self.memory_limit(memory.len());
        let m = self.module;
        for d in &m.data[..m.n_data] {
            let start = d.offset as usize;
            let end = start.checked_add(d.len as usize).ok_or(Trap::OutOfBounds)?;
            if end > limit {
                return Err(Trap::OutOfBounds);
            }
            let src = &m.bytes[d.start as usize..(d.start + d.len) as usize];
            memory[start..end].copy_from_slice(src);
        }
        Ok(())
    }

    /// Bytes of `memory` the module may use: the buffer, capped at its
    /// declared size; 0 without a memory.
    fn memory_limit(&self, buffer: usize) -> usize {
        match self.module.memory_pages {
            Some(pages) => buffer.min(pages as usize * PAGE as usize),
            None => 0,
        }
    }

    pub fn global(&self, index: usize) -> Option<i32> {
        (index < self.module.n_globals).then(|| self.globals[index])
    }

    /// Runs exported function `name` with at most `fuel` instructions.
    /// `memory` is the buffer given to [`Instance::init_memory`].
    pub fn invoke(
        &mut self,
        host: &mut dyn Host,
        name: &str,
        args: &[i32],
        fuel: u32,
        memory: &mut [u8],
    ) -> Result<Option<i32>, Trap> {
        let limit = self.memory_limit(memory.len());
        let memory = &mut memory[..limit];
        let m = self.module;
        let export = m.exports[..m.n_exports]
            .iter()
            .find(|e| e.name == name)
            .ok_or(Trap::NoSuchExport)?;
        let target = export.func as usize;
        let ty = m.func_type(target);
        if args.len() != ty.params as usize {
            return Err(Trap::BadArguments);
        }
        self.fuel_used = 0;
        if target < m.n_imports {
            let v = host.call(target, &m.imports[target], args, memory)?;
            return Ok((ty.results == 1).then_some(v));
        }

        let mut stack = [0i32; VALUE_STACK];
        let mut sp: usize = 0;
        let mut labels = [Label::default(); LABEL_STACK];
        let mut lp: usize = 0;
        let mut frames = [Frame::default(); CALL_DEPTH];
        let mut fp: usize = 0;

        stack[..args.len()].copy_from_slice(args);
        sp = args.len().max(sp);
        let mut pc = self.enter(
            target - m.n_imports,
            &mut stack,
            &mut sp,
            &mut labels,
            &mut lp,
            &mut frames,
            &mut fp,
        )?;
        let bytes = m.bytes;

        macro_rules! pop {
            () => {{
                if sp <= frames[fp - 1].operands as usize {
                    return Err(Trap::StackUnderflow);
                }
                sp -= 1;
                stack[sp]
            }};
        }
        macro_rules! push {
            ($v:expr) => {{
                let v: i32 = $v;
                if sp == VALUE_STACK {
                    return Err(Trap::StackOverflow);
                }
                stack[sp] = v;
                sp += 1;
            }};
        }
        macro_rules! binop {
            ($f:expr) => {{
                let b = pop!();
                let a = pop!();
                push!($f(a, b));
            }};
        }
        macro_rules! cmp {
            ($f:expr) => {{
                let b = pop!();
                let a = pop!();
                push!($f(a, b) as i32);
            }};
        }

        loop {
            if self.fuel_used >= fuel {
                return Err(Trap::OutOfFuel);
            }
            self.fuel_used += 1;
            let mut r = Reader {
                bytes,
                pos: pc,
                end: bytes.len(),
            };
            let op = r.byte().map_err(|_| Trap::BadCode)?;
            let mut next = None;
            match op {
                0x00 => return Err(Trap::Unreachable),
                0x01 => {}
                0x02 | 0x04 => {
                    let arity = block_arity(&mut r).map_err(|_| Trap::BadCode)?;
                    let f = &m.funcs[frames[fp - 1].func as usize];
                    let (else_at, end_at) =
                        scan_block(bytes, r.pos, f.end as usize + 1).map_err(|_| Trap::BadCode)?;
                    let mut take = true;
                    if op == 0x04 {
                        take = pop!() != 0;
                    }
                    if lp == LABEL_STACK {
                        return Err(Trap::StackOverflow);
                    }
                    labels[lp] = Label {
                        height: sp as u16,
                        arity,
                        kind: BLOCK,
                        target: end_at as u32,
                    };
                    lp += 1;
                    if !take {
                        // `if` with a false condition: the else arm, or the
                        // `end` (which pops the label).
                        next = Some(match else_at {
                            Some(e) => e + 1,
                            None => end_at,
                        });
                    }
                }
                0x03 => {
                    block_arity(&mut r).map_err(|_| Trap::BadCode)?;
                    if lp == LABEL_STACK {
                        return Err(Trap::StackOverflow);
                    }
                    labels[lp] = Label {
                        height: sp as u16,
                        arity: 0,
                        kind: LOOP,
                        target: r.pos as u32,
                    };
                    lp += 1;
                }
                0x05 => {
                    // End of a then-arm: continue at the `if`'s end.
                    next = Some(labels[lp - 1].target as usize);
                }
                0x0B => {
                    let label = labels[lp - 1];
                    if label.kind == FUNC {
                        match self.ret(&mut stack, &mut sp, &mut lp, &frames, &mut fp)? {
                            Some(pc) => next = Some(pc),
                            None => return Ok(self.result(target, &stack, sp)),
                        }
                    } else {
                        lp -= 1;
                    }
                }
                0x0C..=0x0F => {
                    let depth = match op {
                        0x0C => Some(r.u32().map_err(|_| Trap::BadCode)? as usize),
                        0x0D => {
                            let d = r.u32().map_err(|_| Trap::BadCode)? as usize;
                            (pop!() != 0).then_some(d)
                        }
                        0x0E => {
                            let n = r.u32().map_err(|_| Trap::BadCode)? as usize;
                            let i = pop!() as u32 as usize;
                            let mut chosen = 0;
                            for k in 0..=n {
                                let d = r.u32().map_err(|_| Trap::BadCode)? as usize;
                                if k == i.min(n) {
                                    chosen = d;
                                }
                            }
                            Some(chosen)
                        }
                        _ => Some(lp - 1 - frames[fp - 1].label_base as usize),
                    };
                    if let Some(depth) = depth {
                        let base = frames[fp - 1].label_base as usize;
                        if depth >= lp - base {
                            return Err(Trap::BadCode);
                        }
                        let index = lp - 1 - depth;
                        let label = labels[index];
                        match label.kind {
                            FUNC => {
                                lp = index + 1;
                                match self.ret(&mut stack, &mut sp, &mut lp, &frames, &mut fp)? {
                                    Some(pc) => next = Some(pc),
                                    None => return Ok(self.result(target, &stack, sp)),
                                }
                            }
                            LOOP => {
                                sp = label.height as usize;
                                lp = index + 1;
                                next = Some(label.target as usize);
                            }
                            _ => {
                                let arity = label.arity as usize;
                                if sp < label.height as usize + arity {
                                    return Err(Trap::StackUnderflow);
                                }
                                let h = label.height as usize;
                                stack.copy_within(sp - arity..sp, h);
                                sp = h + arity;
                                lp = index;
                                next = Some(label.target as usize + 1);
                            }
                        }
                    }
                }
                0x10 => {
                    let callee = r.u32().map_err(|_| Trap::BadCode)? as usize;
                    let ty = m.func_type(callee);
                    if callee < m.n_imports {
                        let n = ty.params as usize;
                        if sp < frames[fp - 1].operands as usize + n {
                            return Err(Trap::StackUnderflow);
                        }
                        let mut args = [0i32; MAX_PARAMS];
                        args[..n].copy_from_slice(&stack[sp - n..sp]);
                        sp -= n;
                        let v = host.call(callee, &m.imports[callee], &args[..n], memory)?;
                        if ty.results == 1 {
                            push!(v);
                        }
                    } else {
                        frames[fp - 1].pc = r.pos as u32;
                        next = Some(self.enter(
                            callee - m.n_imports,
                            &mut stack,
                            &mut sp,
                            &mut labels,
                            &mut lp,
                            &mut frames,
                            &mut fp,
                        )?);
                    }
                }
                0x1A => {
                    pop!();
                }
                0x1B => {
                    let c = pop!();
                    let b = pop!();
                    let a = pop!();
                    push!(if c != 0 { a } else { b });
                }
                0x20..=0x22 => {
                    let i = r.u32().map_err(|_| Trap::BadCode)? as usize;
                    let slot = frames[fp - 1].locals_base as usize + i;
                    match op {
                        0x20 => push!(stack[slot]),
                        0x21 => {
                            let v = pop!();
                            stack[slot] = v;
                        }
                        _ => {
                            let v = pop!();
                            stack[slot] = v;
                            push!(v);
                        }
                    }
                }
                0x23 => {
                    let g = r.u32().map_err(|_| Trap::BadCode)? as usize;
                    push!(self.globals[g]);
                }
                0x24 => {
                    let g = r.u32().map_err(|_| Trap::BadCode)? as usize;
                    let v = pop!();
                    self.globals[g] = v;
                }
                0x41 => {
                    let v = r.i32().map_err(|_| Trap::BadCode)?;
                    push!(v);
                }
                0x28 | 0x2C..=0x2F => {
                    let offset = memarg(op, &mut r).map_err(|_| Trap::BadCode)?;
                    let base = pop!() as u32;
                    let width = 1usize << natural_align(op);
                    let at = effective(base, offset, width, memory.len())?;
                    let mut b = [0u8; 4];
                    b[..width].copy_from_slice(&memory[at..at + width]);
                    let v = match op {
                        0x28 => i32::from_le_bytes(b),
                        0x2C => b[0] as i8 as i32,
                        0x2D => b[0] as i32,
                        0x2E => i16::from_le_bytes([b[0], b[1]]) as i32,
                        _ => u16::from_le_bytes([b[0], b[1]]) as i32,
                    };
                    push!(v);
                }
                0x36 | 0x3A | 0x3B => {
                    let offset = memarg(op, &mut r).map_err(|_| Trap::BadCode)?;
                    let value = pop!();
                    let base = pop!() as u32;
                    let width = 1usize << natural_align(op);
                    let at = effective(base, offset, width, memory.len())?;
                    memory[at..at + width].copy_from_slice(&value.to_le_bytes()[..width]);
                }
                0x3F => {
                    r.byte().map_err(|_| Trap::BadCode)?;
                    push!(m.memory_pages.unwrap_or(0) as i32);
                }
                0x40 => {
                    r.byte().map_err(|_| Trap::BadCode)?;
                    pop!();
                    // The host buffer is fixed: growing always fails.
                    push!(-1);
                }
                0x45 => {
                    let a = pop!();
                    push!((a == 0) as i32);
                }
                0x46 => cmp!(|a: i32, b: i32| a == b),
                0x47 => cmp!(|a: i32, b: i32| a != b),
                0x48 => cmp!(|a: i32, b: i32| a < b),
                0x49 => cmp!(|a: i32, b: i32| (a as u32) < (b as u32)),
                0x4A => cmp!(|a: i32, b: i32| a > b),
                0x4B => cmp!(|a: i32, b: i32| (a as u32) > (b as u32)),
                0x4C => cmp!(|a: i32, b: i32| a <= b),
                0x4D => cmp!(|a: i32, b: i32| (a as u32) <= (b as u32)),
                0x4E => cmp!(|a: i32, b: i32| a >= b),
                0x4F => cmp!(|a: i32, b: i32| (a as u32) >= (b as u32)),
                0x67 => {
                    let a = pop!();
                    push!(a.leading_zeros() as i32);
                }
                0x68 => {
                    let a = pop!();
                    push!(a.trailing_zeros() as i32);
                }
                0x69 => {
                    let a = pop!();
                    push!(a.count_ones() as i32);
                }
                0x6A => binop!(|a: i32, b: i32| a.wrapping_add(b)),
                0x6B => binop!(|a: i32, b: i32| a.wrapping_sub(b)),
                0x6C => binop!(|a: i32, b: i32| a.wrapping_mul(b)),
                0x6D..=0x70 => {
                    let b = pop!();
                    let a = pop!();
                    if b == 0 {
                        return Err(Trap::DivideByZero);
                    }
                    let v = match op {
                        0x6D => {
                            if a == i32::MIN && b == -1 {
                                return Err(Trap::IntegerOverflow);
                            }
                            a / b
                        }
                        0x6E => ((a as u32) / (b as u32)) as i32,
                        0x6F => a.wrapping_rem(b),
                        _ => ((a as u32) % (b as u32)) as i32,
                    };
                    push!(v);
                }
                0x71 => binop!(|a: i32, b: i32| a & b),
                0x72 => binop!(|a: i32, b: i32| a | b),
                0x73 => binop!(|a: i32, b: i32| a ^ b),
                0x74 => binop!(|a: i32, b: i32| a.wrapping_shl(b as u32)),
                0x75 => binop!(|a: i32, b: i32| a.wrapping_shr(b as u32)),
                0x76 => binop!(|a: i32, b: i32| ((a as u32).wrapping_shr(b as u32)) as i32),
                0x77 => binop!(|a: i32, b: i32| a.rotate_left(b as u32 & 31)),
                0x78 => binop!(|a: i32, b: i32| a.rotate_right(b as u32 & 31)),
                _ => return Err(Trap::BadCode),
            }
            pc = next.unwrap_or(r.pos);
        }
    }

    /// Enters defined function `index`; its arguments are on top of the stack.
    #[allow(clippy::too_many_arguments)]
    fn enter(
        &self,
        index: usize,
        stack: &mut [i32; VALUE_STACK],
        sp: &mut usize,
        labels: &mut [Label; LABEL_STACK],
        lp: &mut usize,
        frames: &mut [Frame; CALL_DEPTH],
        fp: &mut usize,
    ) -> Result<usize, Trap> {
        let f = self.module.funcs[index];
        if *fp == CALL_DEPTH {
            return Err(Trap::CallDepth);
        }
        let params = f.ty.params as usize;
        let floor = if *fp == 0 {
            0
        } else {
            frames[*fp - 1].operands as usize
        };
        if *sp < floor + params {
            return Err(Trap::StackUnderflow);
        }
        let base = *sp - params;
        let top = base + params + f.locals as usize;
        if top > VALUE_STACK {
            return Err(Trap::StackOverflow);
        }
        stack[*sp..top].fill(0);
        *sp = top;
        if *lp == LABEL_STACK {
            return Err(Trap::StackOverflow);
        }
        frames[*fp] = Frame {
            func: index as u16,
            pc: 0,
            locals_base: base as u16,
            operands: top as u16,
            label_base: *lp as u16,
        };
        *fp += 1;
        labels[*lp] = Label {
            height: top as u16,
            arity: f.ty.results,
            kind: FUNC,
            target: f.end,
        };
        *lp += 1;
        Ok(f.code as usize)
    }

    /// Returns from the current frame. `Some(pc)` continues in the caller;
    /// `None` means the invoked function itself returned.
    fn ret(
        &self,
        stack: &mut [i32; VALUE_STACK],
        sp: &mut usize,
        lp: &mut usize,
        frames: &[Frame; CALL_DEPTH],
        fp: &mut usize,
    ) -> Result<Option<usize>, Trap> {
        let frame = frames[*fp - 1];
        let arity = self.module.funcs[frame.func as usize].ty.results as usize;
        let base = frame.locals_base as usize;
        if *sp < frame.operands as usize + arity {
            return Err(Trap::StackUnderflow);
        }
        stack.copy_within(*sp - arity..*sp, base);
        *sp = base + arity;
        *lp = frame.label_base as usize;
        *fp -= 1;
        if *fp == 0 {
            Ok(None)
        } else {
            Ok(Some(frames[*fp - 1].pc as usize))
        }
    }

    fn result(&self, target: usize, stack: &[i32; VALUE_STACK], sp: usize) -> Option<i32> {
        (self.module.func_type(target).results == 1).then(|| stack[sp - 1])
    }
}

#[cfg(test)]
mod tests;
