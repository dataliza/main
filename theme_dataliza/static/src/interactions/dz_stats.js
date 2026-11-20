import { Interaction } from "@web/public/interaction";
import { registry } from "@web/core/registry";

// Count-up for the s_dz_stats band. The final values ("50+", "84 %", ...) are real text in the
// HTML, so no-JS visitors, reduced-motion users and the editor always see them. This only rewrites
// the text from 0 to the final value, once, when the band first enters the viewport.

const DURATION_MS = 1400;
const VALUE_RE = /^(\d+)(.*)$/; // "84 %" -> ["84", " %"]; "50+" -> ["50", "+"]

export class DzStats extends Interaction {
    static selector = ".s_dz_stats";

    setup() {
        this.items = [];
        this.rafId = 0;
        this.observer = null;
        this.reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    }

    start() {
        if (this.reducedMotionQuery.matches || !("IntersectionObserver" in window)) {
            return; // final values stay as they are
        }
        for (const node of this.el.querySelectorAll(".s_dz_stats__num")) {
            const match = VALUE_RE.exec(node.textContent.trim());
            if (match) {
                this.items.push({
                    node,
                    finalText: node.textContent,
                    target: parseInt(match[1], 10),
                    suffix: match[2],
                });
            }
        }
        if (!this.items.length) {
            return;
        }
        for (const { node, suffix } of this.items) {
            node.textContent = `0${suffix}`;
        }
        this.observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                this.observer.disconnect(); // once
                this.observer = null;
                this.startAnimation();
            }
        }, { threshold: 0.35 });
        this.observer.observe(this.el);
    }

    startAnimation() {
        const t0 = performance.now();
        const step = (now) => {
            const progress = Math.min(1, (now - t0) / DURATION_MS);
            const eased = 1 - Math.pow(1 - progress, 3);
            for (const { node, target, suffix } of this.items) {
                node.textContent = `${Math.round(target * eased)}${suffix}`;
            }
            this.rafId = progress < 1 ? requestAnimationFrame(step) : 0;
        };
        this.rafId = requestAnimationFrame(step);
    }

    destroy() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = 0;
        }
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        // Always leave the final values in the DOM (editor save, mid-animation teardown).
        for (const { node, finalText } of this.items) {
            node.textContent = finalText;
        }
        this.items = [];
    }
}

registry.category("public.interactions").add("theme_dataliza.dz_stats", DzStats);
