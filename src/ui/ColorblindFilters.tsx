/**
 * Hidden SVG color-correction filters for the colorblind accessibility modes.
 * Rendered once at the app root so `filter: url(#cb-…)` in styles.css can resolve.
 *
 * Each filter is a lightweight daltonization: instead of simulating the deficiency,
 * it takes the colour difference the user CAN'T see and re-encodes it onto an axis
 * they CAN, pulling confusable pairs apart.
 *   • cb-redgreen  — encodes the red↔green difference into the blue channel, so
 *     reds and greens (which protanopia/deuteranopia confuse) diverge in blue.
 *   • cb-blueyellow — encodes the blue↔yellow difference into the green channel,
 *     giving tritanopia a red-green separation it can perceive.
 * The matrix constants are deliberately conservative and are safe to tune after a
 * playtest — the wiring stays the same.
 *
 * "No color" (achromatopsia) uses a plain CSS grayscale() in styles.css, so it
 * needs no SVG filter here.
 */
export function ColorblindFilters() {
	return (
		<svg aria-hidden="true" focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
			<defs>
				{/* Red-green: encode the full red↔green difference into blue (B' = R − G + B).
				    In a mostly-green landscape this spreads the greens across the blue axis —
				    yellow-greens turn cyan/teal, deep greens stay green, reds go magenta — so
				    shades that were indistinguishable now differ in a channel the user sees. */}
				<filter id="cb-redgreen" colorInterpolationFilters="sRGB">
					<feColorMatrix
						type="matrix"
						values="1  0   0 0 0
						        0  1   0 0 0
						        1 -1   1 0 0
						        0  0   0 1 0"
					/>
				</filter>
				{/* Blue-yellow: encode the blue↔yellow difference into green
				    (G' = −0.35·R + 0.65·G + 0.7·B), giving tritanopia a red-green split
				    it can perceive; blues turn greener, yellows shift toward magenta. */}
				<filter id="cb-blueyellow" colorInterpolationFilters="sRGB">
					<feColorMatrix
						type="matrix"
						values="1     0    0   0 0
						        -0.35 0.65 0.7 0 0
						        0     0    1   0 0
						        0     0    0   1 0"
					/>
				</filter>

				{/* ---- world variants ----
				    These bake the correction PLUS the world's saturation and contrast boost
				    into one SVG filter (a chain of colour-matrix primitives the browser fuses),
				    so the per-frame canvas filter is a single pass instead of a CSS chain of
				    url()+saturate()+contrast()+brightness() (up to four passes). The UI/title
				    use the plain filters above (no boost). */}
				<filter id="cb-redgreen-world" colorInterpolationFilters="sRGB">
					<feColorMatrix type="saturate" values="1.5" />
					<feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  1 -1 1 0 0  0 0 0 1 0" />
					<feColorMatrix type="matrix" values="1.2 0 0 0 -0.1  0 1.2 0 0 -0.1  0 0 1.2 0 -0.1  0 0 0 1 0" />
				</filter>
				<filter id="cb-blueyellow-world" colorInterpolationFilters="sRGB">
					<feColorMatrix type="saturate" values="1.5" />
					<feColorMatrix type="matrix" values="1 0 0 0 0  -0.35 0.65 0.7 0 0  0 0 1 0 0  0 0 0 1 0" />
					<feColorMatrix type="matrix" values="1.2 0 0 0 -0.1  0 1.2 0 0 -0.1  0 0 1.2 0 -0.1  0 0 0 1 0" />
				</filter>
				<filter id="cb-mono-world" colorInterpolationFilters="sRGB">
					<feColorMatrix type="saturate" values="0" />
					<feColorMatrix type="matrix" values="1.2 0 0 0 -0.1  0 1.2 0 0 -0.1  0 0 1.2 0 -0.1  0 0 0 1 0" />
				</filter>
			</defs>
		</svg>
	);
}
