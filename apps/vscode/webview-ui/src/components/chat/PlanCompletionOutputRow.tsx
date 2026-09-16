import { memo } from "react"
import { CopyButton } from "@/components/common/CopyButton"
import MarkdownBlock from "@/components/common/MarkdownBlock"

interface PlanCompletionOutputProps {
	text: string
}

/**
 * Quiet visual cue that the agent's plan-mode turn ended on this response:
 * a container tinted with the yellow plan accent (matching the plan/act
 * toggle and the CLI's plan-mode color) with a small, muted "Plan" label
 * and a copy button. Deliberately less prominent than the legacy bold
 * "Plan Created" header, since the response might be a question rather
 * than a finished plan.
 */
const PlanCompletionOutputRow = memo(({ text }: PlanCompletionOutputProps) => {
	return (
		<div className="rounded-sm border border-editor-group-border/40 overflow-visible bg-vscode-editor-background/50">
			<div className="flex items-center justify-between gap-2 pl-2 pr-1 pt-1 -mb-1">
				<span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">Plan</span>
				<CopyButton ariaLabel="Copy plan response" className="opacity-70 hover:opacity-100" textToCopy={text} />
			</div>
			<div className="plan-completion-content p-2 w-full [&_hr]:opacity-20 [&_p:last-child]:mb-0">
				<div className="wrap-anywhere [&_hr]:opacity-20">
					<MarkdownBlock markdown={text} />
				</div>
			</div>
		</div>
	)
})

PlanCompletionOutputRow.displayName = "PlanCompletionOutputRow"

export default PlanCompletionOutputRow
