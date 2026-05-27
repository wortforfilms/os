import { LIPI_426_EXPECTED_COUNT, lipi426Master } from "../data/lipi-426-master";

export const lipiEvidenceStatus = Object.freeze({
  registryExpected: LIPI_426_EXPECTED_COUNT,
  registryIngested: lipi426Master.length,
  registryStatus: lipi426Master.length === LIPI_426_EXPECTED_COUNT ? "PASS" : "BLOCKED",
  productionReady: false,
});
