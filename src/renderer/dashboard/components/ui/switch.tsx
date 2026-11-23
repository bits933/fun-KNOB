import * as React from 'react'
import { Switch as SwitchPrimitive } from 'radix-ui'
import { cn } from '../../lib/utils'

const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-full border border-white/[0.10] transition-[background-color,border-color] duration-150 data-[state=checked]:bg-[linear-gradient(180deg,#39695a_0%,#245b52_100%)] data-[state=checked]:border-transparent data-[state=unchecked]:bg-white/[0.12] focus-visible:outline-1 focus-visible:outline-active-border focus-visible:outline-offset-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-45',
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-[20px] w-[20px] rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.45)] ring-0 transition-transform duration-150 ease-out motion-reduce:transition-none data-[state=checked]:translate-x-[22px] data-[state=unchecked]:translate-x-[2px]'
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = 'Switch'

export { Switch }
