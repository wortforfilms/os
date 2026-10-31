use super::*;

fn wasm(text: &str) -> Vec<u8> {
    wat::parse_str(text).expect("valid wat")
}

/// Host with `log(i32)`, `add1(i32) -> i32` and `fail()`; records log calls.
#[derive(Default)]
struct TestHost {
    logged: Vec<i32>,
}

impl Host for TestHost {
    fn call(
        &mut self,
        _index: usize,
        import: &Import<'_>,
        args: &[i32],
        _memory: &mut [u8],
    ) -> Result<i32, Trap> {
        match import.name {
            "log" => {
                self.logged.push(args[0]);
                Ok(0)
            }
            "add1" => Ok(args[0] + 1),
            "fail" => Err(Trap::Host(7)),
            _ => Err(Trap::UnresolvedImport),
        }
    }
}

fn run(text: &str, name: &str, args: &[i32]) -> Result<Option<i32>, Trap> {
    let bytes = wasm(text);
    let module = Module::parse(&bytes).expect("module loads");
    let mut instance = Instance::new(&module);
    instance.invoke(&mut TestHost::default(), name, args, 1_000_000, &mut [])
}

#[test]
fn arithmetic_and_comparisons() {
    let m = r#"(module
      (func (export "add") (param i32 i32) (result i32) local.get 0 local.get 1 i32.add)
      (func (export "sub") (param i32 i32) (result i32) local.get 0 local.get 1 i32.sub)
      (func (export "mul") (param i32 i32) (result i32) local.get 0 local.get 1 i32.mul)
      (func (export "divs") (param i32 i32) (result i32) local.get 0 local.get 1 i32.div_s)
      (func (export "divu") (param i32 i32) (result i32) local.get 0 local.get 1 i32.div_u)
      (func (export "rems") (param i32 i32) (result i32) local.get 0 local.get 1 i32.rem_s)
      (func (export "remu") (param i32 i32) (result i32) local.get 0 local.get 1 i32.rem_u)
      (func (export "shl") (param i32 i32) (result i32) local.get 0 local.get 1 i32.shl)
      (func (export "shrs") (param i32 i32) (result i32) local.get 0 local.get 1 i32.shr_s)
      (func (export "shru") (param i32 i32) (result i32) local.get 0 local.get 1 i32.shr_u)
      (func (export "rotl") (param i32 i32) (result i32) local.get 0 local.get 1 i32.rotl)
      (func (export "rotr") (param i32 i32) (result i32) local.get 0 local.get 1 i32.rotr)
      (func (export "clz") (param i32) (result i32) local.get 0 i32.clz)
      (func (export "ctz") (param i32) (result i32) local.get 0 i32.ctz)
      (func (export "popcnt") (param i32) (result i32) local.get 0 i32.popcnt)
      (func (export "ltu") (param i32 i32) (result i32) local.get 0 local.get 1 i32.lt_u)
      (func (export "lts") (param i32 i32) (result i32) local.get 0 local.get 1 i32.lt_s)
      (func (export "geu") (param i32 i32) (result i32) local.get 0 local.get 1 i32.ge_u)
      (func (export "eqz") (param i32) (result i32) local.get 0 i32.eqz)
      (func (export "xor") (param i32 i32) (result i32) local.get 0 local.get 1 i32.xor))"#;
    let cases: &[(&str, &[i32], i32)] = &[
        ("add", &[i32::MAX, 1], i32::MIN),
        ("sub", &[0, 1], -1),
        ("mul", &[0x10000, 0x10000], 0),
        ("divs", &[-7, 2], -3),
        ("divu", &[-1, 2], i32::MAX),
        ("rems", &[-7, 2], -1),
        ("rems", &[i32::MIN, -1], 0),
        ("remu", &[-1, 10], 5),
        ("shl", &[1, 33], 2),
        ("shrs", &[-8, 1], -4),
        ("shru", &[-8, 1], 0x7FFF_FFFC),
        ("rotl", &[0x8000_0001u32 as i32, 1], 3),
        ("rotr", &[3, 1], 0x8000_0001u32 as i32),
        ("clz", &[1], 31),
        ("ctz", &[0], 32),
        ("popcnt", &[-1], 32),
        ("ltu", &[-1, 1], 0),
        ("lts", &[-1, 1], 1),
        ("geu", &[-1, 1], 1),
        ("eqz", &[0], 1),
        ("xor", &[0b1100, 0b1010], 0b0110),
    ];
    for (name, args, want) in cases {
        assert_eq!(run(m, name, args), Ok(Some(*want)), "{name}{args:?}");
    }
}

