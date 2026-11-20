import { Interaction } from "@web/public/interaction";
import { registry } from "@web/core/registry";

// Pixel hover effect for the "Módulos" cards: on hover/focus, small squares grow from the centre of
// the card and shimmer; they shrink away on leave. On photo cells each pixel takes the colour of
// the photo underneath, so the picture seems to assemble itself out of pixels. Adapted from Ryan Mulligan's <pixel-canvas>
// web component (https://codepen.io/hexagoncircle/pen/KwPpdBZ, CodePen pens are MIT licensed by
// default). Decorative only: the canvas sits behind the card content and ignores the pointer.
// Under prefers-reduced-motion the pixels appear at once and do not shimmer.

// <core>
const PIXEL_COLORS = ["#5cb531", "#7ddc45", "#00ff66"]; // brand green to phosphor green
const PIXEL_GAP = 8; // css px between pixel cells: bigger cells = ~2.5x fewer pixels to draw per frame
const PIXEL_MAX_SIZE = 6; // css px, biggest pixel at the peak of its shimmer
const PIXEL_SPEED = 70; // 0-100, shimmer speed (bigger pixels need a faster shimmer to look alive)

class Pixel {
    constructor(ctx, x, y, color, speed, delay, size) {
        this.ctx = ctx;
        this.x = x;
        this.y = y;
        this.color = color;
        this.speed = (0.1 + Math.random() * 0.8) * speed;
        this.size = 0;
        this.sizeStep = Math.random() * 0.4;
        this.minSize = 0.5;
        this.maxSizeInteger = size;
        this.maxSize = this.minSize + Math.random() * (size - this.minSize);
        this.delay = delay;
        this.counter = 0;
        this.counterStep = Math.random() * 4 + 4;
        this.isIdle = false;
        this.isReverse = false;
        this.isShimmer = false;
    }

    draw() {
        const offset = this.maxSizeInteger * 0.5 - this.size * 0.5;
        this.ctx.fillStyle = this.color;
        this.ctx.fillRect(this.x + offset, this.y + offset, this.size, this.size);
    }

    appear() {
        this.isIdle = false;
        if (this.counter <= this.delay) {
            this.counter += this.counterStep;
            return;
        }
        if (this.size >= this.maxSize) {
            this.isShimmer = true;
        }
        if (this.isShimmer) {
            this.shimmer();
        } else {
            this.size += this.sizeStep;
        }
        this.draw();
    }

    disappear() {
        this.isShimmer = false;
        this.counter = 0;
        if (this.size <= 0) {
            this.isIdle = true;
            return;
        }
        this.size -= 0.1;
        this.draw();
    }

    shimmer() {
        if (this.size >= this.maxSize) {
            this.isReverse = true;
        } else if (this.size <= this.minSize) {
            this.isReverse = false;
        }
        this.size += this.isReverse ? -this.speed : this.speed;
    }
}

// Averages the card's photo down to one colour per pixel cell (drawing the image into a tiny canvas
// lets the browser do the averaging) and lifts brightness/saturation so dark photos still glow.
// Returns null when there is no usable photo; the pixels then fall back to the green palette.
function samplePhoto(host, width, height) {
    const photo = host.querySelector(".s_dz_features__bg");
    if (!photo || !photo.complete || !photo.naturalWidth || !width || !height) {
        return null;
    }
    const cols = Math.ceil(width / PIXEL_GAP);
    const rows = Math.ceil(height / PIXEL_GAP);
    try {
        const small = document.createElement("canvas");
        small.width = cols;
        small.height = rows;
        const sctx = small.getContext("2d", { willReadFrequently: true });
        sctx.imageSmoothingQuality = "high";
        const scale = Math.max(cols / photo.naturalWidth, rows / photo.naturalHeight);
        const w = photo.naturalWidth * scale;
        const h = photo.naturalHeight * scale;
        sctx.drawImage(photo, (cols - w) / 2, (rows - h) / 2, w, h); // object-fit: cover
        const data = sctx.getImageData(0, 0, cols, rows).data;
        return (col, row) => {
            const i = (Math.min(row, rows - 1) * cols + Math.min(col, cols - 1)) * 4;
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const lift = (v) => Math.max(0, Math.min(255, Math.round((avg + (v - avg) * 1.4) * 1.5 + 25)));
            return `rgb(${lift(data[i])},${lift(data[i + 1])},${lift(data[i + 2])})`;
        };
    } catch {
        return null; // tainted canvas or no 2d context
    }
}

