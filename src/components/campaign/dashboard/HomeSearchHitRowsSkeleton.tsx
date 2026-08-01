import { Skeleton } from '@/components/ui/skeleton'
import { HOME_SEARCH_HIT_ROW_WRAPPER_CLASS } from '@/lib/homeSearchUi'

const HOME_SEARCH_HIT_ROW_SKELETON_PRIORITY_CLASS = 'h-4 w-4 shrink-0 rounded-sm'
const HOME_SEARCH_HIT_ROW_SKELETON_PRIMARY_CLASS = 'h-4 w-40 max-w-full'
const HOME_SEARCH_HIT_ROW_SKELETON_SECONDARY_CLASS = 'h-3 w-28 max-w-full'

export const HomeSearchHitRowsSkeleton = ({ count = 3 }: { count?: number }) => (
  <ul className="m-0 list-none p-0" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => (
      <li key={index}>
        <div className={HOME_SEARCH_HIT_ROW_WRAPPER_CLASS}>
          <div className="flex min-h-11 items-center gap-3 py-2.5">
            <Skeleton className={HOME_SEARCH_HIT_ROW_SKELETON_PRIORITY_CLASS} />
            <div className="min-w-0 flex-1 space-y-1">
              <Skeleton className={HOME_SEARCH_HIT_ROW_SKELETON_PRIMARY_CLASS} />
              <Skeleton className={HOME_SEARCH_HIT_ROW_SKELETON_SECONDARY_CLASS} />
            </div>
            <Skeleton className="h-4 w-8 shrink-0 tabular-nums" />
          </div>
        </div>
      </li>
    ))}
  </ul>
)
