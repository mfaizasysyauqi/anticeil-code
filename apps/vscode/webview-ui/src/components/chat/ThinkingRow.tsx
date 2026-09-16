import { ChevronDownIcon, ChevronRightIcon, SparklesIcon } from "lucide-react"
import { memo, useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ThinkingRowProps {
	showTitle: boolean
	reasoningContent?: string
	isVisible: boolean
	isExpanded: boolean
	onToggle?: () => void
	title?: string
	isStreaming?: boolean
	showChevron?: boolean
}

export const ThinkingRow = memo(
	({
		showTitle = false,
		reasoningContent,
		isVisible,
		isExpanded,
		onToggle,
		title = "Thinking",
		isStreaming = false,
		showChevron = true,
	}: ThinkingRowProps) => {
		const scrollRef = useRef<HTMLDivElement>(null)
		const [canScrollUp, setCanScrollUp] = useState(false)
		const [canScrollDown, setCanScrollDown] = useState(false)

		const checkScrollable = useCallback(() => {
			if (scrollRef.current) {
				const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
				setCanScrollUp(scrollTop > 1)
				setCanScrollDown(scrollTop + clientHeight < scrollHeight - 1)
			}
		}, [])

		// Auto-scroll to bottom during streaming
		useEffect(() => {
			if (scrollRef.current && isVisible) {
				scrollRef.current.scrollTop = scrollRef.current.scrollHeight
			}
			checkScrollable()
		}, [reasoningContent, isVisible, checkScrollable])

		if (!isVisible) {
			return null
		}

		if (!isExpanded && !showTitle) {
			return null
		}

		return (
			<div className="grid grid-cols-[16px_1fr] items-start gap-x-2.5 mb-2.5 relative">
				{/* Left: Timeline Dot & Stem */}
				<div className="flex flex-col items-center h-full">
					<div
						className={cn(
							"w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 mt-0.5 box-border transition-all duration-200",
							isStreaming
								? "border border-indigo-400/80 bg-indigo-500/20 text-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.35)] animate-pulse"
								: "border border-editor-group-border bg-vscode-toolbar-hoverBackground/40 text-description",
						)}
						style={{
							borderColor: isStreaming ? undefined : "var(--vscode-editorGroup-border)",
						}}>
						<SparklesIcon className="w-2 h-2" />
					</div>
					{/* Vertical Line Connecting to Next Item */}
					<div
						className="w-[1.5px] grow my-1 rounded-full min-h-[12px]"
						style={{
							backgroundColor: "var(--vscode-tree-indentGuidesStroke, rgba(255, 255, 255, 0.12))",
						}}
					/>
				</div>

				{/* Right: Content Node */}
				<div className="min-w-0 pb-1">
					{showTitle && (
						<Button
							className={cn(
								"inline-flex items-center gap-1.5 text-left select-none px-0 py-0 my-0 h-auto min-h-0 w-full text-description hover:text-foreground cursor-pointer overflow-visible bg-transparent border-0",
								{
									"cursor-pointer": !!onToggle,
									"cursor-default": !onToggle,
								},
							)}
							onClick={onToggle}
							size="icon"
							variant="icon">
							<span
								className={cn("text-[12px] font-medium leading-none", {
									"animate-shimmer bg-linear-90 from-foreground to-description bg-[length:200%_100%] bg-clip-text text-transparent":
										isStreaming,
									"select-none": isStreaming,
								})}>
								{title}
							</span>
							{showChevron &&
								(isExpanded ? (
									<ChevronDownIcon className="w-3 h-3 text-description opacity-70 shrink-0" />
								) : (
									<ChevronRightIcon className="w-3 h-3 text-description opacity-70 shrink-0" />
								))}
						</Button>
					)}

					{isExpanded && (
						<div
							className={cn(
								"mt-1.5 rounded-md border p-2.5 text-xs text-description leading-relaxed relative overflow-hidden",
								"transition-all duration-200",
							)}
							style={{
								backgroundColor: "var(--vscode-editor-background)",
								borderColor: "var(--vscode-editorGroup-border, rgba(255, 255, 255, 0.1))",
							}}>
							<div
								className="flex max-h-[160px] overflow-y-auto whitespace-pre-wrap break-words [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
								onScroll={checkScrollable}
								ref={scrollRef}>
								<span className="block text-xs font-mono opacity-90">{reasoningContent}</span>
							</div>
							{canScrollUp && (
								<div className="absolute top-0 left-0 right-0 h-4 pointer-events-none bg-gradient-to-b from-background to-transparent" />
							)}
							{canScrollDown && (
								<div className="absolute bottom-0 left-0 right-0 h-4 pointer-events-none bg-gradient-to-t from-background to-transparent" />
							)}
						</div>
					)}
				</div>
			</div>
		)
	},
)

ThinkingRow.displayName = "ThinkingRow"

