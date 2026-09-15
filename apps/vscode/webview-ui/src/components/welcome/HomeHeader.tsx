import { EmptyRequest } from "@shared/proto/cline/common"
import { ANTICEIL_LOGO_DATA_URI } from "@/assets/anticeilLogoDataUri"
import { UiServiceClient } from "@/services/grpc-client"

interface HomeHeaderProps {
	shouldShowQuickWins?: boolean
}

const HomeHeader = ({ shouldShowQuickWins = false }: HomeHeaderProps) => {
	const handleTakeATour = async () => {
		try {
			await UiServiceClient.openWalkthrough(EmptyRequest.create())
		} catch (error) {
			console.error("Error opening walkthrough:", error)
		}
	}

	const headingText = "What can I do for you?"

	return (
		<div className="flex flex-col items-center mb-5">
			<div className="my-7 flex items-center justify-center">
				<img
					src={ANTICEIL_LOGO_DATA_URI}
					alt="Anticeil Code"
					className="size-20 object-contain drop-shadow-[0_8px_20px_rgba(99,102,241,0.25)]"
				/>
			</div>
			<div className="text-center flex items-center justify-center px-4">
				<h1 className="m-0 font-bold">{headingText}</h1>
			</div>
			{shouldShowQuickWins && (
				<div className="mt-4">
					<button
						className="flex items-center gap-2 px-4 py-2 rounded-full border border-border-panel bg-white/2 hover:bg-list-background-hover transition-colors duration-150 ease-in-out text-code-foreground text-sm font-medium cursor-pointer"
						onClick={handleTakeATour}
						type="button">
						Take a Tour
						<span className="codicon codicon-play scale-90" />
					</button>
				</div>
			)}
		</div>
	)
}

export default HomeHeader
