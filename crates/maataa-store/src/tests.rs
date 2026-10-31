use super::*;

/// RAM flash that behaves like NOR: programming can only clear bits, and
/// programming a byte that is not erased is an error. It can cut power after
/// a set number of programmed bytes.
#[derive(Clone)]
struct RamFlash {
    banks: [Vec<u8>; 2],
    /// Bytes still allowed to program before the "power cut".
    budget: Option<usize>,
    erases: u32,
}

impl RamFlash {
    fn new(size: usize) -> Self {
        Self {
            banks: [vec![0xFF; size], vec![0xFF; size]],
            budget: None,
            erases: 0,
        }
    }
}

const CUT: FlashError = FlashError::Device(0xDEAD);

impl Flash for RamFlash {
    fn bank_size(&self) -> u32 {
        self.banks[0].len() as u32
    }
    fn read(&mut self, bank: u8, offset: u32, buf: &mut [u8]) -> Result<(), FlashError> {
        let b = &self.banks[bank as usize];
        let start = offset as usize;
        let src = b
            .get(start..start + buf.len())
            .ok_or(FlashError::OutOfRange)?;
        buf.copy_from_slice(src);
        Ok(())
    }
    fn program(&mut self, bank: u8, offset: u32, data: &[u8]) -> Result<(), FlashError> {
        let start = offset as usize;
        if start + data.len() > self.banks[0].len() {
            return Err(FlashError::OutOfRange);
        }
        for (i, &byte) in data.iter().enumerate() {
            if let Some(budget) = self.budget.as_mut() {
                if *budget == 0 {
                    return Err(CUT);
                }
                *budget -= 1;
            }
            let cell = &mut self.banks[bank as usize][start + i];
            assert_eq!(
                *cell,
                0xFF,
                "programming a byte that is not erased (bank {bank}, offset {})",
                start + i
            );
            *cell &= byte;
        }
        Ok(())
    }
    fn erase(&mut self, bank: u8) -> Result<(), FlashError> {
        if self.budget == Some(0) {
            return Err(CUT);
        }
        self.erases += 1;
        self.banks[bank as usize].fill(0xFF);
        Ok(())
    }
}

fn get(store: &mut Store<RamFlash>, key: u8) -> Option<Vec<u8>> {
    let mut buf = [0u8; MAX_VALUE];
    store.get(key, &mut buf).unwrap().map(|n| buf[..n].to_vec())
}

#[test]
fn formats_blank_flash_then_reads_back_after_remount() {
    let (mut store, report) = Store::mount(RamFlash::new(1024)).unwrap();
    assert!(report.formatted);
    assert_eq!(get(&mut store, 3), None);
    store.put(3, b"hello").unwrap();
    store.put(4, b"world").unwrap();
    store.put(3, b"hello again").unwrap();
    let flash = store.into_flash();

    let (mut store, report) = Store::mount(flash).unwrap();
    assert_eq!(report, MountReport::default());
    assert_eq!(get(&mut store, 3).as_deref(), Some(&b"hello again"[..]));
    assert_eq!(get(&mut store, 4).as_deref(), Some(&b"world"[..]));
    assert_eq!(store.stats().live_keys, 2);
}

#[test]
fn delete_and_limits() {
    let (mut store, _) = Store::mount(RamFlash::new(1024)).unwrap();
    store.put(1, b"x").unwrap();
    store.delete(1).unwrap();
    assert_eq!(get(&mut store, 1), None);
    assert_eq!(store.put(KEYS as u8, b"x"), Err(StoreError::BadKey));
    assert_eq!(store.put(1, &[0; MAX_VALUE + 1]), Err(StoreError::TooLong));
    store.put(1, &[7; MAX_VALUE]).unwrap();
    let mut small = [0u8; 4];
    assert_eq!(store.get(1, &mut small), Err(StoreError::TooLong));
    let flash = store.into_flash();
    let (mut store, _) = Store::mount(flash).unwrap();
    assert_eq!(get(&mut store, 1), Some(vec![7; MAX_VALUE]));
}