#[test]
fn arithmetic_traps() {
    let m = r#"(module
      (func (export "divs") (param i32 i32) (result i32) local.get 0 local.get 1 i32.div_s)
      (func (export "remu") (param i32 i32) (result i32) local.get 0 local.get 1 i32.rem_u))"#;
    assert_eq!(run(m, "divs", &[1, 0]), Err(Trap::DivideByZero));
    assert_eq!(run(m, "divs", &[i32::MIN, -1]), Err(Trap::IntegerOverflow));
    assert_eq!(run(m, "remu", &[1, 0]), Err(Trap::DivideByZero));
}

#[test]
fn recursion_loops_and_globals() {
    let m = r#"(module
      (global $count (mut i32) (i32.const 0))
      (func $fac (export "fac") (param i32) (result i32)
        local.get 0 i32.eqz
        if (result i32) i32.const 1
        else local.get 0 local.get 0 i32.const 1 i32.sub call $fac i32.mul end)
      (func (export "fib") (param $n i32) (result i32) (local $a i32) (local $b i32) (local $t i32)
        i32.const 1 local.set $b
        block $done
          loop $next
            local.get $n i32.eqz br_if $done
            local.get $a local.get $b i32.add local.set $t
            local.get $b local.set $a
            local.get $t local.set $b
            local.get $n i32.const 1 i32.sub local.set $n
            br $next
          end
        end
        local.get $a)
      (func (export "bump") (result i32)
        global.get $count i32.const 1 i32.add global.set $count global.get $count))"#;
    assert_eq!(run(m, "fac", &[10]), Ok(Some(3_628_800)));
    assert_eq!(run(m, "fib", &[0]), Ok(Some(0)));
    assert_eq!(run(m, "fib", &[24]), Ok(Some(46_368)));
    let bytes = wasm(m);
    let module = Module::parse(&bytes).unwrap();
    let mut instance = Instance::new(&module);
    let mut host = TestHost::default();
    for want in 1..=3 {
        assert_eq!(
            instance.invoke(&mut host, "bump", &[], 1000, &mut []),
            Ok(Some(want))
        );
    }
    assert_eq!(instance.global(0), Some(3));
}

