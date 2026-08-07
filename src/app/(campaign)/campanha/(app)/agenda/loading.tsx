export default function AgendaLoading() {
  return (
    <div className="mx-auto flex w-full max-w-screen-2xl animate-pulse flex-col gap-6" aria-busy>
      <div className="ml-auto h-11 w-64 rounded-lg bg-muted" />
      <div className="h-24 rounded-xl bg-muted" />
      <div className="h-[42rem] rounded-xl bg-muted" />
      <span className="sr-only">Carregando agenda.</span>
    </div>
  )
}