#[test]
fn compaction_keeps_newest_values_and_switches_bank() {
    let (mut store, _) = Store::mount(RamFlash::new(512)).unwrap();
    for round in 0..200u32 {
        store.put((round % 5) as u8, &round.to_le_bytes()).unwrap();
    }
    let stats = store.stats();
    assert!(stats.generation > 1, "compacted at least once");
    for key in 0..5u32 {
        let newest = (195 + key).to_le_bytes();
        assert_eq!(get(&mut store, key as u8).as_deref(), Some(&newest[..]));
    }
    let flash = store.into_flash();
    let (mut store, report) = Store::mount(flash).unwrap();
    assert!(!report.formatted && !report.recovered);
    assert_eq!(
        get(&mut store, 4).as_deref(),
        Some(&199u32.to_le_bytes()[..])
    );
}

#[test]
fn full_live_set_is_reported() {
    let (mut store, _) = Store::mount(RamFlash::new(512)).unwrap();
    let mut result = Ok(());
    for key in 0..KEYS as u8 {
        result = store.put(key, &[key; 40]);
        if result.is_err() {
            break;
        }
    }
    assert_eq!(result, Err(StoreError::Full));
}

/// Cuts power after every possible number of programmed bytes during a
/// sequence of writes that includes compactions, then remounts. Each key must
/// read back either its value before the interrupted write or the new one,
/// and every completed write must survive.
#[test]
fn every_power_cut_point_leaves_old_or_new_value() {
    // Learn how many bytes the whole sequence programs.
    let script: Vec<(u8, Vec<u8>)> = (0..60u32)
        .map(|i| ((i % 3) as u8, i.to_le_bytes().to_vec()))
        .collect();
    let run = |budget: Option<usize>| -> (RamFlash, usize) {
        let (store, _) = Store::mount(RamFlash::new(256)).unwrap();
        let mut flash = store.into_flash();
        flash.budget = budget;
        let (mut store, _) = Store::mount(flash).unwrap();
        let mut done = 0;
        for (key, value) in &script {
            if store.put(*key, value).is_err() {
                break;
            }
            done += 1;
        }
        (store.into_flash(), done)
    };
    let (_, all) = run(None);
    assert_eq!(all, script.len());

    for cut in 0..2000 {
        let (mut flash, done) = run(Some(cut));
        flash.budget = None;
        let (mut store, _) = Store::mount(flash).unwrap();
        for key in 0..3u8 {
            // The last completed write for this key, and the interrupted one.
            let before = script[..done]
                .iter()
                .rev()
                .find(|(k, _)| *k == key)
                .map(|(_, v)| v.clone());
            let interrupted = script
                .get(done)
                .filter(|(k, _)| *k == key)
                .map(|(_, v)| v.clone());
            let got = get(&mut store, key);
            assert!(
                got == before || (interrupted.is_some() && got == interrupted),
                "cut {cut}: key {key} read {got:?}, expected {before:?} or {interrupted:?}"
            );
        }
        // The store keeps working after recovery.
        store.put(2, b"after").unwrap();
        assert_eq!(get(&mut store, 2).as_deref(), Some(&b"after"[..]));
        if done == script.len() {
            break;
        }
    }
}

#[test]
fn corrupt_header_falls_back_to_the_other_bank() {
    let (mut store, _) = Store::mount(RamFlash::new(256)).unwrap();
    for i in 0..30u32 {
        store.put(0, &i.to_le_bytes()).unwrap();
    }
    let active = store.stats().bank as usize;
    assert!(store.stats().generation >= 2);
    let mut flash = store.into_flash();
    // Damage the newest header: mount must use the older bank, whose data is
    // older but intact, rather than fail.
    flash.banks[active][5] ^= 0x01;
    let (mut store, report) = Store::mount(flash).unwrap();
    assert!(!report.formatted);
    assert!(get(&mut store, 0).is_some());
}

#[test]
fn crc_matches_zlib() {
    assert_eq!(crc32_update(0, b"123456789"), 0xCBF4_3926);
    assert_eq!(
        crc32_update(crc32_update(0, b"1234"), b"56789"),
        0xCBF4_3926
    );
}
