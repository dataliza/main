import { Interaction } from "@web/public/interaction";
import { registry } from "@web/core/registry";

// ASCII plasma for the s_dz_ascii_hero snippet (S12: a very faint layer inside the black hero card).
// Decorative only: the wordmark, text and buttons live in the DOM above the canvas, nothing readable
// is ever drawn in it. Muted white/grey-green glyphs, no glow, no scanlines.

const RAMP = [".", ":", "-", "=", "+", "*", "#", "@"];
const TINT = "196, 214, 196"; // muted white / grey-green
const CELL_W = 10; // css px per glyph cell
const CELL_H = 16;
const FONT_SIZE = 13;
const FONT_FAMILY = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";
const FRAME_MS = 1000 / 30; // cap at ~30fps
const STATIC_TIME = 2.4; // time used for the single reduced-motion frame
const MIN_ALPHA = 0.03;
const MAX_ALPHA = 0.14; // very faint: the wordmark and text must stay crisp on top
const TIME_SCALE = 0.45; // slow drift

export class AsciiHero extends Interaction {
    static selector = ".s_dz_ascii_hero";

    setup() {
        // The plasma fills the black card (not the whole section, which has the grey page around it).
        this.host = this.el.querySelector(".s_dz_ascii_hero__card") || this.el;
        this.canvas = this.el.querySelector(".s_dz_ascii_hero__canvas");
        this.ctx = null;
        this.rafId = 0;
        this.visible = true;
        this.running = false;
        this.lastFrame = 0;
        this.cols = 0;
        this.rows = 0;
        this.levels = null;
        this.dpr = 1;
        this.resizeRaf = 0;

        this.reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        this.onFrame = this.onFrame.bind(this);
        this.onResize = this.onResize.bind(this);
        this.onMotionPreferenceChange = this.onMotionPreferenceChange.bind(this);
        this.onVisibilityChange = this.onVisibilityChange.bind(this);
    }

    start() {
        if (!this.canvas) {
            // Canvas missing from the saved markup (e.g. removed by hand): recreate it. It is
            // removed again on destroy by `insert`.
            this.canvas = document.createElement("canvas");
            this.canvas.classList.add("s_dz_ascii_hero__canvas");
            this.canvas.setAttribute("aria-hidden", "true");
            this.insert(this.canvas, this.host, "afterbegin");
        }
        this.ctx = this.canvas.getContext("2d");
        if (!this.ctx) {
            return;
        }
        this.resize();
        window.addEventListener("resize", this.onResize);
        this.reducedMotionQuery.addEventListener("change", this.onMotionPreferenceChange);
        document.addEventListener("visibilitychange", this.onVisibilityChange);
        this.observer = new IntersectionObserver((entries) => {
            this.visible = entries[entries.length - 1].isIntersecting;
            this.updateLoop();
        });
        this.observer.observe(this.host);
        this.updateLoop();
    }

    destroy() {
        this.stopLoop();
        if (this.resizeRaf) {
            cancelAnimationFrame(this.resizeRaf);
            this.resizeRaf = 0;
        }
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        window.removeEventListener("resize", this.onResize);
        this.reducedMotionQuery.removeEventListener("change", this.onMotionPreferenceChange);
        document.removeEventListener("visibilitychange", this.onVisibilityChange);
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    // -------------------------------------------------------------------------
    // Loop control
    // -------------------------------------------------------------------------

    get reducedMotion() {
        return this.reducedMotionQuery.matches;
    }

    updateLoop() {
        if (this.reducedMotion) {
            // One static frame, no animation loop.
            this.stopLoop();
            this.draw(STATIC_TIME);
        } else if (this.visible && !document.hidden) {
            this.startLoop();
        } else {
            this.stopLoop();
        }
    }

    startLoop() {
        if (this.running) {
            return;
        }
        this.running = true;
        this.rafId = requestAnimationFrame(this.onFrame);
    }

    stopLoop() {
        this.running = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = 0;
        }
    }

    onFrame(now) {
        if (!this.running) {
            return;
        }
        this.rafId = requestAnimationFrame(this.onFrame);
        if (now - this.lastFrame < FRAME_MS) {
            return;
        }
        this.lastFrame = now;
        this.draw((now / 1000) * TIME_SCALE);
    }

    onMotionPreferenceChange() {
        this.updateLoop();
    }

    onVisibilityChange() {
        this.updateLoop();
    }

    onResize() {
        if (this.resizeRaf) {
            return;
        }
        this.resizeRaf = requestAnimationFrame(() => {
            this.resizeRaf = 0;
            this.resize();
            if (this.reducedMotion) {
                this.draw(STATIC_TIME);
            }
        });
    }

    // -------------------------------------------------------------------------
    // Drawing
    // -------------------------------------------------------------------------

    resize() {
        const width = this.host.clientWidth;
        const height = this.host.clientHeight;
        this.dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.max(1, Math.round(width * this.dpr));
        this.canvas.height = Math.max(1, Math.round(height * this.dpr));
        this.cols = Math.ceil(width / CELL_W);
        this.rows = Math.ceil(height / CELL_H);
        this.levels = new Uint8Array(this.cols * this.rows);
    }

    /**
     * Plasma intensity in [0, 1] for a cell at time t (seconds).
     */
    plasma(col, row, t) {
        const cx = this.cols / 2;
        const cy = this.rows / 2;
        const v =
            Math.sin(col * 0.11 + t * 0.9) +
            Math.sin(row * 0.19 - t * 0.7) +
            Math.sin((col + row) * 0.07 + t * 0.5) +
            Math.sin(Math.hypot(col - cx, (row - cy) * 1.8) * 0.12 - t * 1.1);
        return (v + 4) / 8;
    }

    draw(t) {
        const ctx = this.ctx;
        if (!ctx || !this.levels) {
            return;
        }
        const { cols, rows, levels, dpr } = this;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);

        // 1. Map every cell to a glyph level.
        const top = RAMP.length - 1;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const intensity = Math.pow(this.plasma(col, row, t), 1.6);
                levels[row * cols + col] = Math.min(top, Math.floor(intensity * RAMP.length));
            }
        }

        // 2. Draw level by level so fillStyle only changes once per glyph.
        ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (let level = 0; level <= top; level++) {
            const alpha = MIN_ALPHA + (level / top) * (MAX_ALPHA - MIN_ALPHA);
            ctx.fillStyle = `rgba(${TINT}, ${alpha.toFixed(3)})`;
            const glyph = RAMP[level];
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    if (levels[row * cols + col] === level) {
                        ctx.fillText(glyph, col * CELL_W + CELL_W / 2, row * CELL_H + CELL_H / 2);
                    }
                }
            }
        }
    }
}

registry.category("public.interactions").add("theme_dataliza.ascii_hero", AsciiHero);
