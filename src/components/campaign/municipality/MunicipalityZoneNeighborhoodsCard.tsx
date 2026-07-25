import {
  municipalityZoneNeighborhoodEntryForSlug,
  municipalityZoneNeighborhoodSourceLabel,
} from '@/lib/municipalityZoneNeighborhoods'

export const MunicipalityZoneNeighborhoodsCard = ({ municipalitySlug }: { municipalitySlug: string }) => {
  const entry = municipalityZoneNeighborhoodEntryForSlug(municipalitySlug)
  if (!entry?.neighborhoods.length) return null

  const { neighborhoods, source } = entry

  return (
    <section
      aria-labelledby="municipality-zone-neighborhoods-title"
      className="flex flex-col gap-4 rounded-xl border p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="municipality-zone-neighborhoods-title" className="text-base font-medium">
          Bairros desta Praça
        </h2>
        <p className="text-sm text-muted-foreground">
          {neighborhoods.length}{' '}
          {neighborhoods.length === 1 ? 'bairro' : 'bairros'} ·{' '}
          {municipalityZoneNeighborhoodSourceLabel(source)}
        </p>
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {neighborhoods.map((neighborhood) => (
          <li
            key={neighborhood}
            className="rounded-md border px-3 py-2 text-sm text-foreground"
          >
            {neighborhood}
          </li>
        ))}
      </ul>
    </section>
  )
}
