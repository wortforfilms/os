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

const KEY: StoreKey = [7; 32];

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
    let (mut store, report) = Store::mount(RamFlash::new(1024), &KEY).unwrap();
    assert!(report.formatted);
    assert_eq!(get(&mut store, 3), None);
    store.put(3, b"hello").unwrap();
    store.put(4, b"world").unwrap();
    store.put(3, b"hello again").unwrap();
    let flash = store.into_flash();

    let (mut store, report) = Store::mount(flash, &KEY).unwrap();
    assert_eq!(report, MountReport::default());
    assert_eq!(get(&mut store, 3).as_deref(), Some(&b"hello again"[..]));
    assert_eq!(get(&mut store, 4).as_deref(), Some(&b"world"[..]));
    assert_eq!(store.stats().live_keys, 2);
}

#[test]
fn delete_and_limits() {
    let (mut store, _) = Store::mount(RamFlash::new(1024), &KEY).unwrap();
    store.put(1, b"x").unwrap();
    store.delete(1).unwrap();
    assert_eq!(get(&mut store, 1), None);
    assert_eq!(store.put(KEYS as u8, b"x"), Err(StoreError::BadKey));
    assert_eq!(store.put(1, &[0; MAX_VALUE + 1]), Err(StoreError::TooLong));
    store.put(1, &[7; MAX_VALUE]).unwrap();
    let mut small = [0u8; 4];
    assert_eq!(store.get(1, &mut small), Err(StoreError::TooLong));
    let flash = store.into_flash();
    let (mut store, _) = Store::mount(flash, &KEY).unwrap();
    assert_eq!(get(&mut store, 1), Some(vec![7; MAX_VALUE]));
}

#[test]
fn compaction_keeps_newest_values_and_switches_bank() {
    let (mut store, _) = Store::mount(RamFlash::new(512), &KEY).unwrap();
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
    let (mut store, report) = Store::mount(flash, &KEY).unwrap();
    assert!(!report.formatted && !report.recovered);
    assert_eq!(
        get(&mut store, 4).as_deref(),
        Some(&199u32.to_le_bytes()[..])
    );
}

