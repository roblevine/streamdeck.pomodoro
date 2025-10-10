/**
 * Generates visual displays for the timer action
 */
export class DisplayGenerator {
	private readonly size = 144; // Stream Deck button size
	private readonly center = this.size / 2;
	private readonly radius = 50;
	private readonly strokeWidth = 16;

	/**
	 * Format seconds into mm:ss string
	 */
	formatTime(seconds: number): string {
		const minutes = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${minutes}:${secs.toString().padStart(2, '0')}`;
	}

	/**
	 * Generate SVG donut circle that depletes as time runs out
	 */
	generateDonutSVG(
		remainingSeconds: number,
		totalSeconds: number,
		isRunning: boolean,
		phase: 'work' | 'shortBreak' | 'longBreak' = 'work',
		colorOverride?: string
	): string {
		const percentage = remainingSeconds / totalSeconds;
		const color = colorOverride ?? this.getPhaseColor(phase, isRunning, percentage);
		const path = this.calculateArcPath(percentage);

		return `<svg width="${this.size}" height="${this.size}" xmlns="http://www.w3.org/2000/svg">
			<rect width="${this.size}" height="${this.size}" fill="#1a1a1a"/>
			${path ? `<path d="${path}" stroke="${color}" stroke-width="${this.strokeWidth}" fill="none" stroke-linecap="round"/>` : ''}
		</svg>`;
	}

	/**
	 * Generate donut with centered mainText (time) and smaller subText (e.g., cycle like 1/4)
	 */
	generateDonutWithTextsSVG(
		remainingSeconds: number,
		totalSeconds: number,
		isRunning: boolean,
		phase: 'work' | 'shortBreak' | 'longBreak' = 'work',
		mainText: string,
		subText?: string,
		colorOverride?: string
	): string {
		const percentage = remainingSeconds / totalSeconds;
		const color = colorOverride ?? this.getPhaseColor(phase, isRunning, percentage);
		const path = this.calculateArcPath(percentage);
		const mainFontSize = 28; // time (smaller to make room)
		const subFontSize = 20;  // cycle label (bigger for readability)
		const mainY = this.center + 6; // adjust baseline
		const subY = mainY + 22;
		return `<svg width="${this.size}" height="${this.size}" xmlns="http://www.w3.org/2000/svg">
			<rect width="${this.size}" height="${this.size}" fill="#1a1a1a"/>
			${path ? `<path d="${path}" stroke="${color}" stroke-width="${this.strokeWidth}" fill="none" stroke-linecap="round"/>` : ''}
			<text x="${this.center}" y="${mainY}" text-anchor="middle" fill="#FFFFFF" font-family="Segoe UI, Arial, sans-serif" font-size="${mainFontSize}" font-weight="600">${mainText}</text>
			${subText ? `<text x="${this.center}" y="${subY}" text-anchor="middle" fill="#E5E5E5" font-family="Segoe UI, Arial, sans-serif" font-size="${subFontSize}" font-weight="700" letter-spacing="0.5px">${subText}</text>` : ''}
		</svg>`;
	}

	/**
	 * Generate a base64 data URL from SVG
	 */
	svgToDataUrl(svg: string): string {
		const base64 = Buffer.from(svg).toString('base64');
		return `data:image/svg+xml;base64,${base64}`;
	}

	/**
	 * Generate a dashed (broken) ring SVG rotated by a given angle.
	 */
	generateDashedRingSVG(angleDeg: number, color: string = '#FFFFFF'): string {
		const dashCircleR = this.radius;
		const dashWidth = this.strokeWidth;
		const dashPattern = `${Math.round(Math.PI * dashCircleR * 0.08)} ${Math.round(Math.PI * dashCircleR * 0.10)}`; // approx 8% dash 10% gap
		return `<svg width="${this.size}" height="${this.size}" xmlns="http://www.w3.org/2000/svg">
			<rect width="${this.size}" height="${this.size}" fill="#1a1a1a"/>
			<g transform="rotate(${angleDeg}, ${this.center}, ${this.center})">
				<circle cx="${this.center}" cy="${this.center}" r="${dashCircleR}" fill="none" stroke="${color}" stroke-width="${dashWidth}" stroke-linecap="round" stroke-dasharray="${dashPattern}"/>
			</g>
		</svg>`;
	}

	/**
	 * Get color based on phase and state
	 */
	private getPhaseColor(
		phase: 'work' | 'shortBreak' | 'longBreak',
		isRunning: boolean,
		percentage: number
	): string {
		// Static color scheme (no urgency shifts):
		// work: Blue, shortBreak: Dark Green, longBreak: Light Green
		const phaseColors = {
			work: "#2196F3",      // Blue
			shortBreak: "#2E7D32", // Dark Green
			longBreak: "#8BC34A"   // Light Green
		};
		return phaseColors[phase];
	}

	/**
	 * Calculate SVG arc path for donut circle
	 */
	private calculateArcPath(percentage: number): string {
		if (percentage <= 0) {
			return '';
		}

		const startAngle = -90; // Start at top (12 o'clock)
		const endAngle = startAngle + (360 * percentage);

		// Convert to radians
		const startRad = (startAngle * Math.PI) / 180;
		const endRad = (endAngle * Math.PI) / 180;

		// Calculate arc points
		const startX = this.center + this.radius * Math.cos(startRad);
		const startY = this.center + this.radius * Math.sin(startRad);
		const endX = this.center + this.radius * Math.cos(endRad);
		const endY = this.center + this.radius * Math.sin(endRad);

		if (percentage >= 0.999) {
			// Full circle - draw as two semicircles to avoid SVG arc rendering issues
			const bottomX = this.center;
			const bottomY = this.center + this.radius;
			return `M ${startX} ${startY} A ${this.radius} ${this.radius} 0 0 1 ${bottomX} ${bottomY} A ${this.radius} ${this.radius} 0 0 1 ${startX} ${startY}`;
		} else {
			const largeArcFlag = percentage > 0.5 ? 1 : 0;
			return `M ${startX} ${startY} A ${this.radius} ${this.radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
		}
	}
}
