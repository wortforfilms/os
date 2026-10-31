MEMORY
{
  /* Sectors 0-4 (128 KiB) hold the kernel. Sector 5 (0x08020000) is the
     run-time capsule area (src/installed.rs), and sectors 6 and 7
     (0x08040000-0x0807FFFF) are the two banks of the persistent store
     (src/storage/persist.rs); all three must stay out of the image. */
  FLASH : ORIGIN = 0x08000000, LENGTH = 128K
  RAM : ORIGIN = 0x20000000, LENGTH = 128K
}

_stack_start = ORIGIN(RAM) + LENGTH(RAM);