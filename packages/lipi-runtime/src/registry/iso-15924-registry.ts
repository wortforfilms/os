import { lipi426Master } from "../data/lipi-426-master";

export const iso15924Registry = Object.freeze(
  lipi426Master.map((script) => ({
    isoCode: script.isoCode,
    name: script.name,
    status: script.status,
  })),
);