#[test]
fn full_live_set_is_reported() {
    let (mut store, _) = Store::mount(RamFlash::new(512), &KEY).unwrap();
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
        let (store, _) = Store::mount(RamFlash::new(256), &KEY).unwrap();
        let mut flash = store.into_flash();
        flash.budget = budget;
        let (mut store, _) = Store::mount(flash, &KEY).unwrap();
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
        let (mut store, _) = Store::mount(flash, &KEY).unwrap();
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
    let (mut store, _) = Store::mount(RamFlash::new(256), &KEY).unwrap();
    for i in 0..30u32 {
        store.put(0, &i.to_le_bytes()).unwrap();
    }
    let active = store.stats().bank as usize;
    assert!(store.stats().generation >= 2);
    let mut flash = store.into_flash();
    // Damage the newest header: mount must use the older bank, whose data is
    // older but intact, rather than fail.
    flash.banks[active][5] ^= 0x01;
    let (mut store, report) = Store::mount(flash, &KEY).unwrap();
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

/// Writes an unsealed (`MKV1`) bank the way the earlier store did.
fn v1_bank(flash: &mut RamFlash, bank: usize, generation: u32, records: &[(u8, &[u8])]) {
    let b = &mut flash.banks[bank];
    b.fill(0xFF);
    b[..4].copy_from_slice(b"MKV1");
    b[4..8].copy_from_slice(&generation.to_le_bytes());
    let crc = crc32_update(0, &b[..12]);
    b[12..16].copy_from_slice(&crc.to_le_bytes());
    let mut at = 16;
    for (key, value) in records {
        let head = [*key, value.len() as u8, 0xFF, 0xFF];
        b[at..at + 4].copy_from_slice(&head);
        b[at + 4..at + 4 + value.len()].copy_from_slice(value);
        let crc = crc32_update(crc32_update(0, &head), value);
        let p = at + 4 + ((value.len() + 3) & !3);
        b[p..p + 4].copy_from_slice(&crc.to_le_bytes());
        at = p + 4;
    }
}

fn contains(haystack: &[u8], needle: &[u8]) -> bool {
    haystack.windows(needle.len()).any(|w| w == needle)
}

#[test]
fn values_are_not_stored_in_the_clear() {
    let (mut store, _) = Store::mount(RamFlash::new(1024), &KEY).unwrap();
    store.put(20, b"a secret value").unwrap();
    let flash = store.into_flash();
    assert!(!contains(&flash.banks[0], b"a secret value"));
    assert!(!contains(&flash.banks[1], b"a secret value"));
}

#[test]
fn a_changed_value_is_never_returned() {
    let (mut store, _) = Store::mount(RamFlash::new(1024), &KEY).unwrap();
    store.put(1, b"first").unwrap();
    store.put(2, b"second").unwrap();
    let active = store.stats().bank as usize;
    let flash = store.into_flash();
    // Flip each bit of the second record (key 2) in turn: mount must drop
    // it, as it would a torn write, and never return a changed value.
    let second = HEADER_BYTES as usize + record_bytes(5) as usize;
    for byte in second..second + record_bytes(6) as usize {
        for bit in 0..8 {
            let mut copy = flash.clone();
            copy.banks[active][byte] ^= 1 << bit;
            let (mut store, report) = Store::mount(copy, &KEY).unwrap();
            assert!(report.recovered, "byte {byte} bit {bit}");
            assert_eq!(get(&mut store, 1).as_deref(), Some(&b"first"[..]));
            assert_eq!(get(&mut store, 2), None, "byte {byte} bit {bit}");
        }
    }
    // A change after mount is caught when the value is read.
    let mut out = [0u8; MAX_VALUE];
    let (mut mounted, _) = Store::mount(flash, &KEY).unwrap();
    mounted.flash.banks[active][second + 4] ^= 0x01;
    assert_eq!(mounted.get(2, &mut out), Err(StoreError::Corrupt));
    assert_eq!(
        out, [0u8; MAX_VALUE],
        "nothing of the forged value is returned"
    );
}

#[test]
fn a_record_moved_to_another_place_does_not_open() {
    let (mut store, _) = Store::mount(RamFlash::new(1024), &KEY).unwrap();
    store.put(3, b"value").unwrap();
    let active = store.stats().bank as usize;
    let mut flash = store.into_flash();
    // Copy the record to the next free offset, under the same key.
    let first = HEADER_BYTES as usize;
    let len = record_bytes(5) as usize;
    let record: Vec<u8> = flash.banks[active][first..first + len].to_vec();
    flash.banks[active][first + len..first + 2 * len].copy_from_slice(&record);
    let (_, report) = Store::mount(flash, &KEY).unwrap();
    assert!(report.recovered, "the copy fails its tag at its new offset");
}

#[test]
fn a_store_sealed_with_another_key_is_refused_and_left_alone() {
    let (mut store, _) = Store::mount(RamFlash::new(1024), &KEY).unwrap();
    store.put(5, b"mine").unwrap();
    let flash = store.into_flash();
    let before = flash.banks.clone();
    let other = [8u8; 32];
    match Store::mount(flash.clone(), &other) {
        Err(StoreError::WrongKey) => {}
        Err(e) => panic!("expected WrongKey, got {e:?}"),
        Ok(_) => panic!("expected WrongKey, got a mounted store"),
    }
    assert_eq!(flash.banks, before);
    let (mut store, _) = Store::mount(flash, &KEY).unwrap();
    assert_eq!(get(&mut store, 5).as_deref(), Some(&b"mine"[..]));
}

#[test]
fn an_unsealed_store_is_migrated_once_and_its_bank_erased() {
    let mut flash = RamFlash::new(1024);
    v1_bank(
        &mut flash,
        0,
        41,
        &[(0, &7u32.to_le_bytes()), (32, b"abcd"), (32, b"wxyz")],
    );
    let (mut store, report) = Store::mount(flash, &KEY).unwrap();
    assert!(report.migrated && !report.formatted);
    assert_eq!(store.stats().bank, 1);
    assert_eq!(store.stats().generation, 42);
    assert_eq!(get(&mut store, 0).as_deref(), Some(&7u32.to_le_bytes()[..]));
    assert_eq!(get(&mut store, 32).as_deref(), Some(&b"wxyz"[..]));
    let flash = store.into_flash();
    assert!(flash.banks[0].iter().all(|&b| b == 0xFF), "old bank erased");
    assert!(!contains(&flash.banks[1], b"wxyz"));
    let (_, report) = Store::mount(flash, &KEY).unwrap();
    assert_eq!(report, MountReport::default());
}

#[test]
fn unsealed_data_is_ignored_once_the_store_is_sealed() {
    let (mut store, _) = Store::mount(RamFlash::new(1024), &KEY).unwrap();
    store.put(32, b"real").unwrap();
    let active = store.stats().bank as usize;
    let mut flash = store.into_flash();
    // A forged unsealed bank with a much higher generation.
    v1_bank(&mut flash, 1 - active, 1_000_000, &[(32, b"fake")]);
    let (mut store, report) = Store::mount(flash, &KEY).unwrap();
    assert!(!report.migrated);
    assert_eq!(get(&mut store, 32).as_deref(), Some(&b"real"[..]));
}

#[test]
fn device_keys_differ_per_device_and_key_ids_are_stable() {
    let a = derive_device_key(&KEY, b"device-0001\0");
    let b = derive_device_key(&KEY, b"device-0002\0");
    assert_ne!(a, b);
    assert_eq!(a, derive_device_key(&KEY, b"device-0001\0"));
    assert_eq!(key_id(&a), key_id(&a));
    assert_ne!(key_id(&a), key_id(&b));
}

mod area_tests {
    use super::RamFlash;
    use crate::area::{entry_bytes, InstallArea, MAX_IMAGE};

    fn install(area: &mut InstallArea<RamFlash>, image: &[u8]) {
        let mut scratch = vec![0u8; MAX_IMAGE];
        area.begin(image.len(), &mut scratch).unwrap();
        for (i, chunk) in image.chunks(7).enumerate() {
            area.write(i * 7, chunk).unwrap();
        }
        let mut check = vec![0u8; MAX_IMAGE];
        let n = area.read_pending(&mut check).unwrap();
        assert_eq!(&check[..n], image);
        area.commit().unwrap();
    }

    fn installed(area: &mut InstallArea<RamFlash>) -> Option<Vec<u8>> {
        let mut out = vec![0u8; MAX_IMAGE];
        area.read_installed(&mut out)
            .unwrap()
            .map(|n| out[..n].to_vec())
    }

    #[test]
    fn installs_survive_a_remount_and_the_newest_wins() {
        let mut area = InstallArea::mount(RamFlash::new(4096)).unwrap();
        assert_eq!(installed(&mut area), None);
        install(&mut area, b"first image");
        install(&mut area, b"second image, a bit longer");
        let mut area = InstallArea::mount(area.into_flash()).unwrap();
        assert_eq!(
            installed(&mut area).as_deref(),
            Some(&b"second image, a bit longer"[..])
        );
    }

    #[test]
    fn a_refused_install_leaves_the_previous_one() {
        let mut area = InstallArea::mount(RamFlash::new(4096)).unwrap();
        install(&mut area, b"good");
        let mut scratch = vec![0u8; MAX_IMAGE];
        area.begin(5, &mut scratch).unwrap();
        area.write(0, b"bad!!").unwrap();
        area.abandon().unwrap();
        assert_eq!(installed(&mut area).as_deref(), Some(&b"good"[..]));
        let mut area = InstallArea::mount(area.into_flash()).unwrap();
        assert_eq!(installed(&mut area).as_deref(), Some(&b"good"[..]));
        // An install begun and never finished (no abandon either) is skipped.
        area.begin(5, &mut scratch).unwrap();
        area.write(0, b"torn!").unwrap();
        let mut area = InstallArea::mount(area.into_flash()).unwrap();
        assert_eq!(installed(&mut area).as_deref(), Some(&b"good"[..]));
    }

    #[test]
    fn remove_and_limits() {
        let mut area = InstallArea::mount(RamFlash::new(4096)).unwrap();
        let mut scratch = vec![0u8; MAX_IMAGE];
        assert!(area.begin(0, &mut scratch).is_err());
        assert!(area.begin(MAX_IMAGE + 1, &mut scratch).is_err());
        assert!(area.write(0, b"x").is_err(), "no install in progress");
        install(&mut area, b"to remove");
        area.begin(4, &mut scratch).unwrap();
        assert!(area.write(2, b"abc").is_err(), "past the declared length");
        area.abandon().unwrap();
        assert!(area.remove().unwrap());
        assert!(!area.remove().unwrap());
        let mut area = InstallArea::mount(area.into_flash()).unwrap();
        assert_eq!(installed(&mut area), None);
    }

    #[test]
    fn a_full_area_is_compacted_and_keeps_the_installed_image() {
        let mut area = InstallArea::mount(RamFlash::new(1024)).unwrap();
        for round in 0..40u32 {
            let image = vec![round as u8; 100 + round as usize];
            install(&mut area, &image);
            assert_eq!(installed(&mut area), Some(image.clone()));
        }
        assert!(area.into_flash().erases > 0, "compacted at least once");
        // An image that cannot fit even in an empty area.
        let mut area = InstallArea::mount(RamFlash::new(1024)).unwrap();
        let mut scratch = vec![0u8; MAX_IMAGE];
        assert!(area.begin(1024, &mut scratch).is_err());
        assert!(entry_bytes(1000) <= 1024);
    }

    /// Cuts power after every number of programmed bytes during an install
    /// over an installed image: the old image or the new one must be
    /// installed afterwards, never anything else.
    #[test]
    fn every_power_cut_leaves_the_old_or_the_new_image() {
        let old = b"the old image".to_vec();
        let new = vec![0x5A; 300];
        for cut in 0..400 {
            let mut area = InstallArea::mount(RamFlash::new(512)).unwrap();
            install(&mut area, &old);
            let mut flash = area.into_flash();
            flash.budget = Some(cut);
            let mut area = InstallArea::mount(flash).unwrap();
            let mut scratch = vec![0u8; MAX_IMAGE];
            let finished = (|| -> Result<(), crate::StoreError> {
                area.begin(new.len(), &mut scratch)?;
                for (i, chunk) in new.chunks(64).enumerate() {
                    area.write(i * 64, chunk)?;
                }
                area.commit()
            })()
            .is_ok();
            let mut flash = area.into_flash();
            flash.budget = None;
            let mut area = InstallArea::mount(flash).unwrap();
            let got = installed(&mut area);
            assert!(
                got.as_deref() == Some(&old[..]) || got.as_deref() == Some(&new[..]),
                "cut {cut}: {got:?}"
            );
            if finished {
                assert_eq!(got.as_deref(), Some(&new[..]), "cut {cut}");
                break;
            }
        }
    }
}
