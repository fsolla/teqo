/**
 * Ground-scale policy shared by the committed Bahia TopoJSON meshes.
 *
 * Every mesh in `src/lib/geometries/` is simplified and quantized before it is
 * committed, and the two knobs that control that only mean something in ground
 * units:
 *
 * - **Simplification tolerance** — Visvalingam drops a vertex whose effective
 *   triangle is smaller than a threshold in square degrees. `topojson-simplify`
 *   can pick that threshold as a *quantile* of the topology's own triangles,
 *   which is what both build scripts used to do with a copied `0.35`. A quantile
 *   is relative to the mesh: the same `0.35` cut Salvador's 19 neighbourhood-
 *   derived zones at ~0.6 m² while it cut the 417 municipalities at ~1.78 km².
 *   This is the dominant lever, and it is why the zone mesh shipped at 480 points
 *   per feature against the state mesh's 21.9.
 * - **Quantization digits** — `topojson-client`'s `quantize(topo, n)` lays an
 *   `n`-step grid across *the topology's own bbox*, so a copied `1e4` means
 *   ~103 m across Bahia and ~3.9 m across Salvador: a 26× finer grid step nobody
 *   asked for. Measured, it is the minor knob — putting the zones on the state's
 *   ~103 m grid alone took them from 480 points per feature to 203, and only the
 *   absolute tolerance below reached 30.2.
 *
 * So the policy is declared here in ground units and the bbox-relative numbers
 * are derived per topology. Tolerances are per mesh *on purpose* — a tolerance
 * is a statement about the size of the shapes being drawn, and a Salvador zone
 * (~16 km²) is three orders of magnitude smaller than a Bahia municipality
 * (~1,340 km²) — but they now sit side by side in ground units, so divergence
 * is a visible decision instead of an accident of a copied constant.
 */

import { quantize } from 'topojson-client'
import { presimplify, simplify } from 'topojson-simplify'

/**
 * Metres per degree at the equator. Bahia spans ~9°–18° S, where a degree of
 * longitude is 5–8% shorter, so every metre here is a nominal metre — good
 * enough to size a tolerance, not a distance measurement.
 */
const METRES_PER_DEGREE = 111_320

const SQUARE_METRES_PER_SQUARE_DEGREE = METRES_PER_DEGREE * METRES_PER_DEGREE

/**
 * Ground resolution of the committed meshes. Chosen as the step the state mesh
 * has always had (`1e4` digits over its 9.2357° bbox), so honoring the policy
 * leaves `bahia-municipalities.topo.json` byte-identical.
 */
const GROUND_GRID_METRES = 102.82

/**
 * Simplification tolerance per mesh, as the ground area of the smallest
 * triangle kept. Each value is followed by the density it buys, measured — the
 * tripwire in `tests/int/bahiaGeometries.int.spec.ts` asserts points per
 * feature, so a mesh that silently goes back to a relative cut fails there.
 */
export const SIMPLIFY_TOLERANCE_M2 = {
  /** 1.78 km² → 21.9 points/feature. The state mesh's historical cut. */
  bahiaMunicipalities: 1_776_383,
  /** 13.6 km² → 44.8 points/feature. Dissolved from the mesh above, so these
   * outlines already carry the municipal cut and anything at or below it is
   * close to a no-op; 13.6 km² is a deliberate step coarser, sized to shapes
   * ~15× larger. */
  bahiaIdentityTerritories: 13_591_527,
  /** 0.06 km² → 30.2 points/feature. Sized to Salvador's zones rather than to
   * Bahia's municipalities: the municipal tolerance does reach 17.9
   * points/feature here, but it also sheds 5% of the city's land area
   * (306 → 291 km²), which is the quantity the int spec uses to prove no
   * neighbourhood was dropped or double-counted. */
  bahiaMunicipalityZones: 60_000,
}

/**
 * Quantization digits that lay `GROUND_GRID_METRES` across this topology's own
 * bbox. `quantize` derives its scale from `n - 1` steps, so the requested step
 * is honored to within one grid cell.
 *
 * `quantize` applies that single digit count to BOTH axes, so the step is only
 * exact on the axis it is derived from — longitude here — and latitude follows
 * the bbox aspect ratio: measured, 102.8×109.2 m for the two statewide meshes
 * and 102.9×80.1 m for Salvador's. Anchoring on X is what keeps
 * `bahia-municipalities.topo.json` byte-identical to its pre-policy build;
 * making both axes exact would mean passing an explicit `{scale, translate}`
 * transform and rewriting all three artifacts. `describeGroundScale` prints
 * both steps, so the asymmetry is visible in every build log.
 */
const quantizeDigitsFor = (topo, gridMetres) => {
  const [minX, , maxX] = topo.bbox
  return Math.round((maxX - minX) / (gridMetres / METRES_PER_DEGREE)) + 1
}

/**
 * Simplify to a ground tolerance and quantize to the shared ground grid.
 *
 * Order matters: quantizing a dense mesh to a ~100 m grid before simplifying it
 * collapses vertices into duplicates, and a later `merge` of such a topology
 * produces broken rings (measured: Salvador's 307 km² dissolved to 24 km²).
 */
export const simplifyToGroundScale = (topo, toleranceM2) => {
  const minWeight = toleranceM2 / SQUARE_METRES_PER_SQUARE_DEGREE
  return quantizeToGroundGrid(simplify(presimplify(topo), minWeight))
}

/** Quantize an already-simplified topology to the shared ground grid. */
export const quantizeToGroundGrid = (topo) =>
  quantize(topo, quantizeDigitsFor(topo, GROUND_GRID_METRES))

/**
 * One line describing what a topology actually landed on, so a rebuild reports
 * the ground scale instead of leaving it to be re-derived from the artifact.
 * Every topology here holds exactly one object (the int spec pins that), so the
 * name is read off it rather than passed in twice.
 */
export const describeGroundScale = (topo) => {
  const [name, object] = Object.entries(topo.objects)[0]
  const arcPoints = topo.arcs.reduce((total, arc) => total + arc.length, 0)
  const features = object.geometries.length
  const stepMetres = topo.transform.scale.map((scale) => scale * METRES_PER_DEGREE)
  return (
    `${name}: ${features} features, ${arcPoints} arc points ` +
    `(${(arcPoints / features).toFixed(1)}/feature), ` +
    `grid ${stepMetres.map((step) => step.toFixed(1)).join('×')} m`
  )
}
