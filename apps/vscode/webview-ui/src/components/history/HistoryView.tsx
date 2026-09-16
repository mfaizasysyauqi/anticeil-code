import { EmptyRequest, StringArrayRequest } from "@shared/proto/cline/common"
import { GetTaskHistoryRequest, TaskFavoriteRequest, type TaskItem } from "@shared/proto/cline/task"
import { HistoryItem } from "@shared/HistoryItem"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import Fuse, { FuseResult } from "fuse.js"
import { ChevronDownIcon, ChevronRightIcon, FunnelIcon, ListChecksIcon, PlusIcon } from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { PLATFORM_CONFIG } from "@/config/platform.config"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { cn } from "@/lib/utils"
import { TaskServiceClient } from "@/services/grpc-client"
import { formatSize } from "@/utils/format"
import ViewHeader from "../common/ViewHeader"
import HistoryViewItem from "./HistoryViewItem"
import SessionGroupRow from "./SessionGroupRow"
import { useSessionGroups } from "./useSessionGroups"

type HistoryViewProps = {
	onDone?: () => void
}

type SortOption = "newest" | "oldest" | "mostExpensive" | "mostTokens" | "mostRelevant"


const HISTORY_FILTERS = {
	newest: "Newest",
	oldest: "Oldest",
	mostExpensive: "Most Expensive",
	mostTokens: "Most Tokens",
	mostRelevant: "Most Relevant",
	workspaceOnly: "Workspace Only",
	favoritesOnly: "Favorites Only",
}

const HISTORY_PAGE_SIZE = 50