function createPixelField(host) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const speed = reducedMotion ? 0 : PIXEL_SPEED * 0.001;
    const canvas = document.createElement("canvas");
    canvas.className = "dz-pixels";
    canvas.setAttribute("aria-hidden", "true");
    host.prepend(canvas);
    const ctx = canvas.getContext("2d");
    let pixels = [];
    let raf = 0;
    let last = performance.now();
    const interval = 1000 / 60;

    function build() {
        const rect = host.getBoundingClientRect();
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);
        canvas.width = width;
        canvas.height = height;
        pixels = [];
        const photoColor = samplePhoto(host, width, height);
        for (let x = 0; x < width; x += PIXEL_GAP) {
            for (let y = 0; y < height; y += PIXEL_GAP) {
                const color = photoColor
                    ? photoColor(x / PIXEL_GAP, y / PIXEL_GAP)
                    : PIXEL_COLORS[Math.floor(Math.random() * PIXEL_COLORS.length)];
                const delay = reducedMotion ? 0 : Math.hypot(x - width / 2, y - height / 2);
                pixels.push(new Pixel(ctx, x, y, color, speed, delay, PIXEL_MAX_SIZE));
            }
        }
    }

    function loop(name) {
        raf = requestAnimationFrame(() => loop(name));
        const now = performance.now();
        const passed = now - last;
        if (passed < interval) {
            return;
        }
        last = now - (passed % interval);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let allIdle = true;
        for (const pixel of pixels) {
            pixel[name]();
            if (!pixel.isIdle) {
                allIdle = false;
            }
        }
        if (name === "disappear" && allIdle) {
            cancelAnimationFrame(raf); // nothing left to draw: stop the loop
        }
    }

    function run(name) {
        cancelAnimationFrame(raf);
        loop(name);
    }

    const onEnter = () => run("appear");
    const onLeave = () => run("disappear");
    const onFocusIn = (event) => {
        if (!host.contains(event.relatedTarget)) {
            run("appear");
        }
    };
    const onFocusOut = (event) => {
        if (!host.contains(event.relatedTarget)) {
            run("disappear");
        }
    };

    build();
    const photo = host.querySelector(".s_dz_features__bg");
    if (photo && !photo.complete) {
        photo.addEventListener("load", build, { once: true }); // lazy image: sample once it is there
    }
    const resizeObserver = new ResizeObserver(build);
    resizeObserver.observe(host);
    host.addEventListener("mouseenter", onEnter);
    host.addEventListener("mouseleave", onLeave);
    host.addEventListener("focusin", onFocusIn);
    host.addEventListener("focusout", onFocusOut);

    return {
        destroy() {
            cancelAnimationFrame(raf);
            resizeObserver.disconnect();
            host.removeEventListener("mouseenter", onEnter);
            host.removeEventListener("mouseleave", onLeave);
            host.removeEventListener("focusin", onFocusIn);
            host.removeEventListener("focusout", onFocusOut);
            canvas.remove();
        },
    };
}
// </core>

export class DzPixelCards extends Interaction {
    static selector = ".s_dz_features__card";

    start() {
        this.field = createPixelField(this.el);
    }

    destroy() {
        if (this.field) {
            this.field.destroy();
            this.field = null;
        }
    }
}

registry.category("public.interactions").add("theme_dataliza.dz_pixel_cards", DzPixelCards);