#[test]
fn blocks_branches_select_and_br_table() {
    let m = r#"(module
      (func (export "pick") (param i32) (result i32)
        block $c block $b block $a
          local.get 0 br_table $a $b $c
        end i32.const 10 return
        end i32.const 20 return
        end i32.const 30)
      (func (export "blockval") (result i32)
        block (result i32) i32.const 5 i32.const 7 br 0 end)
      (func (export "ifnoelse") (param i32) (result i32) (local i32)
        i32.const 1 local.set 1
        local.get 0 if i32.const 9 local.set 1 end
        local.get 1)
      (func (export "sel") (param i32) (result i32) i32.const 11 i32.const 22 local.get 0 select)
      (func (export "early") (param i32) (result i32)
        block loop
          local.get 0 i32.const 3 i32.gt_s if i32.const 99 return end
          local.get 0 i32.const 1 i32.add local.set 0
          br 0
        end end
        i32.const -1)
      (func (export "brif") (param i32) (result i32)
        block (result i32) i32.const 4 local.get 0 br_if 0 drop i32.const 8 end))"#;
    assert_eq!(run(m, "pick", &[0]), Ok(Some(10)));
    assert_eq!(run(m, "pick", &[1]), Ok(Some(20)));
    assert_eq!(run(m, "pick", &[2]), Ok(Some(30)));
    assert_eq!(
        run(m, "pick", &[77]),
        Ok(Some(30)),
        "out of range takes the default"
    );
    assert_eq!(run(m, "blockval", &[]), Ok(Some(7)));
    assert_eq!(run(m, "ifnoelse", &[0]), Ok(Some(1)));
    assert_eq!(run(m, "ifnoelse", &[1]), Ok(Some(9)));
    assert_eq!(run(m, "sel", &[1]), Ok(Some(11)));
    assert_eq!(run(m, "sel", &[0]), Ok(Some(22)));
    assert_eq!(run(m, "early", &[0]), Ok(Some(99)));
    assert_eq!(run(m, "brif", &[1]), Ok(Some(4)));
    assert_eq!(run(m, "brif", &[0]), Ok(Some(8)));
}

#[test]
fn host_imports_are_called_with_arguments() {
    let m = r#"(module
      (import "maataa" "log" (func $log (param i32)))
      (import "maataa" "add1" (func $add1 (param i32) (result i32)))
      (import "maataa" "fail" (func $fail))
      (func (export "go") (result i32)
        i32.const 41 call $add1 call $log
        i32.const 5 call $add1)
      (func (export "boom") call $fail)
      (export "direct" (func $add1)))"#;
    let bytes = wasm(m);
    let module = Module::parse(&bytes).unwrap();
    assert_eq!(module.imports().len(), 3);
    assert_eq!(module.imports()[0].module, "maataa");
    let mut instance = Instance::new(&module);
    let mut host = TestHost::default();
    assert_eq!(
        instance.invoke(&mut host, "go", &[], 100, &mut []),
        Ok(Some(6))
    );
    assert_eq!(host.logged, vec![42]);
    assert_eq!(
        instance.invoke(&mut host, "boom", &[], 100, &mut []),
        Err(Trap::Host(7))
    );
    assert_eq!(
        instance.invoke(&mut host, "direct", &[1], 100, &mut []),
        Ok(Some(2))
    );
}

#[test]
fn limits_stop_runaway_code() {
    let m = r#"(module
      (func (export "spin") loop br 0 end)
      (func $deep (export "deep") call $deep)
      (func (export "unreach") unreachable))"#;
    assert_eq!(run(m, "spin", &[]), Err(Trap::OutOfFuel));
    assert_eq!(run(m, "deep", &[]), Err(Trap::CallDepth));
    assert_eq!(run(m, "unreach", &[]), Err(Trap::Unreachable));
    assert_eq!(run(m, "missing", &[]), Err(Trap::NoSuchExport));
    assert_eq!(run(m, "spin", &[1]), Err(Trap::BadArguments));
}

