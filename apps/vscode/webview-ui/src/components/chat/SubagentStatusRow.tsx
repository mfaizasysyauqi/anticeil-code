import {
	ClineAskUseSubagents,
	ClineMessage,
	ClineSaySubagentStatus,
	SubagentExecutionStatus,
	SubagentStatusItem,
} from "@shared/ExtensionMessage"
import {
	CheckIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	CircleSlashIcon,
	CircleXIcon,
	LoaderCircleIcon,
	NetworkIcon,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import MarkdownBlock from "../common/MarkdownBlock"

interface SubagentStatusRowProps {
	message: ClineMessage
	isLast: boolean
	lastModifiedMessage?: ClineMessage
}

type DisplayStatus = SubagentExecutionStatus | "cancelled"
type SubagentRowStatus = "pending" | "running" | "completed" | "failed"

interface SubagentRowData {
	status: SubagentRowStatus
	items: SubagentStatusItem[]
}

interface SubagentPromptTextProps {
	prompt: string
	isExpanded: boolean
	onShowMore: () => void
}

const getDotStyle = (status: DisplayStatus) => {
	switch (status) {
		case "running":
			return {
				backgroundColor: "rgba(0, 127, 212, 0.15)",
				border: "1.5px solid var(--vscode-focusBorder, #007fd4)",
				color: "var(--vscode-focusBorder, #007fd4)",
				boxShadow: "0 0 6px rgba(0, 127, 212, 0.35)",
			}
		case "completed":
			return {
				backgroundColor: "rgba(115, 201, 145, 0.15)",
				border: "1.5px solid var(--vscode-testing-iconPassed, #73c991)",
				color: "var(--vscode-testing-iconPassed, #73c991)",
			}
		case "failed":
			return {
				backgroundColor: "rgba(241, 76, 76, 0.15)",
				border: "1.5px solid var(--vscode-errorForeground, #f14c4c)",
				color: "var(--vscode-errorForeground, #f14c4c)",
			}
		case "cancelled":
			return {
				backgroundColor: "rgba(150, 150, 150, 0.12)",
				border: "1.5px solid var(--vscode-descriptionForeground, #888)",
				color: "var(--vscode-descriptionForeground, #888)",
			}
		default: // pending
			return {
				backgroundColor: "rgba(150, 150, 150, 0.08)",
				border: "1.5px solid var(--vscode-editorGroup-border, rgba(255, 255, 255, 0.16))",
				color: "var(--vscode-descriptionForeground, #888)",
			}
	}
}

const renderDotIcon = (status: DisplayStatus) => {
	switch (status) {
		case "running":
			return <LoaderCircleIcon className="w-2.5 h-2.5 animate-spin" />
		case "completed":
			return <CheckIcon className="w-2.5 h-2.5 stroke-[2.5]" />
		case "failed":
			return <CircleXIcon className="w-2.5 h-2.5 stroke-[2]" />
		case "cancelled":
			return <CircleSlashIcon className="w-2.5 h-2.5 stroke-[2]" />
		default:
			return <div className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
	}
}

const formatCount = (value: number | undefined): string => {
	if (!Number.isFinite(value)) {
		return "0"
	}

	return Intl.NumberFormat("en-US").format(value || 0)
}

const formatCost = (value: number | undefined): string => {
	const normalized = Number.isFinite(value) ? Math.max(0, value || 0) : 0
	const maximumFractionDigits = normalized >= 0.01 ? 2 : 4
	return Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits,
	}).format(normalized)
}

function parseSubagentRowData(message: ClineMessage): SubagentRowData | null {
	if (!message.text) {
		return null
	}

	try {
		if (message.ask === "use_subagents" || message.say === "use_subagents") {
			const parsed = JSON.parse(message.text) as ClineAskUseSubagents
			if (!Array.isArray(parsed.prompts)) {
				return null
			}
			const prompts = parsed.prompts.map((prompt) => prompt?.trim()).filter((prompt): prompt is string => !!prompt)
			if (prompts.length === 0) {
				return null
			}

			return {
				status: "pending",
				items: prompts.map((prompt, index) => ({
					index: index + 1,
					prompt,
					status: "pending",
					toolCalls: 0,
					inputTokens: 0,
					outputTokens: 0,
					totalCost: 0,
					contextTokens: 0,
					contextWindow: 0,
					contextUsagePercentage: 0,
				})),
			}
		}

		const parsed = JSON.parse(message.text) as ClineSaySubagentStatus
		if (!Array.isArray(parsed.items)) {
			return null
		}

		return {
			status: parsed.status,
			items: parsed.items,
		}
	} catch {
		return null
	}
}