const HistoryView = ({ onDone }: HistoryViewProps) => {
	const extensionStateContext = useExtensionState()
	const { taskHistory, onRelinquishControl, environment } = extensionStateContext
	const [searchQuery, setSearchQuery] = useState("")
	const [sortOption, setSortOption] = useState<SortOption>("newest")
	const [lastNonRelevantSort, setLastNonRelevantSort] = useState<SortOption | null>("newest")
	const [deleteAllDisabled, setDeleteAllDisabled] = useState(false)
	const [selectedItems, setSelectedItems] = useState<string[]>([])
	const [selectedGroups, setSelectedGroups] = useState<string[]>([])
	const [isSelectMode, setIsSelectMode] = useState(false)
	const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
	const [showCurrentWorkspaceOnly, setShowCurrentWorkspaceOnly] = useState(false)

	// Groups + DnD
	const {
		groups,
		groupedSessionIds,
		customTitles,
		createGroup,
		deleteGroup,
		renameGroup,
		renameSession,
		toggleGroupCollapsed,
		addToGroup,
		removeFromGroup,
	} = useSessionGroups()
	const [draggingId, setDraggingId] = useState<string | null>(null)

	// Section collapse state
	const [groupsSectionCollapsed, setGroupsSectionCollapsed] = useState(false)
	const [sessionsSectionCollapsed, setSessionsSectionCollapsed] = useState(false)

	// Pagination for ungrouped sessions
	const PAGE_SIZE = 5
	const [sessionsVisible, setSessionsVisible] = useState(PAGE_SIZE)

	// Pagination for groups list
	const [groupsVisible, setGroupsVisible] = useState(PAGE_SIZE)

	// Keep track of pending favorite toggle operations
	const [pendingFavoriteToggles, setPendingFavoriteToggles] = useState<Record<string, boolean>>({})

	// Load filtered task history with gRPC
	const [tasks, setTasks] = useState<TaskItem[]>([])
	const [hasMoreTasks, setHasMoreTasks] = useState(false)
	const [nextHistoryOffset, setNextHistoryOffset] = useState(0)
	const [isLoadingHistory, setIsLoadingHistory] = useState(false)
	const isLoadingHistoryRef = useRef(false)
	const historyRequestIdRef = useRef(0)
	const hasRequestedTotalTasksSizeRef = useRef(false)

	// Load and refresh task history
	const loadTaskHistory = useCallback(
		async (offset = 0) => {
			if (offset > 0 && isLoadingHistoryRef.current) {
				return
			}

			const requestId = ++historyRequestIdRef.current
			isLoadingHistoryRef.current = true
			setIsLoadingHistory(true)
			try {
				const startedAt = performance.now()
				const response = await TaskServiceClient.getTaskHistory(
					GetTaskHistoryRequest.create({
						favoritesOnly: showFavoritesOnly,
						searchQuery: searchQuery || undefined,
						sortBy: sortOption,
						currentWorkspaceOnly: showCurrentWorkspaceOnly,
						limit: HISTORY_PAGE_SIZE,
						offset,
					}),
				)
				console.log(
					`[HistoryPerf] getTaskHistory offset=${offset} tasks=${response.tasks?.length ?? 0} hasMore=${response.hasMore} took ${Math.round(performance.now() - startedAt)}ms`,
				)
				if (requestId !== historyRequestIdRef.current) {
					return
				}
				const pageTasks = response.tasks || []
				setTasks((currentTasks) => {
					if (offset === 0) {
						return pageTasks
					}

					const mergedTasks = new Map(currentTasks.map((task) => [task.id, task]))
					for (const task of pageTasks) {
						mergedTasks.set(task.id, task)
					}
					return Array.from(mergedTasks.values())
				})
				setHasMoreTasks(response.hasMore)
				setNextHistoryOffset(offset + HISTORY_PAGE_SIZE)
			} catch (error) {
				console.error("Error loading task history:", error)
			} finally {
				if (requestId === historyRequestIdRef.current) {
					isLoadingHistoryRef.current = false
					setIsLoadingHistory(false)
				}
			}
		},
		[showFavoritesOnly, showCurrentWorkspaceOnly, searchQuery, sortOption],
	)

	const loadMoreTaskHistory = useCallback(() => {
		if (!hasMoreTasks || isLoadingHistory) {
			return
		}
		loadTaskHistory(nextHistoryOffset)
	}, [hasMoreTasks, isLoadingHistory, loadTaskHistory, nextHistoryOffset])

	// Load when filters change
	useEffect(() => {
		setTasks([])
		setHasMoreTasks(false)
		setNextHistoryOffset(0)
		loadTaskHistory(0)
	}, [loadTaskHistory, showFavoritesOnly, showCurrentWorkspaceOnly])

	const toggleFavorite = useCallback(
		async (taskId: string, currentValue: boolean) => {
			const nextValue = !currentValue

			// Optimistic UI update
			setPendingFavoriteToggles((prev) => ({ ...prev, [taskId]: nextValue }))

			try {
				await TaskServiceClient.toggleTaskFavorite(
					TaskFavoriteRequest.create({
						taskId,
						isFavorited: nextValue,
					}),
				)

				setTasks((currentTasks) =>
					currentTasks.map((task) => (task.id === taskId ? { ...task, isFavorited: nextValue } : task)),
				)

				// Refresh if either filter is active to ensure proper combined filtering
				if (showFavoritesOnly || showCurrentWorkspaceOnly) {
					await loadTaskHistory(0)
				}
			} catch (err) {
				console.error(`[FAVORITE_TOGGLE_UI] Error for task ${taskId}:`, err)
				// Revert optimistic update
				setPendingFavoriteToggles((prev) => {
					const updated = { ...prev }
					delete updated[taskId]
					return updated
				})
			} finally {
				// Clean up pending state after 1 second
				setTimeout(() => {
					setPendingFavoriteToggles((prev) => {
						const updated = { ...prev }
						delete updated[taskId]
						return updated
					})
				}, 1000)
			}
		},
		[showFavoritesOnly, showCurrentWorkspaceOnly, loadTaskHistory],
	)

	// Use the onRelinquishControl hook instead of message event
	useEffect(() => {
		return onRelinquishControl(() => {
			setDeleteAllDisabled(false)
		})
	}, [onRelinquishControl])

	const { totalTasksSize, setTotalTasksSize } = extensionStateContext

	const fetchTotalTasksSize = useCallback(async () => {
		try {
			const startedAt = performance.now()
			const response = await TaskServiceClient.getTotalTasksSize(EmptyRequest.create({}))
			console.log(`[HistoryPerf] getTotalTasksSize took ${Math.round(performance.now() - startedAt)}ms`)
			if (response && typeof response.value === "number") {
				setTotalTasksSize?.(response.value || 0)
			}
		} catch (error) {
			console.error("Error getting total tasks size:", error)
		}
	}, [setTotalTasksSize])

	// Defer the expensive recursive task/checkpoint size scan until after the first
	// history page loads, so it does not compete with the initial history request.
	useEffect(() => {
		if (hasRequestedTotalTasksSizeRef.current || isLoadingHistory || nextHistoryOffset === 0 || totalTasksSize !== null) {
			return
		}

		hasRequestedTotalTasksSizeRef.current = true
		const timeout = window.setTimeout(() => {
			void fetchTotalTasksSize()
		}, 750)
		return () => window.clearTimeout(timeout)
	}, [fetchTotalTasksSize, isLoadingHistory, nextHistoryOffset, totalTasksSize])

	useEffect(() => {
		if (searchQuery && sortOption !== "mostRelevant" && !lastNonRelevantSort) {
			setLastNonRelevantSort(sortOption)
			setSortOption("mostRelevant")
		} else if (!searchQuery && sortOption === "mostRelevant" && lastNonRelevantSort) {
			setSortOption(lastNonRelevantSort)
			setLastNonRelevantSort(null)
		}
	}, [searchQuery, sortOption, lastNonRelevantSort])

	const handleHistorySelect = useCallback((itemId: string, checked: boolean) => {
		setSelectedItems((prev) => {
			if (checked) {
				return [...prev, itemId]
			}
			return prev.filter((id) => id !== itemId)
		})
	}, [])

	const handleGroupSelect = useCallback(
		(groupId: string, checked: boolean) => {
			const targetGroup = groups.find((g) => g.id === groupId)
			const sessionIds = targetGroup?.sessionIds || []

			setSelectedGroups((prev) => {
				if (checked) {
					return prev.includes(groupId) ? prev : [...prev, groupId]
				}
				return prev.filter((id) => id !== groupId)
			})

			if (sessionIds.length > 0) {
				setSelectedItems((prev) => {
					if (checked) {
						const toAdd = sessionIds.filter((id) => !prev.includes(id))
						return [...prev, ...toAdd]
					}
					return prev.filter((id) => !sessionIds.includes(id))
				})
			}
		},
		[groups],
	)

	const handleDeleteHistoryItem = useCallback(
		(id: string) => {
			TaskServiceClient.deleteTasksWithIds(StringArrayRequest.create({ value: [id] }))
				.then(async () => {
					await loadTaskHistory(0)
					await fetchTotalTasksSize()
				})
				.catch((error) => console.error("Error deleting task:", error))
		},
		[fetchTotalTasksSize, loadTaskHistory],
	)

	const handleDeleteSelectedHistoryItems = useCallback(
		(ids: string[]) => {
			if (ids.length > 0) {
				TaskServiceClient.deleteTasksWithIds(StringArrayRequest.create({ value: ids }))
					.then(async () => {
						await loadTaskHistory(0)
						setSelectedItems([])
						await fetchTotalTasksSize()
					})
					.catch((error) => console.error("Error deleting tasks:", error))
			}
		},
		[fetchTotalTasksSize, loadTaskHistory],
	)

	const handleDeleteSelected = useCallback(() => {
		if (selectedItems.length > 0) {
			handleDeleteSelectedHistoryItems(selectedItems)
		}
		if (selectedGroups.length > 0) {
			selectedGroups.forEach((groupId) => deleteGroup(groupId))
			setSelectedGroups([])
		}
	}, [selectedItems, selectedGroups, handleDeleteSelectedHistoryItems, deleteGroup])

	const handleDeleteAllHistory = useCallback(() => {
		setDeleteAllDisabled(true)
		TaskServiceClient.deleteAllTaskHistory(EmptyRequest.create({}))
			.then(async () => {
				await loadTaskHistory(0)
				setSelectedItems([])
				await fetchTotalTasksSize()
			})
			.catch((error) => console.error("Error deleting task history:", error))
			.finally(() => setDeleteAllDisabled(false))
	}, [fetchTotalTasksSize, loadTaskHistory])

	const tasksWithCustomTitles = useMemo(() => {
		return tasks.map((t) => (customTitles[t.id] ? { ...t, task: customTitles[t.id] } : t))
	}, [tasks, customTitles])

	const fuse = useMemo(() => {
		return new Fuse(tasksWithCustomTitles, {
			keys: ["task"],
			threshold: 0.6,
			shouldSort: true,
			isCaseSensitive: false,
			// Match anywhere in the task text. With location-based scoring, a
			// match more than ~60 characters into the title scores above the
			// threshold and the task silently vanishes from search results
			// (e.g. searching "aqueducts" in "Write a detailed 800-word essay
			// about the history of the Roman aqueducts...").
			ignoreLocation: true,
			includeMatches: true,
			minMatchCharLength: 1,
		})
	}, [tasksWithCustomTitles])

	const taskHistorySearchResults = useMemo(() => {
		const results = searchQuery
			? fuse
					.search(searchQuery)
					?.filter(({ matches }) => matches && matches.length)
					.map(({ item }) => item)
			: [...tasksWithCustomTitles]

		results.sort((a, b) => {
			switch (sortOption) {
				case "oldest":
					return a.ts - b.ts
				case "mostExpensive":
					return (b.totalCost || 0) - (a.totalCost || 0)
				case "mostTokens":
					return (
						(b.tokensIn || 0) +
						(b.tokensOut || 0) +
						(b.cacheWrites || 0) +
						(b.cacheReads || 0) -
						((a.tokensIn || 0) + (a.tokensOut || 0) + (a.cacheWrites || 0) + (a.cacheReads || 0))
					)
				case "mostRelevant":
					// NOTE: you must never sort directly on object since it will cause members to be reordered
					return searchQuery ? 0 : b.ts - a.ts // Keep fuse order if searching, otherwise sort by newest
				case "newest":
				default:
					return b.ts - a.ts
			}
		})

		return results
	}, [tasks, searchQuery, fuse, sortOption])


	// Calculate total size of selected items
	const selectedItemsSize = useMemo(() => {
		if (selectedItems.length === 0) {
			return 0
		}

		return tasks.filter((item) => selectedItems.includes(item.id)).reduce((total, item) => total + (item.size || 0), 0)
	}, [selectedItems, tasks])

	const handleBatchHistorySelect = useCallback(
		(selectAll: boolean) => {
			if (selectAll) {
				setSelectedItems(taskHistorySearchResults.map((item) => item.id))
				setSelectedGroups(groups.map((g) => g.id))
			} else {
				setSelectedItems([])
				setSelectedGroups([])
			}
		},
		[taskHistorySearchResults, groups],
	)

	const isSidebar = typeof window !== "undefined" && window.__VIEW_MODE__ === "sidebar"

	const handleNewSession = useCallback(() => {
		TaskServiceClient.clearTask(EmptyRequest.create({})).catch((err: unknown) =>
			console.error("Failed to clear task:", err),
		)
		PLATFORM_CONFIG.postMessage({ type: "openInEditor", taskTitle: "New Session", forceNew: true })
	}, [])

	// Ungrouped sessions = all filtered tasks minus those already in a group
	const ungroupedTasks = useMemo(
		() => taskHistorySearchResults.filter((t) => !groupedSessionIds.includes(t.id)),
		[taskHistorySearchResults, groupedSessionIds],
	)

	const visibleUngrouped = ungroupedTasks.slice(0, sessionsVisible)
	const hasMoreUngrouped = ungroupedTasks.length > sessionsVisible

	const visibleGroups = groups.slice(0, groupsVisible)
	const hasMoreGroups = groups.length > groupsVisible

	// Drop on ungrouped area = remove from group
	const handleDropOnSessions = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			if (draggingId) removeFromGroup(draggingId)
		},
		[draggingId, removeFromGroup],
	)

	return (
		<div className="relative overflow-hidden h-full flex flex-col w-full">
			{/* HEADER */}
			<ViewHeader
				environment={environment}
				onDone={onDone}
				title={isSidebar ? "Sessions" : "History"}
			/>

			{/* FILTERS */}
			<div className="flex flex-col gap-3 px-3">
				{/* REPLACE VSCODE RADIO GROUP */}
				<div className="flex justify-between items-center">
					{/* SEARCH BOX */}
					<VSCodeTextField
						className="w-full"
						onInput={(e) => {
							const newValue = (e.target as HTMLInputElement)?.value
							setSearchQuery(newValue)
							if (newValue && !searchQuery && sortOption !== "mostRelevant") {
								setLastNonRelevantSort(sortOption)
								setSortOption("mostRelevant")
							}
						}}
						placeholder="Fuzzy search history..."
						value={searchQuery}>
						<div className="codicon codicon-search opacity-80 mt-0.5 !text-sm" slot="start" />
						{searchQuery && (
							<div
								aria-label="Clear search"
								className="input-icon-button codicon codicon-close flex justify-center items-center h-full"
								onClick={() => setSearchQuery("")}
								slot="end"
							/>
						)}
					</VSCodeTextField>
					<Select
						onValueChange={(value) => {
							// Handle sort options
							if (
								value === "newest" ||
								value === "oldest" ||
								value === "mostExpensive" ||
								value === "mostTokens" ||
								value === "mostRelevant"
							) {
								if (value === "mostRelevant" && !searchQuery) {
									// Don't allow selecting mostRelevant without a search query
									return
								}
								setSortOption(value as SortOption)
								if (value !== "mostRelevant") {
									setLastNonRelevantSort(value as SortOption)
								}
							}
							// Handle filter toggles
							else if (value === "workspaceOnly") {
								setShowCurrentWorkspaceOnly(!showCurrentWorkspaceOnly)
							} else if (value === "favoritesOnly") {
								setShowFavoritesOnly(!showFavoritesOnly)
							}
						}}
						value={sortOption}>
						<SelectTrigger className="border-0 cursor-pointer" showIcon={false}>
							<FunnelIcon className="!size-2 text-foreground" />
						</SelectTrigger>
						<SelectContent position="popper">
							{Object.entries(HISTORY_FILTERS).map(([key, value]) => {
								const isSortOption = ["newest", "oldest", "mostExpensive", "mostTokens", "mostRelevant"].includes(
									key,
								)
								const isFilterOption = ["workspaceOnly", "favoritesOnly"].includes(key)
								const isSelected = isSortOption
									? sortOption === key
									: key === "workspaceOnly"
										? showCurrentWorkspaceOnly
										: key === "favoritesOnly"
											? showFavoritesOnly
											: false
								const isDisabled = key === "mostRelevant" && !searchQuery

								return (
									<SelectItem
										className={isSelected ? "bg-button-background/30" : ""}
										disabled={isDisabled}
										key={key}
										value={key}>
										<span className="flex items-center gap-2">
											{isFilterOption && (
												<span
													className={`codicon ${
														key === "workspaceOnly" ? "codicon-folder" : "codicon-star-full"
													} ${isSelected ? "text-button-background" : ""}`}
												/>
											)}
											{value}
										</span>
									</SelectItem>
								)
							})}
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* ACTIONS BAR */}
			<div className="flex justify-between items-center px-3 pt-2 pb-0.5">
				<div className="flex items-center gap-2">
					<button
						className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded bg-button-background text-button-foreground hover:brightness-110 transition-all cursor-pointer border border-transparent"
						onClick={handleNewSession}
						type="button">
						<PlusIcon className="stroke-[2.5]" size={13} />
						<span>New session</span>
					</button>
					<button
						className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer border border-border-panel/40"
						onClick={() => createGroup(`Group ${groups.length + 1}`)}
						type="button">
						<PlusIcon className="stroke-[2.5]" size={13} />
						<span>New group</span>
					</button>
				</div>

				<Button
					aria-label={isSelectMode ? "Exit selection mode" : "Select sessions"}
					className={cn("h-7 w-7 p-0", isSelectMode && "bg-button-background/20 text-button-background")}
					onClick={() => {
						setIsSelectMode(!isSelectMode)
						if (isSelectMode) {
							setSelectedItems([])
							setSelectedGroups([])
						}
					}}
					size="icon"
					variant="ghost">
					<ListChecksIcon size={16} />
				</Button>
			</div>

			{/* MAIN LIST */}
			<div className="flex-grow overflow-y-auto w-full py-1 px-2">

				{/* ── GROUPS SECTION ── */}
				<div className="mb-2">
					{/* Section header */}
					<button
						className="flex items-center gap-1.5 w-full px-1 py-1 text-xs font-semibold uppercase tracking-wider text-description hover:text-foreground transition-colors cursor-pointer"
						onClick={() => setGroupsSectionCollapsed((c) => !c)}
						type="button">
						{groupsSectionCollapsed ? (
							<ChevronRightIcon size={12} />
						) : (
							<ChevronDownIcon size={12} />
						)}
						<span>Groups</span>
						<span className="ml-auto font-normal normal-case tracking-normal">{groups.length}</span>
					</button>

					{!groupsSectionCollapsed && (
						<>
							{groups.length === 0 ? (
								<div className="px-2 py-2 text-xs text-description italic">
									No groups yet — click "New group" to create one
								</div>
							) : (
								<>
									{visibleGroups.map((group) => (
										<SessionGroupRow
											allTasks={tasksWithCustomTitles}
											draggingId={draggingId}
											group={group}
											handleDeleteHistoryItem={handleDeleteHistoryItem}
											handleGroupSelect={handleGroupSelect}
											handleHistorySelect={handleHistorySelect}
											isSelectMode={isSelectMode}
											key={group.id}
											onDelete={deleteGroup}
											onDragEnd={() => setDraggingId(null)}
											onDragStart={setDraggingId}
											onDrop={addToGroup}
											onRename={renameGroup}
											onRenameSession={renameSession}
											onToggleCollapsed={toggleGroupCollapsed}
											pendingFavoriteToggles={pendingFavoriteToggles}
											selectedGroups={selectedGroups}
											selectedItems={selectedItems}
											toggleFavorite={toggleFavorite}
										/>
									))}
									{hasMoreGroups && (
										<button
											className="w-full text-xs text-description hover:text-foreground transition-colors py-1.5 text-center cursor-pointer"
											onClick={() => setGroupsVisible((c) => c + PAGE_SIZE)}
											type="button">
											Load {Math.min(PAGE_SIZE, groups.length - groupsVisible)} more groups
										</button>
									)}
								</>
							)}
						</>
					)}
				</div>

				{/* ── SESSIONS SECTION ── */}
				<div
					onDragOver={(e) => { if (draggingId) e.preventDefault() }}
					onDrop={handleDropOnSessions}>
					{/* Section header */}
					<button
						className="flex items-center gap-1.5 w-full px-1 py-1 text-xs font-semibold uppercase tracking-wider text-description hover:text-foreground transition-colors cursor-pointer"
						onClick={() => setSessionsSectionCollapsed((c) => !c)}
						type="button">
						{sessionsSectionCollapsed ? (
							<ChevronRightIcon size={12} />
						) : (
							<ChevronDownIcon size={12} />
						)}
						<span>Sessions</span>
						<span className="ml-auto font-normal normal-case tracking-normal">{ungroupedTasks.length}</span>
					</button>

					{!sessionsSectionCollapsed && (
						<>
							{isLoadingHistory && ungroupedTasks.length === 0 ? (
								<div className="px-2 py-2 text-xs text-description">Loading...</div>
							) : ungroupedTasks.length === 0 ? (
								<div className="px-2 py-2 text-xs text-description italic">No sessions yet</div>
							) : (
								<>
									{visibleUngrouped.map((item, index) => (
										<HistoryViewItem
											handleDeleteHistoryItem={handleDeleteHistoryItem}
											handleHistorySelect={handleHistorySelect}
											index={index}
											isSelectMode={isSelectMode}
											item={item as unknown as HistoryItem}
											key={item.id}
											onDragEnd={() => setDraggingId(null)}
											onDragStart={setDraggingId}
											onRename={renameSession}
											pendingFavoriteToggles={pendingFavoriteToggles}
											selectedItems={selectedItems}
											toggleFavorite={toggleFavorite}
										/>
									))}
									{hasMoreUngrouped && (
										<button
											className="w-full text-xs text-description hover:text-foreground transition-colors py-1.5 text-center cursor-pointer"
											onClick={() => setSessionsVisible((c) => c + PAGE_SIZE)}
											type="button">
											Load {Math.min(PAGE_SIZE, ungroupedTasks.length - sessionsVisible)} more
										</button>
									)}
								</>
							)}
						</>
					)}
				</div>
			</div>

			{/* FOOTER */}
			{isSelectMode && (
				<div className="p-2.5 border-t border-t-border-panel">
					<div className="flex gap-2.5 mb-2.5">
						<Button className="flex-1" onClick={() => handleBatchHistorySelect(true)} variant="secondary">
							Select All
						</Button>
						<Button className="flex-1" onClick={() => handleBatchHistorySelect(false)} variant="secondary">
							Select None
						</Button>
					</div>
					{selectedItems.length > 0 || selectedGroups.length > 0 ? (
						<Button
							aria-label="Delete selected items"
							className="w-full"
							onClick={handleDeleteSelected}
							variant="danger">
							Delete {selectedItems.length + selectedGroups.length > 1 ? selectedItems.length + selectedGroups.length : ""} Selected
							{selectedItemsSize > 0 ? ` (${formatSize(selectedItemsSize)})` : ""}
						</Button>
					) : (
						<Button
							aria-label="Delete all history"
							className="w-full"
							disabled={deleteAllDisabled || (taskHistory.length === 0 && tasks.length === 0)}
							onClick={handleDeleteAllHistory}
							variant="danger">
							Delete All History{totalTasksSize !== null ? ` (${formatSize(totalTasksSize)})` : ""}
						</Button>
					)}
				</div>
			)}
		</div>
	)
}