#[test]
fn fuel_counts_instructions() {
    let bytes =
        wasm(r#"(module (func (export "f") (result i32) i32.const 1 i32.const 2 i32.add))"#);
    let module = Module::parse(&bytes).unwrap();
    let mut instance = Instance::new(&module);
    assert_eq!(
        instance.invoke(&mut TestHost::default(), "f", &[], 4, &mut []),
        Ok(Some(3))
    );
    assert_eq!(
        instance.fuel_used, 4,
        "three instructions and the final end"
    );
    assert_eq!(
        instance.invoke(&mut TestHost::default(), "f", &[], 3, &mut []),
        Err(Trap::OutOfFuel)
    );
}

#[test]
fn features_outside_the_subset_are_rejected_at_load() {
    let cases = [
        (r#"(module (table 1 funcref))"#, "tables"),
        (
            r#"(module (func (param f32)))"#,
            "parameter type other than i32",
        ),
        (
            r#"(module (func (result i64) i64.const 1))"#,
            "result type other than i32",
        ),
        (r#"(module (func f32.const 1 drop))"#, "floating point"),
        (r#"(module (func $f) (start $f))"#, "start function"),
        (
            r#"(module (import "m" "g" (global i32)))"#,
            "import other than a function",
        ),
        (
            r#"(module (type $t (func)) (table 1 funcref) (func i32.const 0 call_indirect (type $t)))"#,
            "tables",
        ),
        (
            r#"(module (func (result i32 i32) i32.const 1 i32.const 2))"#,
            "multiple results",
        ),
    ];
    for (text, why) in cases {
        let bytes = wasm(text);
        match Module::parse(&bytes) {
            Err(e) => assert_eq!(e.as_str(), why, "{text}"),
            Ok(_) => panic!("accepted: {text}"),
        }
    }
}

#[test]
fn bad_indices_are_rejected_at_load() {
    // The text format does not check these; the loader must.
    for text in [
        r#"(module (func local.get 3 drop))"#,
        r#"(module (func global.get 0 drop))"#,
        r#"(module (func call 9))"#,
        r#"(module (func br 2))"#,
        r#"(module (global i32 (i32.const 1)) (func i32.const 2 global.set 0))"#,
    ] {
        let bytes = wasm(text);
        assert!(Module::parse(&bytes).is_err(), "accepted: {text}");
    }
}

#[test]
fn malformed_bytes_are_rejected() {
    assert_eq!(Module::parse(b"").err(), Some(Error::Truncated));
    assert_eq!(
        Module::parse(b"\0wasm\x01\0\0\0").err(),
        Some(Error::BadMagic)
    );
    assert_eq!(
        Module::parse(b"\0asm\x02\0\0\0").err(),
        Some(Error::BadVersion)
    );
    let good = wasm(r#"(module (func (export "f") (result i32) i32.const 1))"#);
    for cut in 9..good.len() {
        // A cut at a section boundary is a smaller valid module; it must not
        // still run "f".
        if let Ok(module) = Module::parse(&good[..cut]) {
            let mut instance = Instance::new(&module);
            assert!(
                instance
                    .invoke(&mut TestHost::default(), "f", &[], 100, &mut [])
                    .is_err(),
                "truncated at {cut} still runs"
            );
        }
    }
    // Flipping bytes must never panic; it may load or be rejected.
    for i in 8..good.len() {
        for bit in 0..8 {
            let mut bad = good.clone();
            bad[i] ^= 1 << bit;
            if let Ok(module) = Module::parse(&bad) {
                let mut instance = Instance::new(&module);
                let _ = instance.invoke(&mut TestHost::default(), "f", &[], 1000, &mut []);
            }
        }
    }
}

#[test]
fn empty_module_and_exports_listing() {
    let bytes = wasm(r#"(module (func (export "a")) (func (export "b")))"#);
    let module = Module::parse(&bytes).unwrap();
    assert_eq!(module.export_names().collect::<Vec<_>>(), vec!["a", "b"]);
    let empty = wasm("(module)");
    assert!(Module::parse(&empty).is_ok());
}

/// Random straight-line and branching i32 programs give the same result (or
/// both trap) here and in wasmi, a full interpreter.
#[test]
fn matches_wasmi_on_random_programs() {
    let mut seed: u64 = 0x9E37_79B9_7F4A_7C15;
    let mut next = move || {
        seed ^= seed << 13;
        seed ^= seed >> 7;
        seed ^= seed << 17;
        seed
    };
    const BIN: [&str; 21] = [
        "i32.add",
        "i32.sub",
        "i32.mul",
        "i32.div_s",
        "i32.div_u",
        "i32.rem_s",
        "i32.rem_u",
        "i32.and",
        "i32.or",
        "i32.xor",
        "i32.shl",
        "i32.shr_s",
        "i32.shr_u",
        "i32.rotl",
        "i32.rotr",
        "i32.eq",
        "i32.ne",
        "i32.lt_s",
        "i32.gt_u",
        "i32.le_s",
        "i32.ge_u",
    ];
    const UN: [&str; 4] = ["i32.clz", "i32.ctz", "i32.popcnt", "i32.eqz"];
    let engine = wasmi::Engine::default();
    for _ in 0..400 {
        // Build an expression with a stack depth that stays >= 1.
        let mut body = String::from("local.get 0 ");
        let mut depth = 1;
        for _ in 0..(next() % 24 + 1) {
            match next() % 6 {
                0 | 1 => {
                    body += if next() % 2 == 0 {
                        "local.get 0 "
                    } else {
                        "local.get 1 "
                    };
                    depth += 1;
                }
                2 => {
                    body += &format!("i32.const {} ", next() as i32 >> (next() % 31));
                    depth += 1;
                }
                3 => body += &format!("{} ", UN[(next() % 4) as usize]),
                4 if depth >= 3 => {
                    body += "select ";
                    depth -= 2;
                }
                _ if depth >= 2 => {
                    body += &format!("{} ", BIN[(next() % 21) as usize]);
                    depth -= 1;
                }
                _ => {}
            }
        }
        // Collapse the stack to one value, inside an if/else for branches.
        let text = format!(
            "(module (func (export \"f\") (param i32 i32) (result i32)
               local.get 1 i32.const 1 i32.and
               if (result i32) {body} {fold} else local.get 0 local.get 1 i32.sub end))",
            fold = "i32.add ".repeat(depth - 1)
        );
        let bytes = wasm(&text);
        let a = next() as i32;
        let b = next() as i32 >> (next() % 32);

        let ours = {
            let module = Module::parse(&bytes).expect("generated module loads");
            Instance::new(&module).invoke(&mut TestHost::default(), "f", &[a, b], 10_000, &mut [])
        };
        let reference = {
            let module = wasmi::Module::new(&engine, &bytes[..]).expect("wasmi loads");
            let mut store = wasmi::Store::new(&engine, ());
            let linker = wasmi::Linker::<()>::new(&engine);
            let instance = linker
                .instantiate(&mut store, &module)
                .and_then(|p| p.start(&mut store))
                .expect("wasmi instantiates");
            let f = instance
                .get_typed_func::<(i32, i32), i32>(&store, "f")
                .unwrap();
            f.call(&mut store, (a, b)).ok()
        };
        match (ours, reference) {
            (Ok(Some(x)), Some(y)) => assert_eq!(x, y, "{text} with ({a}, {b})"),
            (Err(_), None) => {}
            (o, r) => panic!("disagree: ours {o:?}, wasmi {r:?}\n{text} with ({a}, {b})"),
        }
    }
}

fn run_mem(text: &str, name: &str, args: &[i32], memory: &mut [u8]) -> Result<Option<i32>, Trap> {
    let bytes = wasm(text);
    let module = Module::parse(&bytes).expect("module loads");
    let mut instance = Instance::new(&module);
    instance.init_memory(memory)?;
    instance.invoke(&mut TestHost::default(), name, args, 100_000, memory)
}

const MEM: &str = r#"(module
  (memory 1)
  (data (i32.const 16) "\01\80\ff\7f\fe\ff\ff\ff")
  (func (export "l32") (param i32) (result i32) local.get 0 i32.load)
  (func (export "l8s") (param i32) (result i32) local.get 0 i32.load8_s)
  (func (export "l8u") (param i32) (result i32) local.get 0 i32.load8_u)
  (func (export "l16s") (param i32) (result i32) local.get 0 i32.load16_s)
  (func (export "l16u") (param i32) (result i32) local.get 0 i32.load16_u)
  (func (export "off") (result i32) i32.const 8 i32.load offset=8)
  (func (export "st") (param i32 i32) (result i32)
    local.get 0 local.get 1 i32.store
    local.get 0 i32.const 1 i32.add local.get 1 i32.store8
    local.get 0 i32.load)
  (func (export "st16") (param i32 i32) (result i32)
    local.get 0 local.get 1 i32.store16 local.get 0 i32.load)
  (func (export "size") (result i32) memory.size)
  (func (export "grow") (result i32) i32.const 1 memory.grow))"#;

#[test]
fn loads_stores_and_data_segments() {
    let mut memory = [0u8; 256];
    let cases: &[(&str, &[i32], i32)] = &[
        ("l32", &[16], 0x7FFF_8001),
        ("l8s", &[17], -128),
        ("l8u", &[17], 128),
        ("l16s", &[18], 0x7FFF),
        ("l16s", &[20], -2),
        ("l16u", &[20], 0xFFFE),
        ("off", &[], 0x7FFF_8001),
        ("st", &[100, 0x1122_3344], 0x1122_4444),
        ("st16", &[120, 0x7777_ABCD], 0xABCD),
        ("size", &[], 1),
        ("grow", &[], -1),
    ];
    for (name, args, want) in cases {
        assert_eq!(
            run_mem(MEM, name, args, &mut memory),
            Ok(Some(*want)),
            "{name}{args:?}"
        );
    }
}

#[test]
fn accesses_outside_the_host_buffer_trap() {
    let mut memory = [0u8; 64];
    // Inside the declared page but past the 64-byte buffer.
    assert_eq!(
        run_mem(MEM, "l32", &[61], &mut memory),
        Err(Trap::OutOfBounds)
    );
    assert_eq!(run_mem(MEM, "l32", &[60], &mut memory), Ok(Some(0)));
    assert_eq!(
        run_mem(MEM, "l32", &[-1], &mut memory),
        Err(Trap::OutOfBounds)
    );
    assert_eq!(
        run_mem(MEM, "st", &[63, 1], &mut memory),
        Err(Trap::OutOfBounds)
    );
    // A data segment that does not fit the buffer is refused up front.
    let mut tiny = [0u8; 20];
    let bytes = wasm(MEM);
    let module = Module::parse(&bytes).unwrap();
    assert_eq!(
        Instance::new(&module).init_memory(&mut tiny),
        Err(Trap::OutOfBounds)
    );
}

#[test]
fn host_reads_strings_from_memory() {
    struct Strings(Vec<String>);
    impl Host for Strings {
        fn call(
            &mut self,
            _: usize,
            _: &Import<'_>,
            args: &[i32],
            memory: &mut [u8],
        ) -> Result<i32, Trap> {
            let (ptr, len) = (args[0] as u32 as usize, args[1] as u32 as usize);
            let bytes = memory.get(ptr..ptr + len).ok_or(Trap::OutOfBounds)?;
            self.0.push(String::from_utf8_lossy(bytes).into_owned());
            memory[ptr] = b'J'; // hosts may write too
            Ok(0)
        }
    }
    let bytes = wasm(
        r#"(module
          (import "maataa" "log_str" (func $log (param i32 i32)))
          (memory 1)
          (data (i32.const 0) "jai maataa")
          (func (export "go") (result i32)
            i32.const 0 i32.const 10 call $log
            i32.const 0 i32.load8_u))"#,
    );
    let module = Module::parse(&bytes).unwrap();
    let mut instance = Instance::new(&module);
    let mut memory = [0u8; 128];
    instance.init_memory(&mut memory).unwrap();
    let mut host = Strings(Vec::new());
    assert_eq!(
        instance.invoke(&mut host, "go", &[], 1000, &mut memory),
        Ok(Some(b'J' as i32))
    );
    assert_eq!(host.0, vec!["jai maataa".to_string()]);
}

#[test]
fn memory_misuse_is_rejected_at_load() {
    for (text, why) in [
        (
            r#"(module (func i32.const 0 i32.load drop))"#,
            "memory instruction without a memory",
        ),
        (
            r#"(module (memory 1) (func i32.const 0 i32.load align=8 drop))"#,
            "alignment larger than natural",
        ),
        (
            r#"(module (memory 1) (func i32.const 0 i64.load drop))"#,
            "i64 or float memory access",
        ),
        (r#"(module (memory 1) (data "x"))"#, "passive data segments"),
        (
            r#"(module (import "m" "mem" (memory 1)))"#,
            "import other than a function",
        ),
    ] {
        let bytes = wasm(text);
        match Module::parse(&bytes) {
            Err(e) => assert_eq!(e.as_str(), why, "{text}"),
            Ok(_) => panic!("accepted: {text}"),
        }
    }
}

/// Random stores and loads give the same results here and in wasmi, with a
/// full 64 KiB buffer so both see the same memory.
#[test]
fn memory_matches_wasmi_on_random_programs() {
    let mut seed: u64 = 0x2545_F491_4F6C_DD1D;
    let mut next = move || {
        seed ^= seed << 13;
        seed ^= seed >> 7;
        seed ^= seed << 17;
        seed
    };
    const LOADS: [&str; 5] = [
        "i32.load",
        "i32.load8_s",
        "i32.load8_u",
        "i32.load16_s",
        "i32.load16_u",
    ];
    const STORES: [&str; 3] = ["i32.store", "i32.store8", "i32.store16"];
    let engine = wasmi::Engine::default();
    for _ in 0..300 {
        let mut body = String::new();
        // Addresses mostly in range, sometimes at or past the end.
        let addr = |kind: u64, value: u64| -> i64 {
            match kind % 10 {
                0 => 65_534 + (value % 4) as i64,
                1 => -1,
                _ => (value % 65_536) as i64,
            }
        };
        let mut addrs = Vec::new();
        for _ in 0..(next() % 6 + 1) {
            let a = addr(next(), next());
            addrs.push(a);
            body += &format!(
                "i32.const {a} local.get 0 i32.const {} i32.mul {} offset={} ",
                next() as i32,
                STORES[(next() % 3) as usize],
                next() % 3
            );
        }
        body += "i32.const 0 ";
        for _ in 0..(next() % 6 + 1) {
            let a = if next() % 2 == 0 {
                addrs[(next() as usize) % addrs.len()]
            } else {
                addr(next(), next())
            };
            body += &format!(
                "i32.const {a} {} offset={} i32.add ",
                LOADS[(next() % 5) as usize],
                next() % 3
            );
        }
        let text = format!(
            "(module (memory 1) (data (i32.const 32) \"seed-bytes\")
               (func (export \"f\") (param i32) (result i32) {body}))"
        );
        let bytes = wasm(&text);
        let arg = next() as i32;

        let ours = {
            let module = Module::parse(&bytes).expect("generated module loads");
            let mut instance = Instance::new(&module);
            let mut memory = vec![0u8; PAGE as usize];
            instance.init_memory(&mut memory).unwrap();
            instance.invoke(&mut TestHost::default(), "f", &[arg], 10_000, &mut memory)
        };
        let reference = {
            let module = wasmi::Module::new(&engine, &bytes[..]).expect("wasmi loads");
            let mut store = wasmi::Store::new(&engine, ());
            let linker = wasmi::Linker::<()>::new(&engine);
            let instance = linker
                .instantiate(&mut store, &module)
                .and_then(|p| p.start(&mut store))
                .expect("wasmi instantiates");
            let f = instance.get_typed_func::<i32, i32>(&store, "f").unwrap();
            f.call(&mut store, arg).ok()
        };
        match (ours, reference) {
            (Ok(Some(x)), Some(y)) => assert_eq!(x, y, "{text} with {arg}"),
            (Err(_), None) => {}
            (o, r) => panic!("disagree: ours {o:?}, wasmi {r:?}\n{text} with {arg}"),
        }
    }
}
