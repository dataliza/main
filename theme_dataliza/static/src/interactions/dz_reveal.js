import { Interaction } from "@web/public/interaction";
import { registry } from "@web/core/registry";

// Fade/translate-in on scroll for the s_dz_trust section. Content is visible by default (no JS,
// reduced motion, editor); the hidden "ready" state is only applied once this interaction runs.

export class DzReveal extends Interaction {
    static selector = ".s_dz_trust";

    setup() {
        this.observer = null;
        this.reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    }

    start() {
        if (this.reducedMotionQuery.matches || !("IntersectionObserver" in window)) {
            return;
        }
        this.el.classList.add("dz-reveal-ready");
        this.observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                this.el.classList.add("dz-in");
                this.observer.disconnect(); // once
                this.observer = null;
            }
        }, { threshold: 0.2 });
        this.observer.observe(this.el);
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.el.classList.remove("dz-reveal-ready", "dz-in");
    }
}

registry.category("public.interactions").add("theme_dataliza.dz_reveal", DzReveal);