function SubagentPromptText({ prompt, isExpanded, onShowMore }: SubagentPromptTextProps) {
	const promptRef = useRef<HTMLDivElement | null>(null)
	const [showMoreVisible, setShowMoreVisible] = useState(false)

	useEffect(() => {
		if (isExpanded) {
			setShowMoreVisible(false)
			return
		}

		const element = promptRef.current
		if (!element) {
			setShowMoreVisible(false)
			return
		}

		const checkOverflow = () => {
			setShowMoreVisible(element.scrollHeight - element.clientHeight > 1)
		}

		checkOverflow()

		if (typeof ResizeObserver === "undefined") {
			return
		}

		const observer = new ResizeObserver(() => checkOverflow())
		observer.observe(element)

		return () => observer.disconnect()
	}, [prompt, isExpanded])

	return (
		<div className="relative">
			<div
				className={`text-xs font-medium text-foreground whitespace-pre-wrap break-words leading-relaxed ${!isExpanded ? "overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]" : ""}`}
				ref={promptRef}>
				"{prompt}"
			</div>
			{!isExpanded && showMoreVisible && (
				<button
					aria-label="Show full subagent prompt"
					className="absolute right-0 bottom-0 z-10 text-[11px] text-link border-0 px-1 py-[1px] cursor-pointer leading-none rounded-[2px]"
					onClick={onShowMore}
					style={{ backgroundColor: "var(--vscode-editor-background)" }}
					type="button">
					<span
						aria-hidden="true"
						className="pointer-events-none absolute inset-y-0 -left-[6px] w-[6px]"
						style={{ background: "linear-gradient(to left, var(--vscode-editor-background), transparent)" }}
					/>
					Show more
				</button>
			)}
		</div>
	)
}

