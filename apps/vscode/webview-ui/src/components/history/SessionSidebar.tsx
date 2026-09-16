import { EmptyRequest, StringRequest } from "@shared/proto/cline/common"
import { MessageSquarePlusIcon, PlusIcon, SearchIcon } from "lucide-react"
import { memo, useCallback, useMemo, useState } from "react"
import { PLATFORM_CONFIG } from "@/config/platform.config"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { cn } from "@/lib/utils"
import { TaskServiceClient } from "@/services/grpc-client"

const SessionSidebar = () => {
	const { taskHistory, currentTaskItem } = useExtensionState()
	const [searchQuery, setSearchQuery] = useState("")

	const handleNewSession = useCallback(() => {
		TaskServiceClient.clearTask(EmptyRequest.create({})).catch((err: unknown) =>
			console.error("Failed to clear task:", err),
		)
		PLATFORM_CONFIG.postMessage({ type: "openInEditor", taskTitle: "New Session" })
	}, [])

	const handleSelectSession = useCallback((id: string, taskTitle: string) => {
		TaskServiceClient.showTaskWithId(StringRequest.create({ value: id })).catch((err: unknown) =>
			console.error("Error showing task:", err),
		)
		PLATFORM_CONFIG.postMessage({ type: "openInEditor", taskTitle })
	}, [])

	const formatDate = useCallback((ts: number) => {
		const date = new Date(ts)
		const now = new Date()
		const isToday = date.toDateString() === now.toDateString()
		if (isToday) {
			return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
		}
		const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)
		if (diffDays < 7) {
			return date.toLocaleDateString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", hour12: true })
		}
		return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
	}, [])

	const filteredTasks = useMemo(() => {
		if (!taskHistory) return []
		if (!searchQuery.trim()) return taskHistory
		const q = searchQuery.toLowerCase()
		return taskHistory.filter((item) => item.task?.toLowerCase().includes(q))
	}, [taskHistory, searchQuery])

	return (
		<div className="flex flex-col h-full w-full bg-[var(--vscode-sideBar-background)] text-[var(--vscode-foreground)] overflow-hidden select-none">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--vscode-panel-border,var(--vscode-editorGroup-border))]">
				<div className="flex items-center gap-1.5">
					<span className="text-xs font-semibold uppercase tracking-wider text-[var(--vscode-sideBarSectionHeader-foreground,var(--vscode-foreground))] opacity-80">
						Sessions
					</span>
					{taskHistory && taskHistory.length > 0 && (
						<span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] font-medium">
							{taskHistory.length}
						</span>
					)}
				</div>
				<button
					aria-label="New session"
					className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] text-[var(--vscode-button-foreground)] transition-colors font-medium shadow-sm"
					onClick={handleNewSession}
					title="Start new session in editor tab">
					<PlusIcon size={13} />
					<span>New</span>
				</button>
			</div>

			{/* Search */}
			{taskHistory && taskHistory.length > 4 && (
				<div className="p-2 border-b border-[var(--vscode-panel-border,var(--vscode-editorGroup-border))]">
					<div className="relative flex items-center">
						<SearchIcon className="absolute left-2 text-[var(--vscode-input-placeholderForeground)]" size={12} />
						<input
							className="w-full pl-6 pr-2 py-1 text-xs rounded bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] placeholder-[var(--vscode-input-placeholderForeground)] border border-[var(--vscode-input-border)] focus:outline-none focus:border-[var(--vscode-focusBorder)]"
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search sessions..."
							type="text"
							value={searchQuery}
						/>
					</div>
				</div>
			)}

			{/* Session list */}
			<div className="flex-1 overflow-y-auto overflow-x-hidden p-1.5 space-y-1">
				{filteredTasks.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-48 text-center px-4">
						<MessageSquarePlusIcon className="text-[var(--vscode-descriptionForeground)] opacity-40 mb-2" size={28} />
						<p className="text-xs text-[var(--vscode-descriptionForeground)] opacity-70">
							{searchQuery ? "No matching sessions" : "No sessions yet"}
						</p>
						<button
							className="mt-3 text-xs text-[var(--vscode-textLink-foreground)] hover:underline"
							onClick={handleNewSession}>
							Start a new chat
						</button>
					</div>
				) : (
					filteredTasks.map((item) => {
						const isActive = currentTaskItem?.id === item.id
						return (
							<button
								className={cn(
									"w-full text-left p-2.5 rounded-md flex flex-col gap-1 cursor-pointer transition-all border",
									isActive
										? "bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)] border-transparent shadow-sm"
										: "bg-[var(--vscode-editor-background)] hover:bg-[var(--vscode-list-hoverBackground)] border-[var(--vscode-widget-border,transparent)] text-[var(--vscode-foreground)]",
								)}
								key={item.id}
								onClick={() => handleSelectSession(item.id, item.task || "Session")}>
								<div className="flex items-start justify-between gap-2">
									<span
										className={cn(
											"text-xs font-medium leading-snug line-clamp-2 break-words flex-1",
											isActive
												? "text-[var(--vscode-list-activeSelectionForeground)]"
												: "text-[var(--vscode-foreground)]",
										)}>
										{item.task || "Untitled Session"}
									</span>
									{item.isFavorited && (
										<span className="text-yellow-400 text-xs shrink-0">★</span>
									)}
								</div>
								<div className="flex items-center justify-between text-[10px] mt-0.5 opacity-70">
									<span
										className={cn(
											isActive
												? "text-[var(--vscode-list-activeSelectionForeground)]"
												: "text-[var(--vscode-descriptionForeground)]",
										)}>
										{formatDate(item.ts)}
									</span>
									{item.totalCost != null && item.totalCost > 0 && (
										<span className="px-1 py-0.2 rounded bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] font-mono text-[9px]">
											${item.totalCost.toFixed(2)}
										</span>
									)}
								</div>
							</button>
						)
					})
				)}
			</div>
		</div>
	)
}

export default memo(SessionSidebar)
