import * as React from 'react'
import { cn } from '@/lib/utils'
import { DictationButton } from '@/components/ui/dictation-button'

type TextareaProps = React.ComponentProps<'textarea'> & {
  /** Shows a mic button in the corner so the user can dictate into the field (not voice mode). */
  dictation?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, dictation, ...props }, ref) => {
  const inner = React.useRef<HTMLTextAreaElement>(null)
  React.useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement)
  const field = (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-md border-[1.5px] border-hairline-strong bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-glow disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        dictation && 'pr-11',
        className
      )}
      ref={inner}
      {...props}
    />
  )
  if (!dictation) return field
  return (
    <div className="relative w-full">
      {field}
      <DictationButton target={inner} disabled={props.disabled || props.readOnly} className="absolute bottom-1.5 right-1.5 h-8 w-8" />
    </div>
  )
})
Textarea.displayName = 'Textarea'

export { Textarea }
