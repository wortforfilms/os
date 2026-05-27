import { lipiBlockedReasons } from "./blocked-reasons";

export const lipiPhkdVerdict = Object.freeze({
  phkdVerdict: "BLOCKED",
  finalStatus: "GOVERNED_PRODUCTION_NO_GO",
  productionReady: false,
  activeBlockers: lipiBlockedReasons,
});
