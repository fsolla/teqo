import { Skeleton } from '@/components/ui/skeleton'
import { HOME_SEARCH_HIT_ROW_WRAPPER_CLASS } from '@/lib/homeSearchUi'
import { cn } from '@/lib/utils'

const HOME_SEARCH_SUGGEST_SKELETON_ROW_COUNT = 3

const HomeSearchSuggestSkeletonRow = () => (
  <div className={cn(HOME_SEARCH_HIT_ROW_WRAPPER_CLASS, 'flex min-h-11 items-center gap-3 py-2.5')}>
    <div className="min-w-0 flex-1 space-y-1.5">
      <Skeleton className="h-4 w-3/5 max-w-[12rem]" />
      <Skeleton className="h-3 w-2/5 max-w-[8rem]" />
    </div>
  </div>
)

/** B106 — placeholder rows while suggest/search hits are still loading. */
export const HomeSearchSuggestSkeleton = () => (
  <div
    data-slot="home-search-suggest-skeleton"
    data-testid="home-search-suggest-skeleton"
    className="flex flex-col"
    aria-hidden
  >
    {Array.from({ length: HOME_SEARCH_SUGGEST_SKELETON_ROW_COUNT }, (_, index) => (
      <HomeSearchSuggestSkeletonRow key={index} />
    ))}
  </div>
)