export default function SubagentStatusRow({ message, isLast, lastModifiedMessage }: SubagentStatusRowProps) {
	const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({})
	const [expandedPrompts, setExpandedPrompts] = useState<Record<number, boolean>>({})
	const data = useMemo(() => parseSubagentRowData(message), [message])

	if (!data) {
		return <div className="text-foreground opacity-80">Subagent status update unavailable.</div>
	}

	const resumedBeforeNextVisibleMessage =
		isLast && lastModifiedMessage?.say === "api_req_started" && (lastModifiedMessage.ts ?? 0) > message.ts

	const wasCancelled =
		data.status === "running" &&
		(!isLast ||
			lastModifiedMessage?.ask === "resume_task" ||
			lastModifiedMessage?.ask === "resume_completed_task" ||
			resumedBeforeNextVisibleMessage)

	const singular = data.items.length === 1
	const title = singular ? "Subagent Task" : "Subagent Pipeline"
	const isPromptConstructionRow = message.ask === "use_subagents" || message.say === "use_subagents"

	const toggleItem = (index: number) => {
		setExpandedItems((prev) => ({
			...prev,
			[index]: !prev[index],
		}))
	}

	const expandPrompt = (index: number) => {
		setExpandedPrompts((prev) => ({
			...prev,
			[index]: true,
		}))
	}

	return (
		<div className="mb-3 rounded-md border border-editor-group-border/60 p-2.5" style={{ backgroundColor: "var(--vscode-editor-background)" }}>
			{/* Timeline Header */}
			<div className="flex items-center gap-2 mb-3 pb-2 border-b border-editor-group-border/40">
				<NetworkIcon className="w-3.5 h-3.5 text-foreground opacity-80" />
				<span className="font-semibold text-xs text-foreground">{title}</span>
				<span
					className="ml-auto text-[10.5px] px-1.5 py-0.5 rounded-full font-mono"
					style={{
						backgroundColor: "var(--vscode-badge-background, rgba(255,255,255,0.08))",
						color: "var(--vscode-badge-foreground, inherit)",
					}}>
					{data.items.length} {data.items.length === 1 ? "step" : "steps"}
				</span>
			</div>

			{/* Connected Tree Timeline */}
			<div className="w-full">
				{data.items.map((entry, index) => {
					const displayStatus: DisplayStatus =
						wasCancelled && (entry.status === "running" || entry.status === "pending") ? "cancelled" : entry.status
					const hasDetails = Boolean(
						(entry.result && entry.status === "completed") || (entry.error && entry.status === "failed"),
					)
					const isExpanded = expandedItems[entry.index] === true
					const isStreamingPromptUnderConstruction =
						isPromptConstructionRow && message.partial === true && index === data.items.length - 1
					const shouldShowStats = !isStreamingPromptUnderConstruction
					const statsText = `${formatCount(entry.toolCalls)} tools · ${formatCount(entry.contextTokens)} tokens · ${formatCost(entry.totalCost)}`
					const latestToolCallText = entry.latestToolCall?.trim() || ""
					const isLastItem = index === data.items.length - 1
					const dotStyle = getDotStyle(displayStatus)

					return (
						<div className="grid grid-cols-[16px_1fr] items-start gap-x-2.5 relative" key={entry.index}>
							{/* Left: Dot & Connector Spine */}
							<div className="flex flex-col items-center h-full">
								<div
									className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 mt-0.5 box-border transition-colors duration-200"
									style={dotStyle}>
									{renderDotIcon(displayStatus)}
								</div>
								{!isLastItem && (
									<div
										className="w-[1.5px] grow my-1 rounded-full"
										style={{
											backgroundColor:
												entry.status === "completed"
													? "var(--vscode-tree-indentGuidesStroke, rgba(255, 255, 255, 0.22))"
													: "var(--vscode-tree-inactiveIndentGuidesStroke, rgba(255, 255, 255, 0.08))",
											minHeight: "14px",
										}}
									/>
								)}
							</div>

							{/* Right: Content Node */}
							<div className={cn("min-w-0", !isLastItem ? "pb-3.5" : "pb-0.5")}>
								<SubagentPromptText
									isExpanded={expandedPrompts[entry.index] === true}
									onShowMore={() => expandPrompt(entry.index)}
									prompt={entry.prompt}
								/>

								{/* Tool Execution Badge */}
								{shouldShowStats && latestToolCallText && (
									<div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
										<span
											className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border"
											style={{
												backgroundColor: "var(--vscode-editor-inactiveSelectionBackground, rgba(255,255,255,0.05))",
												borderColor: "var(--vscode-editorGroup-border, rgba(255,255,255,0.1))",
												color: "var(--vscode-textPreformat-foreground, inherit)",
											}}>
											<span className="opacity-60 text-[9px] font-sans font-semibold uppercase tracking-wider">TOOL</span>
											<span className="truncate max-w-[220px]">{latestToolCallText}</span>
										</span>
									</div>
								)}

								{/* Metrics and Detail Toggle */}
								{shouldShowStats && (
									<div className="mt-1 flex items-center justify-between gap-2 text-[11px] opacity-70">
										<span className="truncate">{statsText}</span>
										{hasDetails && (
											<button
												aria-label={isExpanded ? "Hide subagent output" : "Show subagent output"}
												className="flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer text-link hover:underline shrink-0 text-[11px]"
												onClick={() => toggleItem(entry.index)}
												type="button">
												<span>{isExpanded ? "Hide output" : "Show output"}</span>
												{isExpanded ? (
													<ChevronDownIcon className="w-3 h-3 shrink-0" />
												) : (
													<ChevronRightIcon className="w-3 h-3 shrink-0" />
												)}
											</button>
										)}
									</div>
								)}

								{/* Collapsible Result / Error Card */}
								{isExpanded && entry.result && entry.status === "completed" && (
									<div
										className="mt-2 text-xs rounded border p-2 wrap-anywhere overflow-hidden"
										style={{
											backgroundColor: "var(--vscode-editor-background)",
											borderColor: "var(--vscode-editorGroup-border, rgba(255,255,255,0.1))",
										}}>
										<MarkdownBlock markdown={entry.result} />
									</div>
								)}
								{isExpanded && entry.error && entry.status === "failed" && (
									<div
										className="mt-2 text-xs rounded border border-error/40 p-2 text-error whitespace-pre-wrap break-words"
										style={{ backgroundColor: "rgba(241, 76, 76, 0.08)" }}>
										{entry.error}
									</div>
								)}
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}
