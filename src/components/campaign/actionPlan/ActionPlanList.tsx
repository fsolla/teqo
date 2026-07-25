import { ActionPlanCard } from '@/components/campaign/actionPlan/ActionPlanCard'
import type { ActionPlanListViewModel } from '@/utilities/actionPlanViewModels'

export const ActionPlanList = ({ plans }: { plans: ActionPlanListViewModel[] }) => (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {plans.map((plan) => (
      <ActionPlanCard key={plan.id} plan={plan} />
    ))}
  </div>
)
