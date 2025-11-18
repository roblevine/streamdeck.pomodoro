import { describe, it, expect, beforeEach } from 'vitest';
import { DisplayGenerator } from '../../../src/lib/display-generator';

describe('DisplayGenerator', () => {
	let generator: DisplayGenerator;

	beforeEach(() => {
		generator = new DisplayGenerator();
	});

	describe('formatTime', () => {
		it('should format 0 seconds as "0:00"', () => {
			expect(generator.formatTime(0)).toBe('0:00');
		});

		it('should format 59 seconds as "0:59"', () => {
			expect(generator.formatTime(59)).toBe('0:59');
		});

		it('should format 60 seconds as "1:00"', () => {
			expect(generator.formatTime(60)).toBe('1:00');
		});

		it('should format 119 seconds as "1:59"', () => {
			expect(generator.formatTime(119)).toBe('1:59');
		});

		it('should format 3599 seconds as "59:59"', () => {
			expect(generator.formatTime(3599)).toBe('59:59');
		});

		it('should format 3600 seconds as "60:00"', () => {
			expect(generator.formatTime(3600)).toBe('60:00');
		});

		it('should format 3661 seconds as "61:01"', () => {
			expect(generator.formatTime(3661)).toBe('61:01');
		});

		it('should format 1500 seconds as "25:00"', () => {
			expect(generator.formatTime(1500)).toBe('25:00');
		});

		it('should pad single-digit seconds with zero', () => {
			expect(generator.formatTime(305)).toBe('5:05');
		});
	});

	describe('getPhaseColor (via generateDonutSVG)', () => {
		it('should use blue color for work phase', () => {
			const svg = generator.generateDonutSVG(100, 100, true, 'work');
			expect(svg).toContain('#2196F3');
		});

		it('should use dark green color for short break phase', () => {
			const svg = generator.generateDonutSVG(100, 100, true, 'shortBreak');
			expect(svg).toContain('#2E7D32');
		});

		it('should use light green color for long break phase', () => {
			const svg = generator.generateDonutSVG(100, 100, true, 'longBreak');
			expect(svg).toContain('#8BC34A');
		});

		it('should use color override when provided', () => {
			const svg = generator.generateDonutSVG(100, 100, true, 'work', '#FF0000');
			expect(svg).toContain('#FF0000');
			expect(svg).not.toContain('#2196F3');
		});
	});

	describe('calculateArcPath (via generateDonutSVG)', () => {
		it('should return empty path when percentage is 0', () => {
			const svg = generator.generateDonutSVG(0, 100, true, 'work');
			expect(svg).not.toContain('<path');
		});

		it('should generate path when percentage is greater than 0', () => {
			const svg = generator.generateDonutSVG(50, 100, true, 'work');
			expect(svg).toContain('<path');
			expect(svg).toContain('M '); // SVG path starts with M (move to)
			expect(svg).toContain('A '); // Contains arc command
		});

		it('should handle full circle (percentage = 1.0) with two arcs', () => {
			const svg = generator.generateDonutSVG(100, 100, true, 'work');
			// Full circle is drawn as two semicircles
			const pathMatches = svg.match(/A /g);
			expect(pathMatches?.length).toBe(2); // Two arc commands
		});

		it('should handle nearly full circle (percentage = 0.999)', () => {
			const svg = generator.generateDonutSVG(999, 1000, true, 'work');
			// Should use two-arc approach for 99.9%
			const pathMatches = svg.match(/A /g);
			expect(pathMatches?.length).toBe(2);
		});

		it('should use small arc flag for percentage <= 0.5', () => {
			const svg = generator.generateDonutSVG(25, 100, true, 'work');
			expect(svg).toContain('<path');
			// Small arc (largeArcFlag = 0)
			expect(svg).toMatch(/A \d+(\.\d+)? \d+(\.\d+)? 0 0 1/);
		});

		it('should use large arc flag for percentage > 0.5', () => {
			const svg = generator.generateDonutSVG(75, 100, true, 'work');
			expect(svg).toContain('<path');
			// Large arc (largeArcFlag = 1)
			expect(svg).toMatch(/A \d+(\.\d+)? \d+(\.\d+)? 0 1 1/);
		});
	});

	describe('generateDonutSVG', () => {
		it('should generate valid SVG structure', () => {
			const svg = generator.generateDonutSVG(100, 100, true, 'work');
			expect(svg).toContain('<svg');
			expect(svg).toContain('</svg>');
			expect(svg).toContain('width="144"');
			expect(svg).toContain('height="144"');
		});

		it('should include background rectangle', () => {
			const svg = generator.generateDonutSVG(100, 100, true, 'work');
			expect(svg).toContain('<rect');
			expect(svg).toContain('fill="#1a1a1a"');
		});

		it('should include path element when remaining > 0', () => {
			const svg = generator.generateDonutSVG(50, 100, true, 'work');
			expect(svg).toContain('<path');
			expect(svg).toContain('stroke-width="16"');
			expect(svg).toContain('fill="none"');
			expect(svg).toContain('stroke-linecap="round"');
		});

		it('should not include path element when remaining = 0', () => {
			const svg = generator.generateDonutSVG(0, 100, true, 'work');
			expect(svg).not.toContain('<path');
		});
	});

	describe('generateDonutWithTextsSVG', () => {
		it('should generate valid SVG with main text', () => {
			const svg = generator.generateDonutWithTextsSVG(
				1500, 1500, true, 'work', '25:00'
			);
			expect(svg).toContain('<svg');
			expect(svg).toContain('</svg>');
			expect(svg).toContain('<text');
			expect(svg).toContain('25:00');
		});

		it('should include subText when provided', () => {
			const svg = generator.generateDonutWithTextsSVG(
				1500, 1500, true, 'work', '25:00', '1/4'
			);
			expect(svg).toContain('25:00');
			expect(svg).toContain('1/4');
			// Should have two text elements
			const textMatches = svg.match(/<text/g);
			expect(textMatches?.length).toBe(2);
		});

		it('should not include subText element when undefined', () => {
			const svg = generator.generateDonutWithTextsSVG(
				1500, 1500, true, 'work', '25:00'
			);
			expect(svg).toContain('25:00');
			// Should have only one text element
			const textMatches = svg.match(/<text/g);
			expect(textMatches?.length).toBe(1);
		});

		it('should include path element for donut ring', () => {
			const svg = generator.generateDonutWithTextsSVG(
				100, 100, true, 'work', '25:00', '1/4'
			);
			expect(svg).toContain('<path');
		});

		it('should use correct phase color', () => {
			const svg = generator.generateDonutWithTextsSVG(
				100, 100, true, 'shortBreak', '5:00'
			);
			expect(svg).toContain('#2E7D32'); // Dark green for short break
		});

		it('should respect color override', () => {
			const svg = generator.generateDonutWithTextsSVG(
				100, 100, true, 'work', '25:00', '1/4', '#FF0000'
			);
			expect(svg).toContain('#FF0000');
		});
	});

	describe('generateDashedRingSVG', () => {
		it('should generate valid SVG structure', () => {
			const svg = generator.generateDashedRingSVG(0);
			expect(svg).toContain('<svg');
			expect(svg).toContain('</svg>');
			expect(svg).toContain('width="144"');
			expect(svg).toContain('height="144"');
		});

		it('should include circle with dash pattern', () => {
			const svg = generator.generateDashedRingSVG(0);
			expect(svg).toContain('<circle');
			expect(svg).toContain('stroke-dasharray=');
		});

		it('should apply rotation transform', () => {
			const svg = generator.generateDashedRingSVG(45);
			expect(svg).toContain('transform="rotate(45,');
		});

		it('should use default white color when not specified', () => {
			const svg = generator.generateDashedRingSVG(0);
			expect(svg).toContain('stroke="#FFFFFF"');
		});

		it('should use custom color when provided', () => {
			const svg = generator.generateDashedRingSVG(0, '#FF0000');
			expect(svg).toContain('stroke="#FF0000"');
			expect(svg).not.toContain('stroke="#FFFFFF"');
		});

		it('should include background rectangle', () => {
			const svg = generator.generateDashedRingSVG(0);
			expect(svg).toContain('<rect');
			expect(svg).toContain('fill="#1a1a1a"');
		});
	});

	describe('svgToDataUrl', () => {
		it('should convert SVG to base64 data URL', () => {
			const svg = '<svg><rect/></svg>';
			const dataUrl = generator.svgToDataUrl(svg);
			expect(dataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
		});

		it('should encode SVG content correctly', () => {
			const svg = '<svg><rect/></svg>';
			const dataUrl = generator.svgToDataUrl(svg);
			const base64Part = dataUrl.replace('data:image/svg+xml;base64,', '');
			const decoded = Buffer.from(base64Part, 'base64').toString();
			expect(decoded).toBe(svg);
		});

		it('should handle complex SVG content', () => {
			const svg = generator.generateDonutSVG(1500, 1500, true, 'work');
			const dataUrl = generator.svgToDataUrl(svg);
			expect(dataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
			expect(dataUrl.length).toBeGreaterThan(100); // Should have substantial content
		});
	});
});
