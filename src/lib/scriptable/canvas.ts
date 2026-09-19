type Rgba = number[];
type Stops = [number, Rgba][];

const css = (c: Rgba) => `rgba(${c[0]},${c[1]},${c[2]},${c[3]})`;

/** Canvas adapter for `paintScene` in core.js, so the preview paints the widget's own scene. */
export function canvasPainter(ctx: CanvasRenderingContext2D) {
	return {
		linear(x: number, y: number, w: number, h: number, stops: Stops) {
			const g = ctx.createLinearGradient(0, y, 0, y + h);
			for (const [t, c] of stops) g.addColorStop(t, css(c));
			ctx.fillStyle = g;
			ctx.fillRect(x, y, w, h);
		},
		radial(cx: number, cy: number, rx: number, ry: number, stops: Stops) {
			ctx.save();
			ctx.translate(cx, cy);
			ctx.scale(1, ry / rx);
			const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
			for (const [t, c] of stops) g.addColorStop(t, css(c));
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.arc(0, 0, rx, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		},
		ellipse(cx: number, cy: number, rx: number, ry: number, c: Rgba) {
			ctx.fillStyle = css(c);
			ctx.beginPath();
			ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
			ctx.fill();
		},
		poly(points: number[][], c: Rgba) {
			ctx.fillStyle = css(c);
			ctx.beginPath();
			points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
			ctx.closePath();
			ctx.fill();
		},
		line(x1: number, y1: number, x2: number, y2: number, width: number, c: Rgba) {
			ctx.strokeStyle = css(c);
			ctx.lineWidth = width;
			ctx.beginPath();
			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.stroke();
		}
	};
}
