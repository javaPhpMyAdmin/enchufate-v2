# Proposal: Open Charge Map Integration

## Intent

Map has P2P + UTE (~207). Non-UTE operators (eOne, DMC) are invisible. OCM adds ~80–110 POIs with richer metadata. Integrate OCM as third source, deduplicated against UTE via proximity matching.

## Scope

### In Scope
- `fetchOCMChargers.ts` — OCM API client + normalization
- `connectionTypeMap.ts` — OCM ID → `ConnectorType` mapping
- `useOCMChargers.ts` — TanStack Query hook gated by `OCM_CHARGERS`
- `useChargers.ts` merge — 50m proximity dedup, OCM fills non-UTE gaps
- `'ocm'` added to `ChargerSource` union
- `OCM_CHARGERS: false` in `src/lib/features.ts`
- Graceful degradation on fetch failure

### Out of Scope
- OCM photos/pricing in popup (deferred)
- OCM comments/check-in data
- Offline fallback
- Detail screen navigation — popup only

## Capabilities

### New
- `public-chargers-ocm`: OCM fetching, normalization, connection mapping, dedup against UTE.

### Modified
- `map`: Third source (`'ocm'`) added. Source filter updated. Dedup in merge pipeline.

## Approach

**Parallel source, UTE pattern.** `useChargers` adds `useOCMChargers()`. Merge excludes OCM stations within 50m of a UTE station — UTE wins on connector data, OCM fills metadata gaps. `OCM_CHARGERS` gates query. API key via `EXPO_PUBLIC_OCM_API_KEY`. `User-Agent` header for Cloudflare. `staleTime: 5min`.

## Affected Areas

| Area | Impact | ~Lines |
|------|--------|--------|
| `src/features/chargers/ocm/fetchOCMChargers.ts` | New | 120 |
| `src/features/chargers/ocm/connectionTypeMap.ts` | New | 40 |
| `src/features/chargers/hooks/useOCMChargers.ts` | New | 35 |
| `src/features/chargers/hooks/useChargers.ts` | Modified | 30 |
| `src/features/chargers/types.ts` | Modified | 2 |
| `src/lib/features.ts` | Modified | 1 |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| API key not registered | High | Flag-gated, build-time injection |
| Cloudflare blocks | Med | `User-Agent` + retry |
| OCM-UTE duplicates | Med | 50m dedup, UTE priority |
| PowerKW=0 or missing | Med | Infer from LevelID; UI shows "N/A" |

## Rollback Plan

Flip `OCM_CHARGERS` to `false` — OCM stops, merge reverts to P2P+UTE. Zero DB changes.

## Dependencies

- OCM API key (`EXPO_PUBLIC_OCM_API_KEY`) — user to register at openchargemap.org
- No new npm packages

## Success Criteria

- [ ] OCM-only stations visible alongside UTE and P2P pins
- [ ] UTE/OCM overlap renders once (UTE wins)
- [ ] `OCM_CHARGERS: false` disables OCM entirely
- [ ] OCM fetch failure degrades to P2P+UTE, no crash
- [ ] `pnpm typecheck` passes
- [ ] ~233 lines, fits single PR
