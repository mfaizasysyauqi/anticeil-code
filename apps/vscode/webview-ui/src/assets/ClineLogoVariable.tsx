import { SVGProps } from "react"
import { ANTICEIL_LOGO_DATA_URI } from "./anticeilLogoDataUri"
import type { Environment } from "../../../src/shared/config-types"

const ClineLogoVariable = (props: SVGProps<SVGSVGElement> & { environment?: Environment }) => {
	const { environment, className, ...svgProps } = props

	return (
		<svg fill="none" height="64" viewBox="0 0 64 64" width="64" xmlns="http://www.w3.org/2000/svg" className={className} {...svgProps}>
			<image href={ANTICEIL_LOGO_DATA_URI} x="0" y="0" width="64" height="64" preserveAspectRatio="xMidYMid meet" />
		</svg>
	)
}
export default ClineLogoVariable
