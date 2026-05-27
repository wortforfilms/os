# Release Support Checklist

Before any release-candidate support review, confirm:

- [ ] `npm run typecheck` completed
- [ ] `npm run test` completed
- [ ] `npm run status:matrix` completed
- [ ] `npm run govern:release` completed
- [ ] hardware-root evidence is not fabricated
- [ ] operator quorum is verified or honestly blocked
- [ ] signed release authority is verified or honestly blocked
- [ ] rollback drill is verified or honestly blocked
- [ ] `PRODUCTION_READY=false` unless every governed gate passes

Current default:

```txt
PRODUCTION_READY=false
FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO
```