// https://gist.github.com/evenfrost/1ba123656ded32fb7a0cd4651efd4db0
export const highlight = (fuseSearchResult: FuseResult<any>[], highlightClassName = "history-item-highlight") => {
	const set = (obj: Record<string, any>, path: string, value: any) => {
		const pathValue = path.split(".")
		let i: number

		for (i = 0; i < pathValue.length - 1; i++) {
			obj = obj[pathValue[i]] as Record<string, any>
		}

		obj[pathValue[i]] = value
	}

	// Function to merge overlapping regions
	const mergeRegions = (regions: [number, number][]): [number, number][] => {
		if (regions.length === 0) {
			return regions
		}

		// Sort regions by start index
		regions.sort((a, b) => a[0] - b[0])

		const merged: [number, number][] = [regions[0]]

		for (let i = 1; i < regions.length; i++) {
			const last = merged[merged.length - 1]
			const current = regions[i]

			if (current[0] <= last[1] + 1) {
				// Overlapping or adjacent regions
				last[1] = Math.max(last[1], current[1])
			} else {
				merged.push(current)
			}
		}

		return merged
	}

	const generateHighlightedText = (inputText: string, regions: [number, number][] = []) => {
		if (regions.length === 0) {
			return inputText
		}

		// Sort and merge overlapping regions
		const mergedRegions = mergeRegions(regions)

		let content = ""
		let nextUnhighlightedRegionStartingIndex = 0

		mergedRegions.forEach((region) => {
			const start = region[0]
			const end = region[1]
			const lastRegionNextIndex = end + 1

			content += [
				inputText.substring(nextUnhighlightedRegionStartingIndex, start),
				`<span class="${highlightClassName}">`,
				inputText.substring(start, lastRegionNextIndex),
				"</span>",
			].join("")

			nextUnhighlightedRegionStartingIndex = lastRegionNextIndex
		})

		content += inputText.substring(nextUnhighlightedRegionStartingIndex)

		return content
	}

	return fuseSearchResult
		.filter(({ matches }) => matches && matches.length)
		.map(({ item, matches }) => {
			const highlightedItem = { ...item }

			matches?.forEach((match) => {
				if (match.key && typeof match.value === "string" && match.indices) {
					// Merge overlapping regions before generating highlighted text
					const mergedIndices = mergeRegions([...match.indices])
					set(highlightedItem, match.key, generateHighlightedText(match.value, mergedIndices))
				}
			})

			return highlightedItem
		})
}

export default memo(HistoryView)
