MEMORY
{
  /* Sectors 0-5 (256 KiB) hold the kernel. Sectors 6 and 7
     (0x08040000-0x0807FFFF) are the two banks of the persistent store
     (src/storage/persist.rs) and must stay out of the image. */
  FLASH : ORIGIN = 0x08000000, LENGTH = 256K
  RAM : ORIGIN = 0x20000000, LENGTH = 128K
}

_stack_start = ORIGIN(RAM) + LENGTH(RAM);